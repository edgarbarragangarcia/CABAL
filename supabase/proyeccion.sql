-- Proyección 2030: población por municipio, sexo y edad simple (DANE, «Proyecciones de población municipal 2018-2042», base Censo 2018).
-- Pegar completo en Supabase > SQL Editor > Run (una sola vez; se puede repetir sin problema). Después se cargan los datos desde el panel
-- (Análisis > Proyección 2030 > «Cargar datos del DANE») o con los archivos SQL de esa misma pantalla.
-- Se accede solo desde el servidor con la service role key: RLS queda ACTIVADO y sin políticas.

create table if not exists proyeccion_poblacion (
  dane text not null,                 -- código DIVIPOLA del municipio (5 dígitos)
  anio smallint not null,
  municipio text not null,
  departamento text not null,
  hombres integer[] not null,         -- 101 posiciones: edades 0 a 99 y «100 o más» (la posición 1 es la edad 0)
  mujeres integer[] not null,
  fuente text not null default 'DANE, proyecciones de población municipal 2018-2042 (Censo 2018)',
  actualizado_en timestamptz not null default now(),
  primary key (dane, anio)
);
alter table proyeccion_poblacion enable row level security;
create index if not exists proyeccion_poblacion_anio on proyeccion_poblacion (anio);

-- Resumen por municipio y año que lee el panel: total, hombres, mujeres, adultos (18+), hombres y mujeres 18+, edades 14 a 17, edades 18 a 21 y
-- bandas 18-24, 25-34, 35-44, 45-54, 55-64, 65+ (20 números, en ese orden).
create or replace function proyeccion_resumen(p_anios integer[])
returns table (dane text, anio smallint, municipio text, departamento text, resumen integer[])
language sql stable security invoker set search_path = public as $$
  with b as (
    select p.dane, p.anio, p.municipio, p.departamento,
      (select array_agg(h + m order by i) from unnest(p.hombres, p.mujeres) with ordinality as t(h, m, i)) as t,
      p.hombres as h, p.mujeres as m
    from proyeccion_poblacion p where p.anio = any(p_anios)
  )
  select b.dane, b.anio, b.municipio, b.departamento, array[
    (select coalesce(sum(x), 0) from unnest(b.t) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.h) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.m) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.t[19:101]) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.h[19:101]) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.m[19:101]) x)::integer,
    b.t[15], b.t[16], b.t[17], b.t[18],
    b.t[19], b.t[20], b.t[21], b.t[22],
    (select coalesce(sum(x), 0) from unnest(b.t[19:25]) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.t[26:35]) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.t[36:45]) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.t[46:55]) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.t[56:65]) x)::integer,
    (select coalesce(sum(x), 0) from unnest(b.t[66:101]) x)::integer
  ] from b
$$;
revoke all on function proyeccion_resumen(integer[]) from public, anon, authenticated;
grant execute on function proyeccion_resumen(integer[]) to service_role;
