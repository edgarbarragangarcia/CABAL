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
  estado text not null default 'borrador' check (estado in ('borrador', 'revision', 'enviada')),
  generada_con_ia boolean not null default false,
  revisada boolean not null default false,
  portal_id uuid,                             -- portal al que se envió como borrador
  autor text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists redactor_notas_actualizado_idx on redactor_notas (actualizado_en desc);

alter table redactor_notas enable row level security;
revoke all on redactor_notas from anon, authenticated;
