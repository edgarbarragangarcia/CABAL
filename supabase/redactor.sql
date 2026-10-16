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
