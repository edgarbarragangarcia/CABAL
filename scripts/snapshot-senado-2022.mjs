#!/usr/bin/env node
/**
 * Arma src/data/cabal-senado-2022.json con los votos de María Fernanda
 * Cabal en cada puesto de votación del Senado 2022, a partir del API JSON
 * oficial del preconteo de la Registraduría
 * (resultadospreccongreso.registraduria.gov.co).
 *
 * Por qué un snapshot y no consultas en vivo: el mapa y las listas por
 * departamento/municipio necesitan ~13.000 archivos (uno por puesto) y la
 * Registraduría no expone agregados por candidato. El detalle mesa a mesa
 * sí se consulta en vivo (src/lib/gov-data/registraduria-2022.ts).
 *
 * Uso: node scripts/snapshot-senado-2022.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://resultadospreccongreso.registraduria.gov.co";
const OUT = path.join(process.cwd(), "src", "data", "cabal-senado-2022.json");
const CONCURRENCY = 12;

/** Objeto de la candidata dentro de cantotabla (circunscripción nacional). */
const CABAL_RE = /\{[^{}]*"nomcan":"MARIA FERNANDA","apecan":"CABAL MOLINA"[^{}]*\}/;
const TOTALES_RE = /"metota":"(\d+)","mesesc":"(\d+)"/;

/**
 * Lee el archivo de un ámbito solo hasta encontrar a la candidata (los
 * partidos vienen ordenados por votos, así que casi nunca hace falta el
 * archivo completo) y devuelve sus votos y las mesas del ámbito.
 */
async function readAmbito(code) {
  const res = await fetch(`${BASE}/json/ACT/SE/${code}.json`);
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (CABAL_RE.test(text)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const totales = text.match(TOTALES_RE);
  if (!totales) throw new Error(`${code}: respuesta sin totales`);
  const cabal = text.match(CABAL_RE);
  return {
    votos: cabal ? Number(JSON.parse(cabal[0]).vot) : 0,
    mesas: Number(totales[1]),
    mesasInformadas: Number(totales[2]),
  };
}

async function withRetries(fn, attempts = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

async function main() {
  console.log("Descargando nomenclátor...");
  const nomenclator = await (await fetch(`${BASE}/assets/nomenclator.json`)).json();
  const ambitos = nomenclator.ambitos["1"]; // 1 = Senado

  // El dominio podría reutilizarse en otra elección: validar que siga
  // sirviendo el preconteo del 13 de marzo de 2022 antes de guardar nada.
  const nacionalText = await (await fetch(`${BASE}/json/ACT/SE/00.json`)).text();
  const nacional = JSON.parse(nacionalText.slice(nacionalText.indexOf("{")));
  if (!nacional.mdhm.startsWith("0314") || nacional.totales.act.metota !== "112900") {
    throw new Error(`El API ya no sirve el preconteo de Senado 2022 (mdhm=${nacional.mdhm}).`);
  }
  const cabalNacional = JSON.parse(nacionalText.match(CABAL_RE)[0]);

  const departamentos = {};
  const municipios = {};
  const zonas = {};
  const puestosMeta = [];
  for (const a of ambitos) {
    if (a.l === 2) departamentos[a.c] = a.n;
    else if (a.l === 3) municipios[a.c] = a.n;
    else if (a.l === 4) zonas[a.c] = a.n;
    else if (a.l === 6) puestosMeta.push(a);
  }

  console.log(`Leyendo ${puestosMeta.length} puestos...`);
  const puestos = new Array(puestosMeta.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < puestosMeta.length) {
      const i = next++;
      const p = puestosMeta[i];
      const r = await withRetries(() => readAmbito(p.c));
      puestos[i] = [p.c, p.n, r.mesas, r.votos];
      if (++done % 500 === 0) console.log(`  ${done}/${puestosMeta.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const suma = puestos.reduce((acc, p) => acc + p[3], 0);
  const esperado = Number(cabalNacional.vot);
  console.log(`Suma por puestos: ${suma} — total nacional oficial: ${esperado}`);
  if (suma !== esperado) throw new Error("La suma por puestos no cuadra con el total nacional.");

  const snapshot = {
    fuente: BASE,
    eleccion: "Senado de la República 2022 — preconteo",
    corte: nacional.mdhm,
    nacional: {
      votos: esperado,
      pvot: cabalNacional.pvot,
      mesas: Number(nacional.totales.act.metota),
      mesasInformadas: Number(nacional.totales.act.mesesc),
      pmesasInformadas: nacional.totales.act.pmesesc,
    },
    departamentos,
    municipios,
    zonas,
    // [código, nombre, mesas, votos]. El código del puesto contiene los de su
    // departamento (4 primeros dígitos), municipio (7) y zona (9).
    puestos,
  };
  await writeFile(OUT, JSON.stringify(snapshot));
  console.log(`Listo: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
