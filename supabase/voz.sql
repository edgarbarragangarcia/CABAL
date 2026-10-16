-- Voz de la Dra.: los textos reales de María Fernanda Cabal (discursos, columnas, trinos, transcripciones de videos de YouTube...) de donde el
-- Redactor aprende a escribir como ella. Se guarda el texto COMPLETO tal como se leyó del archivo, sin resumir.
-- Pegar completo en Supabase > SQL Editor > Run (se puede repetir sin problema).
-- Todo se accede solo desde el servidor (service role): RLS activado y sin políticas.

create table if not exists voz_corpus (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('archivo', 'youtube', 'texto')),
  titulo text not null,
  fuente text,                               -- nombre del archivo o enlace del video
  formato text not null default 'general',   -- general, x, instagram, facebook, tiktok, columna, discurso, entrevista
  contenido text not null,                   -- el texto completo leído
  palabras integer not null default 0,
  caracteres integer not null default 0,
  paginas integer,
  hash text not null unique,                 -- evita subir dos veces lo mismo
  activo boolean not null default true,
  creado_por text,
  creado_en timestamptz not null default now()
);

create index if not exists voz_corpus_formato_idx on voz_corpus (formato, activo);

alter table voz_corpus enable row level security;
revoke all on voz_corpus from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Lectura por significado: cada texto se divide en fragmentos (unos mil caracteres) y cada fragmento se vectoriza (768 dimensiones, igual
-- que los documentos). Al escribir, el Redactor busca los pasajes suyos más parecidos al tema y los usa de ejemplo de su voz.
create extension if not exists vector with schema extensions;

create table if not exists voz_fragmentos (
  id bigint generated always as identity primary key,
  corpus_id uuid not null references voz_corpus (id) on delete cascade,
  posicion integer not null,
  contenido text not null,
  caracteres integer not null,
  modelo text,
  embedding extensions.vector(768),
  unique (corpus_id, posicion)
);

create index if not exists voz_fragmentos_corpus_idx on voz_fragmentos (corpus_id, posicion);
create index if not exists voz_fragmentos_pendientes_idx on voz_fragmentos (id) where embedding is null;
create index if not exists voz_fragmentos_embedding_idx on voz_fragmentos using hnsw (embedding extensions.vector_cosine_ops);

alter table voz_fragmentos enable row level security;
revoke all on voz_fragmentos from anon, authenticated;

create or replace function buscar_voz_fragmentos(p_consulta extensions.vector(768), p_modelo text, p_cantidad integer default 16, p_formato text default null)
returns table (corpus_id uuid, titulo text, formato text, contenido text, similitud double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select f.corpus_id, c.titulo, c.formato, f.contenido, (1 - (f.embedding <=> p_consulta))::double precision as similitud
  from voz_fragmentos f
  join voz_corpus c on c.id = f.corpus_id
  where f.embedding is not null
    and f.modelo = p_modelo
    and c.activo
    and (p_formato is null or c.formato = p_formato)
  order by f.embedding <=> p_consulta
  limit greatest(1, least(coalesce(p_cantidad, 16), 60))
$$;

create or replace function guardar_voz_vectores(p_filas jsonb)
returns integer
language sql security invoker set search_path = public, extensions as $$
  with cambios as (
    update voz_fragmentos f
       set embedding = (x.valor ->> 'embedding')::extensions.vector,
           modelo = x.valor ->> 'modelo'
      from jsonb_array_elements(p_filas) as x(valor)
     where f.id = (x.valor ->> 'id')::bigint
    returning 1
  )
  select count(*)::integer from cambios
$$;

revoke all on function buscar_voz_fragmentos(extensions.vector, text, integer, text) from public, anon, authenticated;
grant execute on function buscar_voz_fragmentos(extensions.vector, text, integer, text) to service_role;
revoke all on function guardar_voz_vectores(jsonb) from public, anon, authenticated;
grant execute on function guardar_voz_vectores(jsonb) to service_role;
