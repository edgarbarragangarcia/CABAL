-- Votos por mesa de un candidato, tal como los publica el escrutinio (hoy: María Fernanda Cabal, Senado 2022, después de escrutinio).
-- Fuente: el Excel «VOTACIÓN MARIA_FERNANDA_CABAL». Se carga con scripts/cargar-votos-mesa.mjs. Se puede ejecutar más de una vez.
-- Se accede solo desde el servidor con la service role key: RLS ACTIVADO y sin políticas.

create table if not exists votos_mesa (
  anio integer not null,
  etapa text not null,                -- preconteo | escrutinio
  corporacion text not null,
  circunscripcion text not null,
  candidato text not null,
  agrupacion text,
  posicion integer,
  departamento text not null,
  municipio text not null,
  zona integer not null,
  puesto integer not null,
  nombre_puesto text,
  mesa integer not null,
  votos integer not null,
  primary key (anio, etapa, corporacion, candidato, departamento, municipio, zona, puesto, mesa)
);
alter table votos_mesa enable row level security;
revoke all on votos_mesa from anon, authenticated;
create index if not exists votos_mesa_lugar on votos_mesa (anio, etapa, candidato, departamento, municipio);

-- Totales por departamento (para el panel del Gestor documental).
create or replace view votos_mesa_departamento as
  select anio, etapa, corporacion, candidato, departamento, count(distinct (municipio)) as municipios, count(*) as mesas, sum(votos)::bigint as votos
  from votos_mesa
  group by anio, etapa, corporacion, candidato, departamento;
revoke all on votos_mesa_departamento from anon, authenticated;
