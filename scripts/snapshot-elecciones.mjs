#!/usr/bin/env node
/**
 * Arma src/data/elecciones/<id>.json: la división territorial (país →
 * departamento → municipio → zona o comuna → puesto) y el catálogo de
 * partidos de cada elección, a partir del nomenclátor oficial que publica
 * la Registraduría junto a su preconteo. Los votos NO van aquí: se
 * consultan en vivo, ámbito por ámbito (src/lib/gov-data/elecciones).
 *
 * Por qué un snapshot: los nomenclátores pesan de 2 a 25 MB y no cambian
 * después de la elección; comprimidos a lo que la app usa quedan en unos
 * cientos de KB por elección.
 *
 * Uso: node scripts/snapshot-elecciones.mjs [--desde <carpeta>]
 *   --desde: lee <carpeta>/<id>.nomenclator.json en vez de descargarlo
 *   (útil cuando el firewall de la Registraduría bloquea la IP; el
 *   nomenclátor también está en web.archive.org).
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ELECCIONES = [
  { id: "presidencia-2026-2v", host: "resultadosprecpresidente2026-2v", ruta: "json/nomenclator.json" },
  { id: "presidencia-2026-1v", host: "resultadosprecpresidente2026-1v", ruta: "json/nomenclator.json" },
  { id: "congreso-2026", host: "resultadospreccongreso2026", ruta: "json/nomenclator.json" },
  { id: "territoriales-2023", host: "resultadosprec2023", ruta: "json/nomenclator.json" },
  {
    id: "presidencia-2022-2v",
    host: "resultadosprecpresidente2v",
    ruta: "assets/nomenclator.json",
    // La copia archivada de este nomenclátor no se deja leer; con el de la
    // primera vuelta (misma división territorial) basta, pero los códigos
    // de partido cambian entre vueltas. Estos salen del archivo nacional
    // de la segunda vuelta (json/ACT/PR/00.json): 2 = Rodolfo Hernández,
    // 3 = Gustavo Petro.
    partidos: {
      2: ["LIGA DE GOBERNANTES ANTICORRUPCIÓN", "#F5DE09"],
      3: ["COALICIÓN PACTO HISTÓRICO", "#F49609"],
    },
  },
  { id: "presidencia-2022-1v", host: "resultadosprecpresidente1v", ruta: "assets/nomenclator.json" },
  { id: "congreso-2022", host: "resultadospreccongreso", ruta: "assets/nomenclator.json" },
];

/** Corporaciones que no son elecciones sino la portada del sitio. */
const IGNORAR = new Set(["IN"]);

const OUT_DIR = path.join(process.cwd(), "src", "data", "elecciones");
const GEO_OUT = path.join(OUT_DIR, "geo");
const GEO_DIR = path.join(process.cwd(), "public", "data", "geo");

const args = process.argv.slice(2);
const desde = args.includes("--desde") ? args[args.indexOf("--desde") + 1] : null;

// ------------------------------------------------------------ nombres ---

const normalize = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Departamentos de la Registraduría → código DANE (por nombre normalizado, o su inicio). */
const DEPARTAMENTOS_DANE = [
  ["AMAZONAS", "91"], ["ANTIOQUIA", "05"], ["ARAUCA", "81"], ["ATLANTICO", "08"],
  ["BOGOTA", "11"], ["BOLIVAR", "13"], ["BOYACA", "15"], ["CALDAS", "17"],
  ["CAQUETA", "18"], ["CASANARE", "85"], ["CAUCA", "19"], ["CESAR", "20"],
  ["CHOCO", "27"], ["CORDOBA", "23"], ["CUNDINAMARCA", "25"], ["GUAINIA", "94"],
  ["GUAVIARE", "95"], ["HUILA", "41"], ["LA GUAJIRA", "44"], ["MAGDALENA", "47"],
  ["META", "50"], ["NARINO", "52"], ["NORTE DE SAN", "54"], ["PUTUMAYO", "86"],
  ["QUINDIO", "63"], ["RISARALDA", "66"], ["SAN ANDRES", "88"], ["ARCHIPIELAGO DE SAN ANDRES", "88"],
  ["SANTANDER", "68"], ["SUCRE", "70"], ["TOLIMA", "73"], ["VALLE", "76"],
  ["VAUPES", "97"], ["VICHADA", "99"],
];

