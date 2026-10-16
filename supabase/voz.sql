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
