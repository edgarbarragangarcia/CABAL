-- Territorio: conflicto armado y problemas por municipio, con cifras oficiales de datos abiertos (datos.gov.co) guardadas en Supabase para
-- cruzarlas con los resultados electorales. Pegar completo en Supabase > SQL Editor > Run (una sola vez; se puede repetir sin problema).
-- Se accede solo desde el servidor con la service role key: RLS queda ACTIVADO y sin políticas, así la llave pública (anon) no lee ni escribe.

-- Una fila por municipio (código DANE de cinco dígitos), indicador y periodo. Los departamentos y el país se suman en la consulta.
create table if not exists indicadores_territoriales (
  dane text not null,                       -- código DANE del municipio, p. ej. 13001 (Cartagena)
  indicador text not null,                  -- victimas_total, victimas_desplazamiento, homicidios, masacres_casos, coca_ha, pdet...
  periodo text not null default 'acum',     -- «acum» (acumulado hasta el corte), un año («2023») o una ventana («2021-2025»)
  valor numeric not null,
  detalle text,                             -- texto asociado (p. ej. la subregión PDET)
  fuente text not null,                     -- quién publica el dato
  corte text,                               -- fecha de corte o año de la fuente
  actualizado_en timestamptz not null default now(),
  primary key (dane, indicador, periodo)
);

create index if not exists indicadores_territoriales_indicador_idx on indicadores_territoriales (indicador, periodo);

alter table indicadores_territoriales enable row level security;

-- La suma de cada indicador y periodo sobre los municipios cuyo código empieza por el prefijo: «13» = Bolívar, «13001» = Cartagena, «» = todo el país.
create or replace function indicadores_resumen(p_prefijo text)
returns table (indicador text, periodo text, valor numeric, municipios bigint, detalle text, fuente text, corte text)
language sql stable security invoker set search_path = public as $$
  select i.indicador, i.periodo, sum(i.valor), count(*), max(i.detalle), max(i.fuente), max(i.corte)
  from indicadores_territoriales i
  where i.dane like coalesce(p_prefijo, '') || '%'
  group by i.indicador, i.periodo
$$;

-- Qué hay cargado de cada indicador (lo usa el panel para mostrar el estado de las fuentes).
create or replace function resumen_indicadores()
returns table (indicador text, filas bigint, corte text, actualizado_en timestamptz)
language sql stable security invoker set search_path = public as $$
  select i.indicador, count(*), max(i.corte), max(i.actualizado_en)
  from indicadores_territoriales i
  group by i.indicador
$$;

-- Nada de esto es público: solo el servidor (service role) lo toca.
revoke all on indicadores_territoriales from anon, authenticated;
revoke all on function indicadores_resumen(text) from public, anon, authenticated;
revoke all on function resumen_indicadores() from public, anon, authenticated;
grant execute on function indicadores_resumen(text) to service_role;
grant execute on function resumen_indicadores() to service_role;
