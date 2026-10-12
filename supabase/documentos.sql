-- Documentos: biblioteca de documentos (PDF, Word, texto...) que se dividen en fragmentos, se vectorizan y se guardan en Supabase para
-- buscarlos por significado. Pegar completo en Supabase > SQL Editor > Run (una sola vez; se puede repetir sin problema). Se accede solo
-- desde el servidor con la service role key: RLS queda ACTIVADO y sin políticas, así la llave pública (anon) no puede leer ni escribir nada.
-- Los vectores tienen 768 dimensiones (Gemini gemini-embedding-001 u OpenAI text-embedding-3-small, ambos reducidos a 768).

-- Vectores en Postgres (pgvector).
create extension if not exists vector with schema extensions;

-- Un documento por archivo subido. El original queda en Storage (bucket «documentos», privado).
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  archivo text,                                  -- nombre del archivo original
  tipo text,                                     -- pdf, docx, txt, md, csv, html...
  bytes bigint,
  paginas integer,
  caracteres integer,
  fragmentos integer not null default 0,         -- cuántos fragmentos tiene en total
  vectorizados integer not null default 0,       -- cuántos ya tienen su vector
  estado text not null default 'subiendo' check (estado in ('subiendo', 'procesando', 'listo', 'error')),
  error text,
  modelo text,                                   -- modelo de vectores con el que se vectorizó
  etiquetas text[] not null default '{}',
  ruta text,                                     -- ruta del original en Storage
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Los fragmentos de cada documento (unos mil caracteres cada uno) y su vector.
create table if not exists documento_fragmentos (
  id bigint generated always as identity primary key,
  documento_id uuid not null references documentos (id) on delete cascade,
  posicion integer not null,                     -- orden dentro del documento, desde 0
  pagina integer,                                -- página donde empieza (PDF)
  contenido text not null,
  caracteres integer not null,
  modelo text,
  embedding extensions.vector(768),
  unique (documento_id, posicion)
);

create index if not exists documento_fragmentos_documento_idx on documento_fragmentos (documento_id, posicion);
create index if not exists documento_fragmentos_pendientes_idx on documento_fragmentos (documento_id) where embedding is null;
create index if not exists documento_fragmentos_embedding_idx on documento_fragmentos using hnsw (embedding extensions.vector_cosine_ops);

alter table documentos enable row level security;
alter table documento_fragmentos enable row level security;

-- Búsqueda por significado: los fragmentos más parecidos a la consulta (ya vectorizada con el mismo modelo).
create or replace function buscar_fragmentos(p_consulta extensions.vector(768), p_modelo text, p_cantidad integer default 8, p_documento uuid default null)
returns table (documento_id uuid, titulo text, posicion integer, pagina integer, contenido text, similitud double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select f.documento_id, d.titulo, f.posicion, f.pagina, f.contenido, (1 - (f.embedding <=> p_consulta))::double precision as similitud
  from documento_fragmentos f
  join documentos d on d.id = f.documento_id
  where f.embedding is not null
    and f.modelo = p_modelo
    and (p_documento is null or f.documento_id = p_documento)
  order by f.embedding <=> p_consulta
  limit greatest(1, least(coalesce(p_cantidad, 8), 50))
$$;

-- Guarda en una sola llamada los vectores de muchos fragmentos: [{"id": 12, "embedding": [..768 números..], "modelo": "..."}, ...].
create or replace function guardar_vectores(p_filas jsonb)
returns integer
language sql security invoker set search_path = public, extensions as $$
  with cambios as (
    update documento_fragmentos f
       set embedding = (x.valor ->> 'embedding')::extensions.vector,
           modelo = x.valor ->> 'modelo'
      from jsonb_array_elements(p_filas) as x(valor)
     where f.id = (x.valor ->> 'id')::bigint
    returning 1
  )
  select count(*)::integer from cambios
$$;

-- Nada de esto es público: solo el servidor (service role) lo toca.
revoke all on documentos, documento_fragmentos from anon, authenticated;
revoke all on function buscar_fragmentos(extensions.vector, text, integer, uuid) from public, anon, authenticated;
grant execute on function buscar_fragmentos(extensions.vector, text, integer, uuid) to service_role;
revoke all on function guardar_vectores(jsonb) from public, anon, authenticated;
grant execute on function guardar_vectores(jsonb) to service_role;
