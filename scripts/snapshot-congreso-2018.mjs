// Geografía del Congreso 2018 (Senado y Cámara), armada desde los datasets de
// mesas de datos.gov.co (75f2-fe2s Senado, vkjr-c6fe Cámara). Los votos NO se
// guardan: se consultan en vivo, agrupados, en el servidor.
//
// Códigos (jerárquicos, para que el resto del explorador los trate igual que
// los de la Registraduría): depto NN · municipio NN+NNN · zona +ZZ · puesto +PPP
// · mesa = puesto + 6 dígitos. Se agrega el DANE (cuando el nombre coincide con
// la geografía de 2022) para ubicar territorios en el mapa y entre elecciones.
//
// Uso: node scripts/snapshot-congreso-2018.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "src/data/elecciones");
const BASE = "https://www.datos.gov.co/resource";
const TOKEN = process.env.SOCRATA_APP_TOKEN;

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(D C|DC|DISTRITO CAPITAL)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
const igual = (a, b) => a && b && (a === b || a.startsWith(b + " ") || b.startsWith(a + " "));

async function consultar(dataset, params) {
  const url = `${BASE}/${dataset}.json?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: TOKEN ? { "X-App-Token": TOKEN } : {} });
  if (!res.ok) throw new Error(`${dataset} respondió ${res.status}: ${await res.text()}`);
  return res.json();
}

// Un puesto por fila, con su número de mesas (las mesas de un puesto se numeran 1..n).
const puestos = await consultar("75f2-fe2s", {
  $select: "ndepto,nmpio,zz,pp,npuesto,count(distinct mesa) as mesas",
  $group: "ndepto,nmpio,zz,pp,npuesto",
  $limit: "50000",
});
console.log(`${puestos.length} puestos en el Senado 2018`);

// DANE desde la geografía de 2022.
const g22 = JSON.parse(await fs.readFile(path.join(OUT, "geo/b2948b7407.json"), "utf8"));
const daneDepto = new Map();
const daneMun = new Map();
g22.forEach((r) => {
  if (r[2] === 2 && r[5]) daneDepto.set(norm(r[1]), r[5]);
});
g22.forEach((r) => {
  if (r[2] === 3 && r[5]) daneMun.set(`${r[5].slice(0, 2)}|${norm(r[1])}`, r[5]);
});
const buscarDepto = (n) => [...daneDepto].find(([k]) => igual(k, n))?.[1] ?? "";

const pad = (s, n) => String(s).padStart(n, "0");
const deptos = [...new Set(puestos.map((p) => p.ndepto))].sort();
const rows = [["00", "COLOMBIA", 1, 0, -1, ""]];
const rowDepto = new Map();
deptos.forEach((d, i) => {
  rowDepto.set(d, rows.length);
  rows.push([pad(i + 1, 2), d, 2, 0, 0, buscarDepto(norm(d)), ""]);
});
const rowMun = new Map();
const rowZona = new Map();
const vistos = new Set();
let sinDane = 0;
let colisiones = 0;
const ordenados = [...puestos].sort((a, b) => a.ndepto.localeCompare(b.ndepto) || a.nmpio.localeCompare(b.nmpio) || Number(a.zz) - Number(b.zz) || String(a.pp).localeCompare(String(b.pp)));
for (const p of ordenados) {
  const di = rowDepto.get(p.ndepto);
  const dcode = rows[di][0];
  const kM = `${p.ndepto}|${p.nmpio}`;
  if (!rowMun.has(kM)) {
    const n = [...rowMun.keys()].filter((k) => k.startsWith(p.ndepto + "|")).length + 1;
    const dane = daneMun.get(`${rows[di][5]}|${norm(p.nmpio)}`) ?? "";
    if (!dane && rows[di][5]) sinDane++;
    rowMun.set(kM, rows.length);
    rows.push([dcode + pad(n, 3), p.nmpio, 3, 0, di, dane, ""]);
  }
  const mi = rowMun.get(kM);
  const kZ = `${kM}|${p.zz}`;
  if (!rowZona.has(kZ)) {
    rowZona.set(kZ, rows.length);
    rows.push([rows[mi][0] + pad(p.zz, 2), `ZONA ${pad(p.zz, 2)}`, 4, 0, mi, "", String(p.zz)]);
  }
  const zi = rowZona.get(kZ);
  const code = rows[zi][0] + pad(p.pp, 3);
  if (vistos.has(code)) {
    colisiones++;
    continue;
  }
  vistos.add(code);
  rows.push([code, p.npuesto, 6, Number(p.mesas), zi, "", String(p.pp)]);
}
console.log(`${rows.length} filas · ${deptos.length} departamentos · ${rowMun.size} municipios (${sinDane} sin DANE) · ${colisiones} códigos repetidos`);

await fs.writeFile(path.join(OUT, "geo/congreso-2018.json"), JSON.stringify(rows));
await fs.writeFile(
  path.join(OUT, "congreso-2018.json"),
  JSON.stringify({
    corporaciones: [
      { sigla: "SE", nombre: "SENADO", geo: "congreso-2018" },
      { sigla: "CA", nombre: "CAMARA", geo: "congreso-2018" },
    ],
    partidos: {},
  })
);
console.log("Escrito geo/congreso-2018.json y congreso-2018.json (ya están registrados en src/data/elecciones/index.ts).");
