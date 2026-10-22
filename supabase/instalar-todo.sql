-- CABAL: instalación completa en una base nueva de Supabase (generado por scripts/unir-sql.mjs; no editar a mano).
-- Pegar COMPLETO en Supabase › SQL Editor › Run. Se puede repetir sin problema.
-- Aparte, opcional y solo si la carga electoral se detiene por tiempo: supabase/carga-indices.sql.

-- ============================================================
-- comunidad.sql
-- ============================================================
-- Comunidad CABAL: afiliados, red social y grupos. Pegar completo en Supabase > SQL Editor > Run.
-- Todo se accede solo desde el servidor con la service role key: RLS queda ACTIVADO y sin políticas,
-- así la llave pública (anon) no puede leer ni escribir nada (hay cédulas y direcciones).

create extension if not exists pgcrypto;

create table if not exists miembros (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique check (usuario ~ '^[a-z0-9_]{3,30}$'),
  cedula text not null unique,
  nombres text not null,
  apellidos text not null,
  fecha_nacimiento date,
  email text not null unique,
  telefono text not null,
  departamento text not null,
  municipio text not null,
  barrio text not null,
  direccion text not null,
  password_hash text not null,
  bio text not null default '' check (char_length(bio) <= 280),
  es_oficial boolean not null default false,
  consentimiento_en timestamptz not null,
  creado_en timestamptz not null default now()
);

create table if not exists seguidores (
  seguidor_id uuid not null references miembros(id) on delete cascade,
  seguido_id uuid not null references miembros(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (seguidor_id, seguido_id),
  check (seguidor_id <> seguido_id)
);

create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  tipo text not null check (tipo in ('municipio', 'barrio')),
  creado_en timestamptz not null default now()
);

create table if not exists grupo_miembros (
  grupo_id uuid not null references grupos(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  primary key (grupo_id, miembro_id)
);

create table if not exists publicaciones (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references miembros(id) on delete cascade,
  grupo_id uuid references grupos(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000),
  creado_en timestamptz not null default now()
);
create index if not exists publicaciones_creado_idx on publicaciones (creado_en desc);
create index if not exists publicaciones_autor_idx on publicaciones (autor_id);

create table if not exists me_gusta (
  publicacion_id uuid not null references publicaciones(id) on delete cascade,
  miembro_id uuid not null references miembros(id) on delete cascade,
  primary key (publicacion_id, miembro_id)
);

create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references publicaciones(id) on delete cascade,
  autor_id uuid not null references miembros(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  creado_en timestamptz not null default now()
);
create index if not exists comentarios_pub_idx on comentarios (publicacion_id, creado_en);

alter table miembros enable row level security;
alter table seguidores enable row level security;
alter table grupos enable row level security;
alter table grupo_miembros enable row level security;
alter table publicaciones enable row level security;
alter table me_gusta enable row level security;
alter table comentarios enable row level security;

-- Cuenta oficial de María Fernanda Cabal: nadie puede iniciar sesión en ella (el hash no es válido);
-- sus publicaciones las hace el equipo desde el panel administrativo.
insert into miembros (usuario, cedula, nombres, apellidos, email, telefono, departamento, municipio, barrio, direccion, password_hash, bio, es_oficial, consentimiento_en)
values ('mariafernandacabal', 'oficial', 'María Fernanda', 'Cabal', 'oficial@escuelalibertad.invalid', '0', 'Colombia', 'Colombia', '-', '-', 'sin-acceso',
        'Cuenta oficial. Construimos libertad a través de la educación.', true, now())
on conflict (usuario) do nothing;

-- ============================================================
-- documentos.sql
-- ============================================================
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

-- ============================================================
-- gestor-documental.sql
-- ============================================================
-- Gestor documental: carpetas, metadatos, versiones, papelera e historial sobre la biblioteca de Documentos.
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
-- A quién pertenece la información: la alianza, los partidos o el gremio ganadero. La búsqueda y las preguntas pueden limitarse a uno.
alter table documentos add column if not exists ambito text not null default 'alianza' check (ambito in ('alianza', 'partidos', 'gremio'));

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

-- ============================================================
-- elecciones.sql
-- ============================================================
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
language sql stable security invoker set search_path = public set statement_timeout = '120s' as $$
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

-- Aviso entre tramos (recomendado): la extensión pg_net hace que Postgres llame a la aplicación para pedir el siguiente tramo. Esa
-- llamada llega desde fuera de Vercel, así que no choca con su límite de cinco funciones encadenadas (HTTP 508) y la carga sigue
-- sola todo el tiempo que haga falta, aunque se cierre la pantalla. Si pg_net no está disponible, no pasa nada: la carga sigue por
-- tramos de cinco y se retoma con «Continuar».
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net no está disponible: la carga seguirá por tramos de cinco y se retomará con Continuar.';
end
$$;

create or replace function carga_siguiente(p_url text, p_cadena text, p_enfriar boolean default false, p_turno integer default null)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return net.http_post(
    url := p_url,
    body := jsonb_build_object('cadena', p_cadena, 'enfriar', p_enfriar, 'turno', p_turno),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || p_cadena,
      'Origin', substring(p_url from '^https?://[^/]+')
    ),
    timeout_milliseconds := 10000
  );
