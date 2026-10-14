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
