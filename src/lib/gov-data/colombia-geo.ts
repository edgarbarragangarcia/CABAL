import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { MAP_VIEWBOX, type DepartmentShape } from "@/components/sections/colombia-dashboard/types";

type DeptProperties = { DPTO: string; NOMBRE_DPT: string };

/**
 * Lee el GeoJSON de departamentos (fuente: geoportal DANE, vía
 * john-guerra/colombia-map, dominio público) y lo proyecta a rutas SVG
 * listas para renderizar. Se ejecuta en el servidor: no requiere DOM ni
 * librerías de mapas del lado del cliente.
 */
export async function getColombiaDepartmentShapes(): Promise<DepartmentShape[]> {
  const filePath = path.join(process.cwd(), "public", "data", "colombia-departamentos.geo.json");
  const raw = await readFile(filePath, "utf-8");
  const geojson = JSON.parse(raw) as FeatureCollection<Geometry, DeptProperties>;

  const projection = geoMercator().fitSize(
    [MAP_VIEWBOX.width, MAP_VIEWBOX.height],
    geojson
  );
  const pathGenerator = geoPath(projection);

  return geojson.features.map((feature: Feature<Geometry, DeptProperties>) => {
    const centroid = pathGenerator.centroid(feature);
    return {
      code: feature.properties.DPTO.padStart(2, "0"),
      name: feature.properties.NOMBRE_DPT,
      d: pathGenerator(feature) ?? "",
      centroid: [centroid[0], centroid[1]] as [number, number],
    };
  });
}