end
$$;

revoke all on function carga_siguiente(text, text, boolean, integer) from public, anon, authenticated;
grant execute on function carga_siguiente(text, text, boolean, integer) to service_role;

-- ¿Está instalado el aviso automático? (lo consulta el panel para saber si la carga puede seguir sola sin límite de tramos)
create or replace function carga_aviso_disponible()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$ select exists (select 1 from pg_extension where extname = 'pg_net') $$;

revoke all on function carga_aviso_disponible() from public, anon, authenticated;
grant execute on function carga_aviso_disponible() to service_role;
-- [carga:fin]

-- Nada de esto es público: solo el servidor (service role) lo toca.
revoke all on catalogo_electoral, resultados_electorales from anon, authenticated;
revoke all on partidos_electorales, candidatos_electorales, ganadores_electorales from anon, authenticated;
revoke all on function cobertura_electoral() from public, anon, authenticated;

-- Candidatos más votados de un cargo (p. ej. concejales): recorre los resultados guardados en el nivel donde se elige el cargo y devuelve
-- los de más votos, de todo el país o de un departamento (p_prefijo = código del ámbito), con búsqueda por nombre.
drop function if exists candidatos_mas_votados(text, text, integer, text, text, integer);
create or replace function candidatos_mas_votados(p_eleccion text, p_corporacion text, p_nivel integer default 3, p_prefijo text default '', p_busqueda text default '', p_limite integer default 100, p_partido text default '', p_lugar text default '')
returns table (ambito text, ambito_nombre text, partido text, candidato text, cedula text, votos integer, pct text)
language sql stable security invoker set search_path = public as $$
  select r.ambito, r.ambito_nombre, p.valor ->> 'nombre', c.valor ->> 'nombre', c.valor ->> 'cedula', (c.valor ->> 'votos')::integer, c.valor ->> 'pct'
  from resultados_electorales r
  cross join lateral jsonb_array_elements(coalesce(r.datos -> 'circunscripciones' -> 0 -> 'partidos', '[]'::jsonb)) as p(valor)
  cross join lateral jsonb_array_elements(coalesce(p.valor -> 'candidatos', '[]'::jsonb)) as c(valor)
  where r.eleccion = p_eleccion
    and r.corporacion = p_corporacion
    and r.nivel = p_nivel
    and not r.vacio
    and r.ambito like coalesce(p_prefijo, '') || '%'
    and coalesce((c.valor ->> 'soloLista')::boolean, false) = false
    and (coalesce(p_busqueda, '') = '' or lower(c.valor ->> 'nombre') like '%' || lower(p_busqueda) || '%')
    and (coalesce(p_partido, '') = '' or translate(lower(p.valor ->> 'nombre'), 'áéíóúü', 'aeiouu') like '%' || translate(lower(p_partido), 'áéíóúü', 'aeiouu') || '%')
    and (coalesce(p_lugar, '') = '' or translate(lower(r.ambito_nombre), 'áéíóúü', 'aeiouu') like '%' || translate(lower(p_lugar), 'áéíóúü', 'aeiouu') || '%')
  order by (c.valor ->> 'votos')::integer desc nulls last
  limit greatest(1, least(coalesce(p_limite, 100), 500))