function departamentoDane(nombre) {
  const n = normalize(nombre);
  // El más largo primero: "NORTE DE SAN..." antes que "SANTANDER".
  const hit = [...DEPARTAMENTOS_DANE]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => n === k || n.startsWith(`${k} `) || n.startsWith(k));
  return hit?.[1] ?? null;
}

/** Igual que matchMunicipio en src/lib/electoral-places.ts. */
const MUNICIPIO_ALIASES = {
  "ARROYO HONDO": "13062",
  "DON MATIAS": "05237",
  "LA ARGENTINA PLATA VIEJA": "41378",
  "MEDIO ATRATO BETE": "27425",
  "MORICHAL PAPUNAGUA": "97777",
  RIOVIEJO: "13600",
  "SAN PEDRO": "05664",
  "VILLA DE LEIVA": "15407",
  "VISTA HERMOSA": "50711",
};

function matchMunicipio(nombre, candidatos) {
  const target = normalize(nombre);
  const alias = MUNICIPIO_ALIASES[target];
  if (alias && candidatos.some((c) => c.code === alias)) return alias;
  const norm = candidatos.map((c) => ({ code: c.code, name: normalize(c.name) }));
  const exact = norm.find((c) => c.name === target);
  if (exact) return exact.code;
  const words = (s) => new Set(s.split(" "));
  const tw = words(target);
  const contains = norm.filter((c) => {
    const cw = words(c.name);
    return [...tw].every((w) => cw.has(w)) || [...cw].every((w) => tw.has(w));
  });
  return contains.length === 1 ? contains[0].code : null;
}

const municipiosGeo = new Map();
async function municipiosDe(dane) {
  if (!municipiosGeo.has(dane)) {
    try {
      const fc = JSON.parse(await fs.readFile(path.join(GEO_DIR, "municipios", `${dane}.json`), "utf8"));
      municipiosGeo.set(dane, fc.features.map((f) => f.properties));
    } catch {
      municipiosGeo.set(dane, []);
    }
  }
  return municipiosGeo.get(dane);
}

// ------------------------------------------------------- nomenclátor ---

