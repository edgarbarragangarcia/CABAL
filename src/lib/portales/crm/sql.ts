/** Copia exacta de supabase/portales-crm.sql: el panel la muestra para pegarla en el editor SQL de Supabase. */
export const SQL_PORTALES_CRM = `-- CRM de los portales: cada portal tiene su propia base de contactos (la gente que se suma a su comunidad), con etapas,
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
  email text check (email is null or (char_length(email) <= 160 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$')),
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
`;