$$;
revoke all on function candidatos_mas_votados(text, text, integer, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function candidatos_mas_votados(text, text, integer, text, text, integer, text, text) to service_role;

-- ============================================================
-- territorio.sql
-- ============================================================
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

-- ============================================================
-- portales.sql
-- ============================================================
-- Portales: generador, controlador y desplegador de portales temáticos, más su centro de operaciones: cada portal es un CMS
-- independiente (artículos, publicidad y ajustes propios) y todos comparten esta misma base de datos.
-- Pegar completo en Supabase > SQL Editor > Run (una sola vez; se puede repetir sin problema, solo agrega lo que falte).
-- Requiere haber ejecutado antes supabase/comunidad.sql: la atribución de afiliados a cada portal usa la tabla «miembros».
-- Se accede solo desde el servidor con la service role key: RLS queda ACTIVADO y sin políticas, así la llave pública (anon)
-- no puede leer ni escribir nada.

create extension if not exists pgcrypto;

create table if not exists portales (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  nombre text not null check (char_length(nombre) between 2 and 80),
  plantilla text not null check (plantilla in ('salud', 'belleza', 'motos-autos', 'hogar-cuidado')),
  estado text not null default 'borrador' check (estado in ('borrador', 'publicado', 'pausado')),
  config jsonb not null default '{}'::jsonb,
  version int not null default 0,
  eventos jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  publicado_en timestamptz
);

create index if not exists portales_estado_idx on portales (estado);

-- Ajustes del CMS de cada portal: llamado a unirse a la comunidad, guía de la IA, buscadores...
create table if not exists portal_ajustes (
  portal_id uuid primary key references portales(id) on delete cascade,
  ajustes jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

-- Artículos de cada portal (el cuerpo es markdown). Los generados con IA quedan marcados y no se publican sin revisión.
create table if not exists portal_articulos (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portales(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{3,90}$'),
  titulo text not null check (char_length(titulo) between 3 and 160),
  resumen text not null default '' check (char_length(resumen) <= 400),
  cuerpo text not null default '' check (char_length(cuerpo) <= 60000),
  categoria text not null default '',
  tipo text not null default '',
  etiquetas text[] not null default '{}',
  estado text not null default 'borrador' check (estado in ('borrador', 'publicado', 'archivado')),
  destacado boolean not null default false,
  generado_con_ia boolean not null default false,
  revisado boolean not null default false,
  autor text not null default '',
  seo_descripcion text not null default '' check (char_length(seo_descripcion) <= 200),
  vistas integer not null default 0,
  publicado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (portal_id, slug)
);

create index if not exists portal_articulos_lista_idx on portal_articulos (portal_id, estado, publicado_en desc);

-- Anuncios de cada portal, por espacio publicitario (cabecera, lateral, dentro del artículo, antes del pie).
create table if not exists portal_anuncios (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portales(id) on delete cascade,
  espacio text not null check (char_length(espacio) between 2 and 30),
  nombre text not null check (char_length(nombre) between 2 and 80),
  anunciante text not null default '' check (char_length(anunciante) <= 80),
  formato text not null default 'texto' check (formato in ('texto', 'imagen')),
  titulo text not null default '' check (char_length(titulo) <= 90),
  texto text not null default '' check (char_length(texto) <= 220),
  boton text not null default '' check (char_length(boton) <= 30),
  imagen_url text not null default '' check (char_length(imagen_url) <= 500),
  destino_url text not null check (destino_url ~* '^https?://' and char_length(destino_url) <= 500),
  desde date,
  hasta date,
  estado text not null default 'activo' check (estado in ('activo', 'pausado')),
  prioridad smallint not null default 1 check (prioridad between 1 and 10),
  impresiones integer not null default 0,
  clics integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (desde is null or hasta is null or desde <= hasta)
);

create index if not exists portal_anuncios_espacio_idx on portal_anuncios (portal_id, espacio, estado);

-- Métricas diarias por portal (vistas, clics en «Súmate» y clics en anuncios): un contador por día, sin guardar visitas una a una.
create table if not exists portal_metricas (
  portal_id uuid not null references portales(id) on delete cascade,
  dia date not null default current_date,
  vistas integer not null default 0,
  cta_clics integer not null default 0,
  anuncio_clics integer not null default 0,
  primary key (portal_id, dia)
);

-- Qué portal trajo a cada afiliado de la comunidad (el último portal por el que entró al formulario de afiliación).
create table if not exists portal_adeptos (
  miembro_id uuid primary key references miembros(id) on delete cascade,
  portal_id uuid not null references portales(id) on delete cascade,
  creado_en timestamptz not null default now()
);

create index if not exists portal_adeptos_portal_idx on portal_adeptos (portal_id, creado_en desc);

alter table portales enable row level security;
alter table portal_ajustes enable row level security;
alter table portal_articulos enable row level security;
alter table portal_anuncios enable row level security;
alter table portal_metricas enable row level security;
alter table portal_adeptos enable row level security;

-- Cuenta una visita, un clic en «Súmate» o un clic en un anuncio, en una sola llamada. «p_evento»: 'vista' (suma la vista del
-- portal, la del artículo y una impresión a cada anuncio mostrado), 'cta' o 'anuncio'.
create or replace function portal_registrar(p_portal uuid, p_evento text, p_articulo uuid default null, p_anuncios uuid[] default '{}')
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into portal_metricas (portal_id, dia) values (p_portal, current_date) on conflict do nothing;
  if p_evento = 'vista' then
    update portal_metricas set vistas = vistas + 1 where portal_id = p_portal and dia = current_date;
    if p_articulo is not null then
      update portal_articulos set vistas = vistas + 1 where id = p_articulo and portal_id = p_portal;
    end if;
    if coalesce(array_length(p_anuncios, 1), 0) > 0 then
      update portal_anuncios set impresiones = impresiones + 1 where portal_id = p_portal and id = any (p_anuncios);
    end if;
  elsif p_evento = 'cta' then
    update portal_metricas set cta_clics = cta_clics + 1 where portal_id = p_portal and dia = current_date;
  elsif p_evento = 'anuncio' then
    update portal_metricas set anuncio_clics = anuncio_clics + 1 where portal_id = p_portal and dia = current_date;
    update portal_anuncios set clics = clics + 1 where portal_id = p_portal and id = any (p_anuncios);
  end if;
end $$;

-- Una fila por portal con sus cifras (lo usa el centro de operaciones).
create or replace function portal_resumen()
returns table (portal_id uuid, publicados bigint, borradores bigint, lecturas bigint, vistas_30d bigint, cta_30d bigint, anuncio_clics_30d bigint, anuncios_activos bigint, adeptos bigint, adeptos_30d bigint)
language sql stable security invoker set search_path = public as $$
  select p.id,
    (select count(*) from portal_articulos a where a.portal_id = p.id and a.estado = 'publicado'),
    (select count(*) from portal_articulos a where a.portal_id = p.id and a.estado = 'borrador'),
    coalesce((select sum(a.vistas) from portal_articulos a where a.portal_id = p.id), 0)::bigint,
    coalesce((select sum(m.vistas) from portal_metricas m where m.portal_id = p.id and m.dia > current_date - 30), 0)::bigint,
    coalesce((select sum(m.cta_clics) from portal_metricas m where m.portal_id = p.id and m.dia > current_date - 30), 0)::bigint,
    coalesce((select sum(m.anuncio_clics) from portal_metricas m where m.portal_id = p.id and m.dia > current_date - 30), 0)::bigint,
    (select count(*) from portal_anuncios n where n.portal_id = p.id and n.estado = 'activo'
       and (n.desde is null or n.desde <= current_date) and (n.hasta is null or n.hasta >= current_date)),
    (select count(*) from portal_adeptos d where d.portal_id = p.id),
    (select count(*) from portal_adeptos d where d.portal_id = p.id and d.creado_en > now() - interval '30 days')
  from portales p
$$;

-- Nada de esto es público: solo el servidor (service role) lo toca.
revoke all on portales, portal_ajustes, portal_articulos, portal_anuncios, portal_metricas, portal_adeptos from anon, authenticated;
revoke all on function portal_registrar(uuid, text, uuid, uuid[]) from public, anon, authenticated;
revoke all on function portal_resumen() from public, anon, authenticated;

-- ============================================================
-- portales-crm.sql
-- ============================================================
-- CRM de los portales: cada portal tiene su propia base de contactos (la gente que se suma a su comunidad), con etapas,
-- historial de cada persona, y su agenda de eventos con inscripciones. Todos los portales comparten estas tablas y cada fila
-- lleva su portal_id: los contactos de un portal nunca se mezclan con los de otro.
-- Pegar completo en Supabase > SQL Editor > Run (una sola vez; se puede repetir sin problema, solo agrega lo que falte).
-- Requiere haber ejecutado antes supabase/portales.sql (y, antes, supabase/comunidad.sql).
-- Se accede solo desde el servidor con la service role key: RLS queda ACTIVADO y sin políticas, así la llave pública (anon)
-- no puede leer ni escribir nada (hay correos y teléfonos).

create extension if not exists pgcrypto;

-- Personas de la comunidad de cada portal. Se guarda solo lo que la persona entregó y su consentimiento (Ley 1581 de 2012).
create table if not exists portal_contactos (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portales(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 120),
  email text check (email is null or (char_length(email) <= 160 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  telefono text not null default '' check (char_length(telefono) <= 30),
  ciudad text not null default '' check (char_length(ciudad) <= 80),
  departamento text not null default '' check (char_length(departamento) <= 80),
  intereses text[] not null default '{}',
  etiquetas text[] not null default '{}',
  etapa text not null default 'nuevo' check (etapa in ('nuevo', 'interesado', 'activo', 'lider', 'inactivo')),
  origen text not null default 'manual' check (origen in ('formulario', 'evento', 'articulo', 'afiliacion', 'importado', 'manual')),
  acepta_comunicaciones boolean not null default false,
  consentimiento_en timestamptz,
  notas text not null default '' check (char_length(notas) <= 2000),
  ultimo_contacto timestamptz,
  miembro_id uuid references miembros(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (email is not null or telefono <> '')
);

create unique index if not exists portal_contactos_email_uq on portal_contactos (portal_id, lower(email)) where email is not null;
create index if not exists portal_contactos_lista_idx on portal_contactos (portal_id, creado_en desc);
create index if not exists portal_contactos_etapa_idx on portal_contactos (portal_id, etapa);

-- Historial de cada persona: notas, llamadas, cambios de etapa, eventos a los que se inscribió o asistió.
create table if not exists portal_interacciones (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portales(id) on delete cascade,
  contacto_id uuid not null references portal_contactos(id) on delete cascade,
  tipo text not null check (tipo in ('nota', 'llamada', 'mensaje', 'reunion', 'etapa', 'evento', 'sistema')),
  texto text not null check (char_length(texto) between 1 and 2000),
  autor text not null default '' check (char_length(autor) <= 80),
  creado_en timestamptz not null default now()
);

create index if not exists portal_interacciones_contacto_idx on portal_interacciones (contacto_id, creado_en desc);

-- Agenda de eventos del portal (encuentros, charlas, foros, jornadas).
create table if not exists portal_eventos (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portales(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{3,90}$'),
  titulo text not null check (char_length(titulo) between 3 and 160),
  descripcion text not null default '' check (char_length(descripcion) <= 5000),
  categoria text not null default '' check (char_length(categoria) <= 40),
  inicia_en timestamptz not null,
  termina_en timestamptz,
  modalidad text not null default 'presencial' check (modalidad in ('presencial', 'virtual', 'mixta')),
  lugar text not null default '' check (char_length(lugar) <= 160),
  ciudad text not null default '' check (char_length(ciudad) <= 80),
  enlace_virtual text not null default '' check (char_length(enlace_virtual) <= 500),
  cupo integer check (cupo is null or cupo between 1 and 100000),
  estado text not null default 'borrador' check (estado in ('borrador', 'publicado', 'cancelado')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (termina_en is null or termina_en >= inicia_en),
  unique (portal_id, slug)
);

create index if not exists portal_eventos_lista_idx on portal_eventos (portal_id, estado, inicia_en);

-- Quién se inscribió a cada evento y si asistió (la asistencia la marca el equipo del portal).
create table if not exists portal_inscripciones (
  evento_id uuid not null references portal_eventos(id) on delete cascade,
  contacto_id uuid not null references portal_contactos(id) on delete cascade,
  portal_id uuid not null references portales(id) on delete cascade,
  estado text not null default 'inscrito' check (estado in ('inscrito', 'asistio', 'no_asistio', 'cancelado')),
  creado_en timestamptz not null default now(),
  primary key (evento_id, contacto_id)
);

create index if not exists portal_inscripciones_contacto_idx on portal_inscripciones (contacto_id);

alter table portal_contactos enable row level security;
alter table portal_interacciones enable row level security;
alter table portal_eventos enable row level security;
alter table portal_inscripciones enable row level security;

-- ============================================================
-- portales-cms-pro.sql
-- ============================================================
-- CMS avanzado de los portales: portada de cada artículo, programación de publicaciones, flujo de revisión, historial de
-- versiones, biblioteca de medios, páginas fijas y boletines. Todos los portales comparten estas tablas y cada fila lleva su
-- portal_id: lo de un portal nunca se mezcla con lo de otro.
-- Pegar completo en Supabase > SQL Editor > Run (una sola vez; se puede repetir sin problema, solo agrega lo que falte).
-- Requiere haber ejecutado antes supabase/portales.sql y supabase/portales-crm.sql.
-- Se accede solo desde el servidor con la service role key: RLS queda ACTIVADO y sin políticas.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ artículos ---

alter table portal_articulos add column if not exists portada_url text not null default '' check (char_length(portada_url) <= 600);
alter table portal_articulos add column if not exists portada_alt text not null default '' check (char_length(portada_alt) <= 160);
alter table portal_articulos add column if not exists publicar_en timestamptz;
alter table portal_articulos add column if not exists nota_revision text not null default '' check (char_length(nota_revision) <= 500);

-- Dos estados nuevos: «revision» (alguien debe leerlo antes de publicar) y «programado» (se publica solo a su hora).
alter table portal_articulos drop constraint if exists portal_articulos_estado_check;
alter table portal_articulos add constraint portal_articulos_estado_check check (estado in ('borrador', 'revision', 'programado', 'publicado', 'archivado'));

create index if not exists portal_articulos_programados_idx on portal_articulos (portal_id, publicar_en) where estado = 'programado';

-- Historial: una foto del artículo cada vez que se guarda con cambios. Se conservan las más recientes de cada artículo.
create table if not exists portal_articulo_versiones (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portales(id) on delete cascade,
  articulo_id uuid not null references portal_articulos(id) on delete cascade,
  titulo text not null,
  resumen text not null default '',
  cuerpo text not null default '',
  estado text not null default '',
  autor_edicion text not null default '' check (char_length(autor_edicion) <= 120),
  creado_en timestamptz not null default now()
);

create index if not exists portal_articulo_versiones_idx on portal_articulo_versiones (articulo_id, creado_en desc);

-- ------------------------------------------------------------------- medios ---

-- Imágenes del portal (portadas, ilustraciones dentro de los artículos, anuncios). El archivo vive en Storage (bucket público
-- «portal-medios»); aquí queda su registro, su texto alternativo y de quién es.
insert into storage.buckets (id, name, public) values ('portal-medios', 'portal-medios', true) on conflict (id) do nothing;

create table if not exists portal_medios (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portales(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 160),
  ruta text not null check (char_length(ruta) <= 300),
  url text not null check (char_length(url) <= 600),
  tipo text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  bytes integer not null check (bytes >= 0),
  alt text not null default '' check (char_length(alt) <= 160),
  subido_por text not null default '' check (char_length(subido_por) <= 120),
  creado_en timestamptz not null default now()
);

create index if not exists portal_medios_lista_idx on portal_medios (portal_id, creado_en desc);

-- ------------------------------------------------------------------ páginas ---

-- Páginas fijas del portal (Quiénes somos, Preguntas, Cómo participar...). Pueden aparecer en el menú del portal.
create table if not exists portal_paginas (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portales(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{3,60}$'),
  titulo text not null check (char_length(titulo) between 3 and 120),
  resumen text not null default '' check (char_length(resumen) <= 300),
  cuerpo text not null default '' check (char_length(cuerpo) <= 60000),
  estado text not null default 'borrador' check (estado in ('borrador', 'publicado')),
  en_menu boolean not null default false,
  orden smallint not null default 0,
  portada_url text not null default '' check (char_length(portada_url) <= 600),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (portal_id, slug)
);

create index if not exists portal_paginas_lista_idx on portal_paginas (portal_id, estado, orden);

-- ---------------------------------------------------------------- boletines ---

-- Boletines enviados a la comunidad del portal. Solo se escribe a personas que autorizaron comunicaciones; cada envío lleva
-- su enlace para darse de baja.
create table if not exists portal_campanas (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references portales(id) on delete cascade,
  asunto text not null check (char_length(asunto) between 3 and 150),
  cuerpo text not null default '' check (char_length(cuerpo) <= 20000),
  segmento jsonb not null default '{}'::jsonb,
  estado text not null default 'borrador' check (estado in ('borrador', 'enviando', 'enviada', 'fallida')),
  destinatarios integer not null default 0,
  enviados integer not null default 0,
  fallidos integer not null default 0,
  enviada_en timestamptz,
  creado_por text not null default '' check (char_length(creado_por) <= 120),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists portal_campanas_lista_idx on portal_campanas (portal_id, creado_en desc);

-- Publica los programados cuya hora ya llegó. Lo llama el CMS al listar y el sitio al mostrar artículos (una sola consulta).
create or replace function portal_promover_programados(p_portal uuid, p_ahora timestamptz)
returns void language sql security invoker set search_path = public as $$
  update portal_articulos
     set estado = 'publicado', publicado_en = coalesce(publicar_en, p_ahora), actualizado_en = p_ahora
   where portal_id = p_portal and estado = 'programado' and publicar_en <= p_ahora
$$;

alter table portal_articulo_versiones enable row level security;
alter table portal_medios enable row level security;
alter table portal_paginas enable row level security;
alter table portal_campanas enable row level security;

-- ============================================================
-- monitoreo.sql
-- ============================================================
-- Monitoreo: historial de lo que se encuentra de cada político (videos, titulares, cruces con María Fernanda).
-- Pegar completo en Supabase > SQL Editor > Run (se puede repetir sin problema).
-- Todo se accede solo desde el servidor (service role): RLS activado y sin políticas.

create table if not exists monitoreo_items (
  personaje text not null,                 -- id del político en la lista base (petro, cepeda, uribe...)
  tipo text not null,                      -- video | dicho (declaración en prensa) | cruce | prensa | x
  enlace text not null,
  titulo text not null,
  medio text,
  fecha timestamptz not null,
  vistas integer,
  nombra boolean not null default false,   -- el texto disponible nombra a María Fernanda
  donde text,                              -- título | descripción
  contexto text,                           -- fragmento donde la nombran
  visto_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  primary key (personaje, tipo, enlace)
);

create index if not exists monitoreo_items_personaje_idx on monitoreo_items (personaje, tipo, fecha desc);

alter table monitoreo_items enable row level security;
revoke all on monitoreo_items from anon, authenticated;

-- Archivo de menciones: las cifras, la miniatura, el canal y sus seguidores y el tono (medido por la IA o estimado) de cada mención
-- se guardan una sola vez, así no hay que volver a analizarlas (ni gastar la IA) cada vez que se abre el panel.
alter table monitoreo_items add column if not exists datos jsonb;
alter table monitoreo_items add column if not exists tono text check (tono in ('positivo', 'neutral', 'negativo'));
alter table monitoreo_items add column if not exists tono_ia boolean not null default false;
create index if not exists monitoreo_items_tono_idx on monitoreo_items (personaje, tipo, tono_ia);

-- ============================================================
-- usuarios.sql
-- ============================================================
-- Usuarios del panel administrativo: personas con su propio correo y clave (la clave se guarda con hash, nunca en texto).
-- Pegar completo en Supabase > SQL Editor > Run (se puede repetir sin problema).
-- Todo se accede solo desde el servidor (service role): RLS activado y sin políticas.

create table if not exists admin_usuarios (
  email text primary key,
  nombre text not null default '',
  clave_hash text not null,
  activo boolean not null default true,
  creado_por text,
  creado_en timestamptz not null default now(),
  ultimo_ingreso timestamptz
);

alter table admin_usuarios enable row level security;
revoke all on admin_usuarios from anon, authenticated;

-- Rol del usuario: define qué secciones del panel ve (direccion, investigacion, contenidos, formacion, juridico, territorial).
alter table admin_usuarios add column if not exists rol text not null default 'direccion';

-- Clave temporal: quien entra con ella debe cambiarla antes de usar el panel.
alter table admin_usuarios add column if not exists cambiar_clave boolean not null default false;

-- ============================================================
-- piloto.sql
-- ============================================================
-- Bitácora del piloto de IA: cada tarea que el equipo hizo con apoyo de la IA, cuánto tardó, cuánto costó y qué tan precisa fue.
-- Pegar completo en Supabase > SQL Editor > Run (se puede repetir sin problema).
-- Todo se accede solo desde el servidor (service role): RLS activado y sin políticas.

create table if not exists piloto_registros (
  id bigint generated always as identity primary key,
  fecha date not null default current_date,
  tarea text not null,                       -- qué se hizo (p. ej. «resumen de acta», «borrador de comunicado»)
  area text not null default 'otra',         -- investigacion, contenidos, formacion, juridico, territorial, otra
  minutos_sin_ia integer not null check (minutos_sin_ia >= 0),  -- lo que habría tomado sin IA (estimado)
  minutos_con_ia integer not null check (minutos_con_ia >= 0),  -- lo que tomó con IA
  costo_cop numeric not null default 0,      -- gasto en herramientas de IA atribuible a la tarea
  precision smallint check (precision between 1 and 5),         -- 1 = muy impreciso, 5 = sin errores
  errores integer not null default 0,        -- errores detectados en la revisión humana
  nota text,
  usuario text,
  creado_en timestamptz not null default now()
);

create index if not exists piloto_registros_fecha_idx on piloto_registros (fecha desc);

alter table piloto_registros enable row level security;
revoke all on piloto_registros from anon, authenticated;

-- ============================================================
-- camaras.sql
-- ============================================================
-- Cámaras de comercio: una fila por cámara con lo que reporta el Registro Único Empresarial y Social (RUES, Confecámaras) en datos.gov.co:
-- matrículas, cuántas siguen activas, cómo se reparten entre personas naturales, sociedades y entidades sin ánimo de lucro, y los
-- establecimientos activos. Las cifras son por cámara (su jurisdicción puede cubrir varios municipios), no por municipio.
-- Pegar completo en Supabase > SQL Editor > Run (se puede repetir sin problema).
-- Todo se accede solo desde el servidor (service role): RLS activado y sin políticas.

create table if not exists camaras_comercio (
  codigo text primary key,                  -- código de la cámara en el RUES (01 = Armenia...)
  nombre text not null,                     -- tal como la publica el RUES
  sede text,                                -- ciudad sede
  departamento text,
  dane text,                                -- código DANE del municipio sede (5 dígitos), si se pudo ubicar
  total bigint not null default 0,          -- matrículas de personas y entidades, en cualquier estado
  activas bigint not null default 0,
  canceladas bigint not null default 0,
  personas_naturales bigint not null default 0,   -- activas
  sociedades bigint not null default 0,           -- activas (SAS, Ltda., S.A., unipersonales...)
  esadl bigint not null default 0,                -- activas: entidades sin ánimo de lucro y de economía solidaria
  establecimientos bigint not null default 0,     -- establecimientos, agencias y sucursales activos
  organizaciones jsonb,                     -- activas por tipo de organización jurídica
  fuente text,
  actualizado_en timestamptz not null default now()
);

alter table camaras_comercio enable row level security;
revoke all on camaras_comercio from anon, authenticated;

-- ============================================================
-- redactor.sql
-- ============================================================
-- Redactor: borradores de notas escritos con o sin IA, con el material del periodista y la auditoría del texto.
-- Pegar completo en Supabase > SQL Editor > Run (se puede repetir sin problema).
-- Todo se accede solo desde el servidor (service role): RLS activado y sin políticas.

create table if not exists redactor_notas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  resumen text not null default '',
  cuerpo text not null default '',           -- markdown: subtítulos con «##»
  claves text[] not null default '{}',
  palabra_clave text not null default '',
  portada_url text not null default '',
  portada_alt text not null default '',
  seccion text not null default '',
  region text not null default '',
  seo_titulo text not null default '',
  seo_descripcion text not null default '',
  grafica jsonb,                              -- { tipo, titulo, fuente, datos: [{ etiqueta, valor }] }
  material text not null default '',          -- lo que aportó el periodista: la única base de los hechos
  fuentes jsonb not null default '[]',        -- [{ titulo, url }] del dossier verificado
  modo text not null default 'manual' check (modo in ('manual', 'ia')),
  tono text not null default 'institucional',
  estado text not null default 'borrador' check (estado in ('borrador', 'revision', 'aprobada', 'publicada', 'enviada')),
  generada_con_ia boolean not null default false,
  revisada boolean not null default false,
  portal_id uuid,                             -- portal al que se envió como borrador
  autor text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Tipo de pieza: nota, x, instagram, facebook, tiktok, columna, discurso o bullets (ayuda de memoria para entrevistas).
alter table redactor_notas add column if not exists formato text not null default 'nota';

create index if not exists redactor_notas_actualizado_idx on redactor_notas (actualizado_en desc);

alter table redactor_notas enable row level security;
revoke all on redactor_notas from anon, authenticated;

-- Flujo del equipo de redacción y redes: borrador -> revisión -> aprobada (la aprueba Dirección) -> publicada (se publica a mano y se anota el enlace).
alter table redactor_notas drop constraint if exists redactor_notas_estado_check;
alter table redactor_notas add constraint redactor_notas_estado_check check (estado in ('borrador', 'revision', 'aprobada', 'publicada', 'enviada'));
alter table redactor_notas add column if not exists programada_para timestamptz;   -- cuándo se piensa publicar
alter table redactor_notas add column if not exists aprobada_por text;
alter table redactor_notas add column if not exists aprobada_en timestamptz;
alter table redactor_notas add column if not exists enlace_publicado text;
alter table redactor_notas add column if not exists publicada_en timestamptz;
alter table redactor_notas add column if not exists nota_revision text;             -- por qué se devolvió

-- Guía de voz de María Fernanda: la escribe y la mantiene el equipo; se le entrega a la IA en cada redacción para el tono y el vocabulario
-- (nunca como fuente de hechos). Es una sola fila.
create table if not exists redactor_guia (
  id text primary key default 'principal',
  voz text not null default '',
  mensajes text not null default '',
  lineas_rojas text not null default '',
  hashtags text not null default '',
  cuentas text not null default '',
  actualizado_en timestamptz not null default now(),
  actualizado_por text
);

alter table redactor_guia enable row level security;
revoke all on redactor_guia from anon, authenticated;

-- ============================================================
-- voz.sql
-- ============================================================
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

-- ============================================================
-- proyeccion.sql
-- ============================================================
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

-- ============================================================
-- crm.sql
-- ============================================================
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
