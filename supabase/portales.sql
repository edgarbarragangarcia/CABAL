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
