// Crea (o actualiza) en Supabase Auth al administrador principal del panel, con el correo y la clave de TU archivo .env.local.
// La clave nunca sale de tu computador: se lee del archivo y viaja solo a tu proyecto de Supabase.
//
// Deja al usuario marcado como administrador principal en Supabase Auth (app_metadata.principal): así el panel no necesita la variable ADMIN_EMAIL en Vercel.
// En .env.local deben estar (cada una en su línea, sin comillas):
//   ADMIN_EMAIL=tucorreo@dominio.com
//   ADMIN_PASSWORD=la-clave-que-quieras-usar
//   SUPABASE_URL=https://TU-PROYECTO.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=...        (Supabase > Project Settings > API > service_role)
// Uso:  node --env-file=.env.local scripts/crear-admin.mjs
const { ADMIN_EMAIL, ADMIN_PASSWORD, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const faltan = ["ADMIN_EMAIL", "ADMIN_PASSWORD", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
if (faltan.length) {
  console.error(`Faltan en .env.local: ${faltan.join(", ")}`);
  process.exit(1);
}
const base = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users`;
const cabeceras = { "Content-Type": "application/json", apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
const correo = ADMIN_EMAIL.trim().toLowerCase();

const lista = await fetch(`${base}?per_page=1000`, { headers: cabeceras });
if (!lista.ok) {
  console.error(`Supabase respondió ${lista.status}: revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.`);
  process.exit(1);
}
const existente = ((await lista.json()).users ?? []).find((u) => u.email?.toLowerCase() === correo);
const r = existente
  ? await fetch(`${base}/${existente.id}`, { method: "PUT", headers: cabeceras, body: JSON.stringify({ password: ADMIN_PASSWORD, email_confirm: true, app_metadata: { principal: true } }) })
  : await fetch(base, { method: "POST", headers: cabeceras, body: JSON.stringify({ email: correo, password: ADMIN_PASSWORD, email_confirm: true, app_metadata: { principal: true } }) });
if (!r.ok) {
  const j = await r.json().catch(() => ({}));
  console.error(`No se pudo ${existente ? "actualizar" : "crear"} al usuario: ${j.msg ?? j.message ?? r.status}`);
  process.exit(1);
}
console.log(`${existente ? "Clave actualizada" : "Usuario creado"} en Supabase Auth: ${correo}`);
