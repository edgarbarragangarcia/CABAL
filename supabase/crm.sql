-- CRM: conteos exactos de los leads de Bitrix24 por departamento y por ciudad (se calculan con consultas de conteo, sin copiar a las personas).
-- Pegar completo en Supabase > SQL Editor > Run (una sola vez; se puede repetir sin problema). Se accede solo desde el servidor con la
-- service role key: RLS queda ACTIVADO y sin políticas.

create table if not exists crm_conteos (
  clave text primary key,            -- p. ej. total, con_ciudad, depto:12842, ciudad:22272, ciudad:22272:05 (ciudad repetida, por departamento)
  tipo text not null,                -- total | depto | ciudad | ciudad_depto
  nombre text,
  total integer not null,
  actualizado_en timestamptz not null default now()
);
alter table crm_conteos enable row level security;
create index if not exists crm_conteos_tipo on crm_conteos (tipo);
