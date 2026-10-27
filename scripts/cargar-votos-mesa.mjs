// Carga a Supabase (tabla votos_mesa, ver supabase/votos-mesa.sql) el CSV de votos por mesa del escrutinio.
// Uso: node scripts/cargar-votos-mesa.mjs <archivo.csv> <año> <etapa>      p. ej.  ... votos-mesa-maria-fernanda-cabal.csv 2022 escrutinio
// Con ENV_FILE=/ruta/.env.local se usa ese archivo en vez de .env.local.
// Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del entorno o de .env.local. Se puede repetir: actualiza lo que ya está.
import { readFileSync, existsSync } from "node:fs";

const [archivo, anio, etapa] = process.argv.slice(2);
if (!archivo || !/^\d{4}$/.test(anio ?? "") || !["preconteo", "escrutinio"].includes(etapa)) {
  console.error("Uso: node scripts/cargar-votos-mesa.mjs <archivo.csv> <año> <preconteo|escrutinio>");
  process.exit(1);
}
const envLocal = process.env.ENV_FILE ? new URL(`file://${process.env.ENV_FILE}`) : new URL("../.env.local", import.meta.url); // ENV_FILE=/ruta/.env.local para usar otro
if (existsSync(envLocal)) {
  for (const l of readFileSync(envLocal, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) { console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }

// El Excel trae los nombres cortados o con «?» en lugar de la ñ.
const DEPARTAMENTOS = { "NARI?O": "NARIÑO", "NORTE DE SAN": "NORTE DE SANTANDER" };

function filasCsv(texto) {
  const filas = []; let fila = [], campo = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; } else campo += c; }
    else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo.replace(/\r$/, "")); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}
const [, ...datos] = filasCsv(readFileSync(archivo, "utf8")).filter((f) => f.length > 1);
const num = (v) => Number(v);
const mapa = new Map(); // la llave primaria no admite repetidos dentro de un mismo envío: los consulados vienen sin municipio ni nombre de puesto, así que sus votos se suman
for (const f of datos) {
  const departamento = DEPARTAMENTOS[f[0]] ?? f[0];
  const r = { anio: Number(anio), etapa, corporacion: f[6], circunscripcion: f[7], candidato: f[10], agrupacion: f[8] || null, posicion: f[9] ? num(f[9]) : null, departamento, municipio: f[1], zona: num(f[2]), puesto: f[3], nombre_puesto: f[4] || null, mesa: num(f[5]), votos: num(f[11]) };
  const k = [r.corporacion, r.candidato, r.departamento, r.municipio, r.zona, r.puesto, r.mesa].join("|");
  const previa = mapa.get(k);
  if (previa) previa.votos += r.votos;
  else mapa.set(k, r);
}
const filas = [...mapa.values()];
console.log(`${datos.length} filas leídas, ${filas.length} mesas (las repetidas se sumaron), ${filas.reduce((a, f) => a + f.votos, 0).toLocaleString("es-CO")} votos. Subiendo…`);
const TAM = 2000;
for (let i = 0; i < filas.length; i += TAM) {
  const r = await fetch(`${url}/rest/v1/votos_mesa?on_conflict=anio,etapa,corporacion,candidato,departamento,municipio,zona,puesto,mesa`, {
    method: "POST",
    headers: { apikey: llave, Authorization: `Bearer ${llave}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(filas.slice(i, i + TAM)),
  });
  if (!r.ok) { console.error(`Falló en la fila ${i}: ${r.status} ${(await r.text()).slice(0, 300)}`); process.exit(1); }
  process.stdout.write(`\r${Math.min(i + TAM, filas.length)} / ${filas.length}`);
}
console.log("\nListo.");
