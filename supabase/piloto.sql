-- Bitácora del piloto de IA: cada tarea que el equipo hizo con apoyo de la IA, cuánto tardó, cuánto costó y qué tan precisa fue.
-- Pegar completo en Supabase > SQL Editor > Run (se puede repetir sin problema).
-- Todo se accede solo desde el servidor (service role): RLS activado y sin políticas.

create table if not exists piloto_registros (
  id bigint generated always as identity primary key,
  fecha date not null default current_date,
  tarea text not null,                       -- qué se hizo (p. ej. «resumen de acta», «borrador de comunicado»)
  area text not null default 'otra',         -- investigacion, contenidos, formacion, juridico, territorial, otra
  minutos_sin_ia integer not null check (minutos_sin_ia >= 0),  -- lo que habría tomado sin IA (estimado)
  minutos_con_ia integer not null check (minutos_con_ia >= 0),  -- lo que tomó con IA
  costo_cop numeric not null default 0,      -- gasto en herramientas de IA atribuible a la tarea
  precision smallint check (precision between 1 and 5),         -- 1 = muy impreciso, 5 = sin errores
  errores integer not null default 0,        -- errores detectados en la revisión humana
  nota text,
  usuario text,
  creado_en timestamptz not null default now()
);

create index if not exists piloto_registros_fecha_idx on piloto_registros (fecha desc);

alter table piloto_registros enable row level security;
revoke all on piloto_registros from anon, authenticated;
