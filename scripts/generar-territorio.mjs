// Ubicación de los puestos de votación y barrios, para recorrer Territorio de lo general a lo particular.
//
// Fuentes (todas abiertas):
//  - Divipole de las elecciones territoriales 2023 con georreferenciación (datos.gov.co, mv2e-prx5): por puesto, su
//    dirección, coordenadas y la «comuna» o localidad en que votan.
//  - Bogotá: capas oficiales de Catastro Bogotá (serviciosgis.catastrobogota.gov.co): sector catastral (= barrio, 1.230) y
//    localidad (20). Cada puesto de Bogotá se asigna al barrio que lo contiene (punto en polígono).
//
// El nomenclátor de la Registraduría (src/data/elecciones/geo) trae zonas y puestos con su código pero sin barrios, sin
// dirección y con las zonas sin nombre fuera de Bogotá; este script los cruza por nombre dentro de cada municipio.
//
// Salida (se versiona; no hace falta correrlo en el despliegue):
//   src/data/territorio/ubicacion/NN.json  por departamento: { [dane5]: { z: {zona→etiqueta}, p: {puesto→[lat, lon, dirección, barrio?]} } }
//   src/data/territorio/bogota-barrios.json  [[código, nombre, localidad, lat, lon], …]
//
// Uso: node scripts/generar-territorio.mjs   (necesita red; ~1 minuto)
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(root, "src/data/territorio");
const GEO_REFERENCIA = path.join(root, "src/data/elecciones/geo/7999e3f490.json"); // Presidencia 2026 · 2.ª vuelta
const TOKEN = process.env.SOCRATA_APP_TOKEN;
const GIS = "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services";

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function json(url, intentos = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "cabal-territorio/1.0", ...(TOKEN ? { "X-App-Token": TOKEN } : {}) }, signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= intentos) throw new Error(`${url.slice(0, 90)}… → ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

// ------------------------------------------------------------- geometría ---

/** Anillos de un Polygon/MultiPolygon de GeoJSON como lista de polígonos [exterior, ...huecos]. */
const poligonos = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);

function enAnillo([x, y], anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

const enPoligono = (p, poli) => enAnillo(p, poli[0]) && !poli.slice(1).some((h) => enAnillo(p, h));

function caja(g) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poli of poligonos(g)) for (const [x, y] of poli[0]) (x < x0 && (x0 = x), x > x1 && (x1 = x), y < y0 && (y0 = y), y > y1 && (y1 = y));
  return [x0, y0, x1, y1];
}

/** Centroide del anillo exterior más grande (ponderado por área). */
function centroide(g) {
  let mejor = null;
  for (const poli of poligonos(g)) {
    const r = poli[0];
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
      a += f;
      cx += (r[j][0] + r[i][0]) * f;
      cy += (r[j][1] + r[i][1]) * f;
    }
    a /= 2;
    if (!mejor || Math.abs(a) > Math.abs(mejor.a)) mejor = { a, x: cx / (6 * a || 1), y: cy / (6 * a || 1) };
  }
  return mejor ? [mejor.x, mejor.y] : [0, 0];
}

const contiene = (c, p) => {
  const [x0, y0, x1, y1] = c.caja;
  if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) return false;
  return poligonos(c.g).some((poli) => enPoligono(p, poli));
};

// ---------------------------------------------------------------- principal ---

const geo = JSON.parse(await fs.readFile(GEO_REFERENCIA, "utf8"));
const filaDane = (r) => (r.length > 5 ? r[5] : undefined);

// Municipio (DANE) por (departamento, municipio) normalizados, y los puestos del nomenclátor por municipio con su zona.
const dep = new Map();
geo.forEach((r, i) => r[2] === 2 && dep.set(i, norm(r[1])));
const danePorNombre = new Map();
const mpioDeFila = new Map();
geo.forEach((r, i) => {
  if (r[2] === 3 && filaDane(r)) {
    danePorNombre.set(`${dep.get(r[4]) ?? ""}|${norm(r[1])}`, filaDane(r));
    mpioDeFila.set(i, filaDane(r));
  }
});
const puestosNomenclator = new Map(); // dane -> [{ nombre, zona }]
const zonaDe = (i) => {
  const m = /(\d+)\s*$/.exec(geo[i][1]);
  return m ? m[1].padStart(2, "0") : "";
};
geo.forEach((r, i) => {
  if (r[2] !== 6) return;
  const z = r[4];
  const m = mpioDeFila.get(geo[z][4]);
  if (!m) return;
  (puestosNomenclator.get(m) ?? puestosNomenclator.set(m, []).get(m)).push({ nombre: r[1], zona: zonaDe(z) });
});
console.log(`Nomenclátor: ${[...puestosNomenclator.values()].reduce((s, v) => s + v.length, 0)} puestos en ${puestosNomenclator.size} municipios`);

console.log("Divipole 2023 georreferenciado (datos.gov.co)…");
const divipole = await json("https://www.datos.gov.co/resource/mv2e-prx5.json?$limit=20000");
console.log(`  ${divipole.length} filas`);

console.log("Bogotá: sectores catastrales y localidades (Catastro Bogotá)…");
const consulta = (servicio) => `${GIS}/${servicio}/MapServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&geometryPrecision=5&maxAllowableOffset=0.00005&resultRecordCount=2000`;
const [sectores, localidades] = await Promise.all([json(consulta("catastro/sectorcatastral")), json(consulta("ordenamientoterritorial/localidad"))]);
const barrios = sectores.features
  .filter((f) => f.geometry && f.properties.SCANOMBRE && f.properties.SCACODIGO)
  .map((f) => ({ codigo: String(f.properties.SCACODIGO).trim(), nombre: String(f.properties.SCANOMBRE).trim(), g: f.geometry, caja: caja(f.geometry), c: centroide(f.geometry) }));
const locs = localidades.features.map((f) => ({ codigo: String(f.properties.LOCCODIGO).padStart(2, "0"), nombre: f.properties.LOCNOMBRE, g: f.geometry, caja: caja(f.geometry) }));
console.log(`  ${barrios.length} barrios, ${locs.length} localidades`);
if (barrios.length < 1000 || locs.length !== 20) throw new Error("Las capas de Bogotá llegaron incompletas: se aborta para no dejar datos a medias.");

// Localidad de cada barrio: la que contiene su centroide (o la más cercana).
const distancia = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
for (const b of barrios) {
  const l = locs.find((x) => contiene(x, b.c));
  b.loc = l?.codigo ?? locs.map((x) => ({ x, d: distancia(centroide(x.g), b.c) })).sort((p, q) => p.d - q.d)[0].x.codigo;
}

// Divipole -> por municipio: zonas (etiqueta más frecuente por zona del nomenclátor) y puestos (ubicación + barrio).
const porDane = new Map();
const sinMunicipio = new Set();
for (const f of divipole) {
  const dane = danePorNombre.get(`${norm(f.departamento)}|${norm(f.municipio)}`);
  if (!dane) {
    sinMunicipio.add(`${f.departamento}|${f.municipio}`);
    continue;
  }
  (porDane.get(dane) ?? porDane.set(dane, []).get(dane)).push(f);
}
if (sinMunicipio.size) console.log(`  aviso: ${sinMunicipio.size} municipios del Divipole sin código DANE`);

const salida = new Map(); // dep -> { dane -> { z, p } }
let emparejados = 0;
let conBarrio = 0;
let totalPuestos = 0;
for (const [dane, filas] of porDane) {
  const nom = puestosNomenclator.get(dane) ?? [];
  const delNomenclator = new Map(nom.map((p) => [norm(p.nombre), p.zona]));
  totalPuestos += nom.length;
  const p = {};
  const etiquetas = new Map(); // zona -> Map(etiqueta -> n)
  for (const f of filas) {
    const k = norm(f.puesto);
    if (!k || !delNomenclator.has(k) || p[k]) continue;
    emparejados++;
    const lat = Number(f.latitud);
    const lon = Number(f.longitud);
    const tiene = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) > 0.1 && Math.abs(lon) > 0.1;
    const rec = [tiene ? Math.round(lat * 1e5) / 1e5 : null, tiene ? Math.round(lon * 1e5) / 1e5 : null, String(f.direccion ?? "").replace(/\s+/g, " ").trim()];
    if (dane === "11001" && tiene) {
      const b = barrios.find((x) => contiene(x, [lon, lat]));
      if (b) (rec.push(b.codigo), conBarrio++);
    }
    p[k] = rec;
    const zona = delNomenclator.get(k);
    const et = String(f.comuna ?? "").replace(/^\s*\d+\s*/, "").replace(/\s+/g, " ").trim();
    if (zona && et) {
      const m = etiquetas.get(zona) ?? etiquetas.set(zona, new Map()).get(zona);
      m.set(et, (m.get(et) ?? 0) + 1);
    }
  }
  const z = {};
  for (const [zona, m] of etiquetas) z[zona] = [...m].sort((a, b) => b[1] - a[1])[0][0];
  const d = dane.slice(0, 2);
  (salida.get(d) ?? salida.set(d, {}).get(d))[dane] = { z, p };
}
console.log(`Puestos emparejados por nombre: ${emparejados}/${totalPuestos} (${((100 * emparejados) / totalPuestos).toFixed(1)} %); en barrio de Bogotá: ${conBarrio}`);

await fs.rm(SALIDA, { recursive: true, force: true });
await fs.mkdir(path.join(SALIDA, "ubicacion"), { recursive: true });
let bytes = 0;
for (const [d, datos] of salida) {
  const txt = JSON.stringify(datos);
  bytes += txt.length;
  await fs.writeFile(path.join(SALIDA, "ubicacion", `${d}.json`), txt);
}
const catalogo = barrios.map((b) => [b.codigo, b.nombre, b.loc, Math.round(b.c[1] * 1e5) / 1e5, Math.round(b.c[0] * 1e5) / 1e5]).sort((a, b) => a[1].localeCompare(b[1], "es"));
await fs.writeFile(path.join(SALIDA, "bogota-barrios.json"), JSON.stringify(catalogo));

// Índice de importaciones (como src/data/elecciones/index.ts): una importación por departamento, solo se carga la que se pide.
const deps = [...salida.keys()].sort();
await fs.writeFile(
  path.join(SALIDA, "index.ts"),
  `// Generado por scripts/generar-territorio.mjs — no editar a mano.\n\nexport const UBICACION: Record<string, () => Promise<{ default: unknown }>> = {\n${deps.map((d) => `  "${d}": () => import("./ubicacion/${d}.json"),`).join("\n")}\n};\n`
);
console.log(`Listo: ${deps.length} departamentos, ${(bytes / 1024).toFixed(0)} KB de ubicación y ${catalogo.length} barrios de Bogotá en ${path.relative(root, SALIDA)}`);
