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
