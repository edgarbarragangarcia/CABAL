-- Resultados electorales: copia en Supabase de lo que muestra Análisis > Votaciones (preconteo oficial de la Registraduría y,
-- para el Congreso 2018, los datos abiertos de datos.gov.co). Pegar completo en Supabase > SQL Editor > Run (una sola vez;
-- se puede repetir sin problema). Se accede solo desde el servidor con la service role key: RLS queda ACTIVADO y sin
-- políticas, y las vistas usan security_invoker, así la llave pública (anon) no puede leer ni escribir nada.

-- Catálogo: qué elecciones y cargos hay (lo escribe la propia aplicación al comprobar el estado o al guardar resultados).
create table if not exists catalogo_electoral (
  eleccion text not null,                  -- presidencia-2022-2v, congreso-2026, territoriales-2023...
  corporacion text not null,               -- PR presidencia, SE senado, CA cámara, GO gobernación, AL alcaldía, AS asamblea, CO concejo, JA JAL, CN/PH/EP/CC consultas, CT CITREP
  eleccion_nombre text not null,
  corporacion_nombre text not null,
  fecha date not null,
  tipo text not null,                      -- uninominal (un ganador), lista (curules) o consulta
  nivel_eleccion smallint not null,        -- 1 país, 2 departamento, 3 municipio, 5 comuna: dónde se elige
  fuente text not null,
  primary key (eleccion, corporacion)
);

-- Un resultado por elección, cargo y territorio. «datos» es el resultado completo tal como lo muestra la aplicación:
-- circunscripciones > partidos > candidatos, más el ganador en cada territorio hijo (el mapa).
create table if not exists resultados_electorales (
  eleccion text not null,
  corporacion text not null,
  ambito text not null,                    -- código del territorio en la fuente (una mesa = código del puesto + 6 dígitos)
  ambito_nombre text,
  nivel smallint,                          -- 1 país, 2 departamento, 3 municipio, 4 zona, 5 comuna, 6 puesto, 7 mesa
  dane text,                               -- código DANE de departamentos y municipios
  vacio boolean not null default false,    -- la fuente no publica este territorio para este cargo
  con_mapa boolean not null default true,  -- trae el ganador de cada territorio hijo (el Congreso 2018 lo calcula aparte)
  podado boolean not null default false,   -- sin los candidatos con 0 votos (territorios pequeños de listas con cientos de candidatos)
  corte text,                              -- corte del preconteo, "DD/MM HH:MM"
  mesas_total integer,
  mesas_informadas integer,
  censo integer,
  votantes integer,
  nulos integer,
  no_marcados integer,
  curules integer,
  datos jsonb,
  actualizado_en timestamptz not null default now(),
  primary key (eleccion, corporacion, ambito),
  check ((vacio and datos is null) or (not vacio and datos is not null))
);

create index if not exists resultados_electorales_dane_idx on resultados_electorales (dane) where dane is not null;
create index if not exists resultados_electorales_nivel_idx on resultados_electorales (eleccion, corporacion, nivel);

alter table catalogo_electoral enable row level security;
alter table resultados_electorales enable row level security;

-- Vistas para consultar con SQL, una fila por partido, por candidato y por ganador de cada territorio hijo.
create or replace view partidos_electorales with (security_invoker = true) as
select r.eleccion, k.eleccion_nombre, k.corporacion_nombre, k.fecha, r.corporacion, r.ambito, r.ambito_nombre, r.nivel, r.dane,
       c.value ->> 'codigo' as circunscripcion,
       p.value ->> 'codigo' as partido_codigo,
       p.value ->> 'nombre' as partido,
       (p.value ->> 'votos')::bigint as votos,
       p.value ->> 'pct' as porcentaje,
       (p.value ->> 'curules')::integer as curules
from resultados_electorales r
left join catalogo_electoral k on k.eleccion = r.eleccion and k.corporacion = r.corporacion
cross join lateral jsonb_array_elements(r.datos -> 'circunscripciones') as c
cross join lateral jsonb_array_elements(c.value -> 'partidos') as p
where r.datos is not null;

