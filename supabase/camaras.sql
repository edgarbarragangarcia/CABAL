-- Cámaras de comercio: una fila por cámara con lo que reporta el Registro Único Empresarial y Social (RUES, Confecámaras) en datos.gov.co:
-- matrículas, cuántas siguen activas, cómo se reparten entre personas naturales, sociedades y entidades sin ánimo de lucro, y los
-- establecimientos activos. Las cifras son por cámara (su jurisdicción puede cubrir varios municipios), no por municipio.
-- Pegar completo en Supabase > SQL Editor > Run (se puede repetir sin problema).
-- Todo se accede solo desde el servidor (service role): RLS activado y sin políticas.

create table if not exists camaras_comercio (
  codigo text primary key,                  -- código de la cámara en el RUES (01 = Armenia...)
  nombre text not null,                     -- tal como la publica el RUES
  sede text,                                -- ciudad sede
  departamento text,
  dane text,                                -- código DANE del municipio sede (5 dígitos), si se pudo ubicar
  total bigint not null default 0,          -- matrículas de personas y entidades, en cualquier estado
  activas bigint not null default 0,
  canceladas bigint not null default 0,
  personas_naturales bigint not null default 0,   -- activas
  sociedades bigint not null default 0,           -- activas (SAS, Ltda., S.A., unipersonales...)
  esadl bigint not null default 0,                -- activas: entidades sin ánimo de lucro y de economía solidaria
  establecimientos bigint not null default 0,     -- establecimientos, agencias y sucursales activos
  organizaciones jsonb,                     -- activas por tipo de organización jurídica
  fuente text,
  actualizado_en timestamptz not null default now()
);

alter table camaras_comercio enable row level security;
revoke all on camaras_comercio from anon, authenticated;
