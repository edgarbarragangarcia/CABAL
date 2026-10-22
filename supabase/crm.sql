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

-- Los leads de Bitrix24 (sin teléfonos ni correos): nombre, lugar y los campos que sirven para segmentar. Se llena desde el panel
-- (Análisis > Red Cabal > Todos los leads > «Guardar todos los leads»). Se puede repetir: actualiza lo que ya está.
create table if not exists crm_leads (
  id bigint primary key,              -- ID del lead en Bitrix24
  nombre text,
  estado text,                        -- etapa del lead
  creado_en timestamptz,
  responsable_id integer,
  ciudad text,
  departamento text,
  dane text,                          -- municipio DANE al que corresponde la ciudad (para el mapa y la lista por ciudad)
  localidad text,
  barrio text,
  pais text,
  gremio text,
  corporacion text,
  profesion text,
  origen_base text,
  base text,
  anio_campana text,
  tiene_hijos boolean,
  testigo_electoral boolean,
  electo boolean,
  voto boolean,
  microinfluenciador boolean,
  grupo_whatsapp boolean,
  actualizado_en timestamptz not null default now()
);
alter table crm_leads enable row level security;
create index if not exists crm_leads_ciudad on crm_leads (ciudad);
create index if not exists crm_leads_departamento on crm_leads (departamento);
create index if not exists crm_leads_dane on crm_leads (dane);
create index if not exists crm_leads_estado on crm_leads (estado);
