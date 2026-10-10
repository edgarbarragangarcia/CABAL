-- Portales: generador, controlador y desplegador de portales temáticos (plantillas de demostración).
-- Pegar completo en Supabase > SQL Editor > Run (una sola vez). Se accede solo desde el servidor con la service role key:
-- RLS queda ACTIVADO y sin políticas, así la llave pública (anon) no puede leer ni escribir nada.

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

alter table portales enable row level security;
