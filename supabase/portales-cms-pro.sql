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