async function leerNomenclator(e) {
  if (desde) return JSON.parse(await fs.readFile(path.join(desde, `${e.id}.nomenclator.json`), "utf8"));
  const url = `https://${e.host}.registraduria.gov.co/${e.ruta}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** Las dos generaciones del nomenclátor, llevadas a { sigla, nombre, ambitos: [{i,n,c,l,m,padres}] }. */
function corporaciones(nom) {
  if (nom.ambitos) {
    return Object.entries(nom.nomAmbitos)
      .filter(([, v]) => !IGNORAR.has(v.e))
      .map(([elec, v]) => ({
        sigla: v.e,
        nombre: v.n,
        ambitos: nom.ambitos[elec].map((a) => ({ ...a, padres: a.p.map((i) => ({ i })) })),
      }));
  }
  return nom.elec
    .filter((e) => !IGNORAR.has(e.sigla))
    .map((e) => ({
      sigla: e.sigla,
      nombre: e.n,
      ambitos: nom.amb
        .find((a) => String(a.elec) === String(e.elec))
        .ambitos.map((a) => ({ ...a, padres: a.p.flatMap((g) => g.p.map((i) => ({ i, l: g.l }))) })),
    }));
}

/**
 * [código, nombre, nivel, mesas, posición del padre, DANE] por ámbito. Las
 * mesas (nivel 7) no se guardan: su código es el del puesto + 6 dígitos.
 * Si hay zonas, los puestos cuelgan de su zona y las comunas se omiten;
 * donde no hay zonas (JAL) el recorrido es por comuna.
 */
async function compactar(ambitos) {
  const hayZonas = ambitos.some((a) => a.l === 4);
  const keep = ambitos.filter((a) => a.l < 7 && (a.l !== 5 || !hayZonas));
  const byI = new Map(ambitos.map((a) => [a.i, a]));
  const pos = new Map(keep.map((a, k) => [a.i, k]));
  const deptDane = new Map();
  const out = [];
  for (const a of keep) {
    const padres = a.padres.map((p) => byI.get(p.i)).filter((p) => p && pos.has(p.i));
    // El padre directo es el de nivel más alto por debajo del propio (zona antes que municipio).
    const padre = padres.sort((x, y) => y.l - x.l).find((p) => p.l < a.l);
    let dane = null;
    if (a.l === 2) {
      dane = departamentoDane(a.n);
      deptDane.set(a.i, dane);
    }
    out.push([a.c, a.n, a.l, a.m ?? 0, padre ? pos.get(padre.i) : -1, dane]);
  }
  // Municipios: DANE buscando por nombre entre los del mapa de su departamento.
  for (const row of out) {
    if (row[2] !== 3 || row[4] < 0) continue;
    const dept = out[row[4]];
    if (!dept[5]) continue;
    row[5] = dept[5] === "11" ? "11001" : matchMunicipio(row[1], await municipiosDe(dept[5]));
  }
  // El DANE solo aplica a departamentos y municipios: en el resto se omite.
  return out.map((row) => (row[5] ? row : row.slice(0, 5)));
}

// -------------------------------------------------------------- main ---

await fs.mkdir(GEO_OUT, { recursive: true });
const indice = [];
const geosUsadas = new Set();

for (const e of ELECCIONES) {
  let nom;
  try {
    nom = await leerNomenclator(e);
  } catch (err) {
    console.error(`✗ ${e.id}: ${err.message}`);
    continue;
  }
  // Cada geografía va a su propio archivo, nombrado por su contenido: las
  // corporaciones y vueltas con la misma división territorial la comparten.
  const corps = [];
  const sinDane = [];
  for (const c of corporaciones(nom)) {
    const rows = await compactar(c.ambitos);
    const json = JSON.stringify(rows);
    const geo = createHash("sha1").update(json).digest("hex").slice(0, 10);
    if (!geosUsadas.has(geo)) {
      geosUsadas.add(geo);
      await fs.writeFile(path.join(GEO_OUT, `${geo}.json`), json);
    }
    corps.push({ sigla: c.sigla, nombre: c.nombre, geo });
    sinDane.push(...rows.filter((r) => (r[2] === 2 || r[2] === 3) && r[4] >= 0 && !r[5] && rows[r[4]][5] !== undefined));
  }
  // En los archivos de resultados, `codpar` es la posición `i` del partido en
  // el nomenclátor (no su campo `codpar`).
  const partidos = {
    ...Object.fromEntries((nom.partidos ?? []).map((p) => [p.i, [p.nombre, p.color ?? null]])),
    ...(e.partidos ?? {}),
  };
  await fs.writeFile(path.join(OUT_DIR, `${e.id}.json`), JSON.stringify({ corporaciones: corps, partidos }));
  indice.push({ id: e.id, geos: corps.map((c) => c.geo) });
  console.log(
    `✓ ${e.id}: ${corps.map((c) => `${c.sigla}→${c.geo}`).join(" ")} · ${Object.keys(partidos).length} partidos` +
      (sinDane.length ? ` · municipios sin DANE: ${sinDane.map((r) => r[1]).join(", ")}` : "")
  );
}

// Índice con imports estáticos, para que el bundler incluya cada archivo.
const geos = [...geosUsadas].sort();
await fs.writeFile(
  path.join(OUT_DIR, "index.ts"),
  `// Generado por scripts/snapshot-elecciones.mjs — no editar a mano.

export const ELECCIONES_DATA = {
${indice.map((e) => `  "${e.id}": () => import("./${e.id}.json"),`).join("\n")}
} as const;

export const GEOS: Record<string, () => Promise<{ default: unknown }>> = {
${geos.map((g) => `  "${g}": () => import("./geo/${g}.json"),`).join("\n")}
};
`
);
for (const f of await fs.readdir(GEO_OUT)) {
  if (!geosUsadas.has(f.replace(/\.json$/, ""))) await fs.rm(path.join(GEO_OUT, f));
}
