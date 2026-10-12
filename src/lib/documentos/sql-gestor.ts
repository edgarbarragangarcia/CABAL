/** Copia exacta de supabase/gestor-documental.sql: la pestaña Documentos la muestra para pegarla en el editor SQL de Supabase. */
export const SQL_GESTOR = `-- Gestor documental: carpetas, metadatos, versiones, papelera e historial sobre la biblioteca de Documentos.
-- Pegar completo en Supabase > SQL Editor > Run (después de documentos.sql; se puede repetir sin problema).
-- Todo se accede solo desde el servidor (service role): RLS activado y sin políticas.

create table if not exists documento_carpetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  padre_id uuid references documento_carpetas (id) on delete cascade,
  creado_en timestamptz not null default now()
);

alter table documentos add column if not exists carpeta_id uuid references documento_carpetas (id) on delete set null;
alter table documentos add column if not exists descripcion text;
alter table documentos add column if not exists categoria text;       -- acta, plan de gobierno, estudio, columna, norma...
alter table documentos add column if not exists autor text;
alter table documentos add column if not exists fuente text;          -- de dónde salió (entidad, medio, URL)
alter table documentos add column if not exists fecha_documento date; -- la fecha del documento, no la de subida
alter table documentos add column if not exists confidencial boolean not null default false;
alter table documentos add column if not exists hash text;            -- SHA-256 del archivo: detecta duplicados
alter table documentos add column if not exists version integer not null default 1;
alter table documentos add column if not exists grupo_version uuid;   -- todas las versiones de un documento comparten grupo
alter table documentos add column if not exists es_vigente boolean not null default true;
alter table documentos add column if not exists eliminado_en timestamptz; -- papelera: no se muestra ni se busca
alter table documentos add column if not exists creado_por text;

create index if not exists documentos_carpeta_idx on documentos (carpeta_id) where eliminado_en is null;
create index if not exists documentos_hash_idx on documentos (hash) where hash is not null;
create index if not exists documentos_grupo_idx on documentos (grupo_version) where grupo_version is not null;

-- Historial: quién hizo qué con cada documento (sobrevive al borrado definitivo).
create table if not exists documento_eventos (
  id bigint generated always as identity primary key,
  documento_id uuid,
  titulo text,
  accion text not null,                          -- subido, editado, movido, version, papelera, restaurado, eliminado, descargado
  detalle jsonb,
  usuario text,
  en timestamptz not null default now()
);
create index if not exists documento_eventos_documento_idx on documento_eventos (documento_id, en desc);

alter table documento_carpetas enable row level security;
alter table documento_eventos enable row level security;
revoke all on documento_carpetas, documento_eventos from anon, authenticated;

-- La búsqueda por significado deja fuera la papelera y las versiones anteriores.
create or replace function buscar_fragmentos(p_consulta extensions.vector(768), p_modelo text, p_cantidad integer default 8, p_documento uuid default null)
returns table (documento_id uuid, titulo text, posicion integer, pagina integer, contenido text, similitud double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select f.documento_id, d.titulo, f.posicion, f.pagina, f.contenido, (1 - (f.embedding <=> p_consulta))::double precision as similitud
  from documento_fragmentos f
  join documentos d on d.id = f.documento_id
  where f.embedding is not null
    and f.modelo = p_modelo
    and d.eliminado_en is null
    and d.es_vigente
    and (p_documento is null or f.documento_id = p_documento)
  order by f.embedding <=> p_consulta
  limit greatest(1, least(coalesce(p_cantidad, 8), 50))
$$;
`;
