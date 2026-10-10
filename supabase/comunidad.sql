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
