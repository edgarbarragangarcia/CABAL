#!/usr/bin/env node
/**
 * Genera public/data/geo/: límites de departamentos, municipios (un archivo
 * por departamento, para cargar solo el que se abre en el mapa) y
 * localidades de Bogotá. Redondea coordenadas a 4 decimales (~11 m) para
 * aligerar los archivos.
 *
 * Fuentes (datos públicos):
 * - DANE, Marco Geoestadístico Nacional 2018, simplificado con mapshaper
 *   (github.com/caticoa3/colombia_mapa).
 * - Secretaría Distrital de Planeación de Bogotá, capa "Localidad"
 *   (datosabiertos.bogota.gov.co), generalizada por el propio servidor.
 *
 * Uso: node scripts/build-geo.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { geoArea } from "d3-geo";

const MGN = "https://raw.githubusercontent.com/caticoa3/colombia_mapa/master";
const LOCALIDADES =
  "https://serviciosgis.catastrobogota.gov.co/arcgis/rest/services/ordenamientoterritorial/localidad/MapServer/0/query" +
  "?where=1%3D1&outFields=LOCCODIGO,LOCNOMBRE&outSR=4326&f=geojson&maxAllowableOffset=0.0002&geometryPrecision=5";
const OUT = path.join(process.cwd(), "public", "data", "geo");

const round = (coords, digits) =>
  typeof coords[0] === "number"
    ? coords.map((n) => Number(n.toFixed(digits)))
    : coords.map((c) => round(c, digits));

/**
 * d3-geo usa geometría esférica: un polígono con los anillos en el sentido
 * contrario (el de RFC 7946, que devuelve ArcGIS) lo interpreta como "todo
 * el globo menos este polígono" y lo pinta como un rectángulo gigante.
 * Si un polígono cubre más de medio globo, se invierten sus anillos.
 */
function rewind(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const fixed = polygons.map((rings) =>
    geoArea({ type: "Polygon", coordinates: rings }) > 2 * Math.PI
      ? rings.map((ring) => [...ring].reverse())
      : rings
  );
  return { type: geometry.type, coordinates: geometry.type === "Polygon" ? fixed[0] : fixed };
}

function feature(f, properties, digits = 4) {
  return {
    type: "Feature",
    properties,
    geometry: rewind({ type: f.geometry.type, coordinates: round(f.geometry.coordinates, digits) }),
  };
}

const collection = (features) => JSON.stringify({ type: "FeatureCollection", features });

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  await mkdir(path.join(OUT, "municipios"), { recursive: true });

  const dptos = await getJson(`${MGN}/co_2018_MGN_DPTO_POLITICO.geojson`);
  await writeFile(
    path.join(OUT, "departamentos.json"),
    collection(
      dptos.features.map((f) =>
        feature(f, { code: f.properties.DPTO_CCDGO, name: f.properties.DPTO_CNMBR })
      )
    )
  );

  const mpios = await getJson(`${MGN}/co_2018_MGN_MPIO_POLITICO.geojson`);
  const byDpto = new Map();
  for (const f of mpios.features) {
    const dpto = f.properties.DPTO_CCDGO;
    const list = byDpto.get(dpto) ?? [];
    list.push(feature(f, { code: f.properties.MPIO_CCNCT, name: f.properties.MPIO_CNMBR }));
    byDpto.set(dpto, list);
  }
  for (const [dpto, features] of byDpto) {
    await writeFile(path.join(OUT, "municipios", `${dpto}.json`), collection(features));
  }

  const localidades = await getJson(LOCALIDADES);
  await writeFile(
    path.join(OUT, "bogota-localidades.json"),
    collection(
      localidades.features.map((f) =>
        feature(f, { code: f.properties.LOCCODIGO, name: f.properties.LOCNOMBRE }, 5)
      )
    )
  );

  console.log(`Listo: ${dptos.features.length} departamentos, ${mpios.features.length} municipios, ${localidades.features.length} localidades.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
