import type { DepartmentDatum } from "@/lib/gov-data/queries";

export type DepartmentShape = {
  code: string;
  name: string;
  /** Atributo `d` listo para un elemento SVG <path>. */
  d: string;
  /** Centroide en coordenadas del viewBox, útil para posicionar etiquetas. */
  centroid: [number, number];
};

export const MAP_VIEWBOX = { width: 480, height: 620 };

export type DashboardTopicId = "violencia" | "economia" | "gobierno";

export type DashboardTopic = {
  id: DashboardTopicId;
  label: string;
  unit: string;
  year: number;
  source: string;
  sourceUrl: string;
  data: DepartmentDatum[];
  /** Mayor valor = mejor (MDM) o peor (homicidios)? Afecta el orden del ranking. */
  higherIsBetter: boolean;
  /** Explicación en lenguaje sencillo de qué mide este tema y cómo leerlo. */
  explainer: string;
  /** Qué significa la unidad de medida, en una frase simple. */
  unitExplainer: string;
  /** Etiquetas de los extremos de la leyenda de color (p. ej. "Menos casos" / "Más casos"). */
  lowLabel: string;
  highLabel: string;
};

export type ColombiaDashboardData = {
  shapes: DepartmentShape[];
  topics: DashboardTopic[];
};