create or replace view candidatos_electorales with (security_invoker = true) as
select r.eleccion, k.eleccion_nombre, k.corporacion_nombre, k.fecha, r.corporacion, r.ambito, r.ambito_nombre, r.nivel, r.dane,
       c.value ->> 'codigo' as circunscripcion,
       p.value ->> 'codigo' as partido_codigo,
       p.value ->> 'nombre' as partido,
       x.value ->> 'codigo' as candidato_codigo,
       x.value ->> 'nombre' as candidato,
       x.value ->> 'formula' as formula,
       x.value ->> 'cedula' as cedula,
       (x.value ->> 'votos')::bigint as votos,
       x.value ->> 'pct' as porcentaje,
       coalesce((x.value ->> 'electo')::boolean, false) as electo,
       coalesce((x.value ->> 'soloLista')::boolean, false) as solo_lista
from resultados_electorales r
left join catalogo_electoral k on k.eleccion = r.eleccion and k.corporacion = r.corporacion
cross join lateral jsonb_array_elements(r.datos -> 'circunscripciones') as c
cross join lateral jsonb_array_elements(c.value -> 'partidos') as p
cross join lateral jsonb_array_elements(p.value -> 'candidatos') as x
where r.datos is not null;

create or replace view ganadores_electorales with (security_invoker = true) as
select r.eleccion, k.eleccion_nombre, k.corporacion_nombre, k.fecha, r.corporacion,
       r.ambito as ambito_padre, r.ambito_nombre as padre_nombre,
       c.value ->> 'codigo' as circunscripcion,
       g.value ->> 'codigo' as ambito,
       g.value ->> 'nombre' as ambito_nombre,
       g.value ->> 'dane' as dane,
       g.value ->> 'partidoNombre' as partido,
       g.value ->> 'candidato' as candidato,
       (g.value ->> 'votos')::bigint as votos,
       g.value ->> 'pct' as porcentaje,
       (g.value ->> 'votantes')::bigint as votantes,
       g.value ->> 'participacion' as participacion,
       coalesce((g.value ->> 'empate')::boolean, false) as empate
from resultados_electorales r
left join catalogo_electoral k on k.eleccion = r.eleccion and k.corporacion = r.corporacion
cross join lateral jsonb_array_elements(r.datos -> 'circunscripciones') as c
cross join lateral jsonb_array_elements(c.value -> 'mapa') as g
where r.datos is not null;

-- Cuántos territorios hay guardados por elección, cargo y nivel (lo usa el panel Análisis > Datos).
create or replace function cobertura_electoral()
returns table (eleccion text, corporacion text, nivel smallint, guardados bigint, vacios bigint, ultima timestamptz)
language sql stable security invoker set search_path = public as $$
  select r.eleccion, r.corporacion, r.nivel,
         count(*) filter (where not r.vacio),
         count(*) filter (where r.vacio),
         max(r.actualizado_en)
  from resultados_electorales r
  group by r.eleccion, r.corporacion, r.nivel
$$;

-- [carga:inicio]
-- Carga en segundo plano: una sola fila con el estado de la carga que el servidor va haciendo por tramos (así no hace falta dejar
-- abierta la pantalla Análisis > Datos). «cadena» identifica la carga en curso: solo ella puede seguir; iniciar otra o detenerla
-- la corta. Sin esta tabla todo lo demás funciona: la carga se hace desde la pantalla.
create table if not exists carga_electoral (
  id text primary key default 'principal',
  activa boolean not null default false,
  cadena text,
  ultimo_lote_en timestamptz,
  estado jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

alter table carga_electoral enable row level security;
revoke all on carga_electoral from anon, authenticated;
-- [carga:fin]

-- Nada de esto es público: solo el servidor (service role) lo toca.
revoke all on catalogo_electoral, resultados_electorales from anon, authenticated;
revoke all on partidos_electorales, candidatos_electorales, ganadores_electorales from anon, authenticated;
revoke all on function cobertura_electoral() from public, anon, authenticated;
