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

export type DashboardTopicId =
  | "violencia"
  | "economia"
  | "gobierno"
  | "corrupcion"
  | "educacion"
  | "hurtos";

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

/** Periodos presidenciales que abarca la ventana de datos del observatorio. */
export const GOVERNMENT_PERIODS = [
  { label: "Santos II", startYear: 2014, endYear: 2018, color: "#64748b" },
  { label: "Duque", startYear: 2018, endYear: 2022, color: "#0ea5e9" },
  { label: "Petro", startYear: 2022, endYear: 2026, color: "#f97316" },
] as const;

export type TrendPoint = { year: number; total: number };
export type TrendSeries = {
  id: string;
  label: string;
  color: string;
  data: TrendPoint[];
  /**
   * Extrapolación estadística de la tendencia histórica (regresión
   * lineal simple). No es un pronóstico oficial ni representa el efecto
   * de ninguna decisión de gobierno — es solo la continuación
   * matemática de la línea histórica.
   */
  projection?: TrendPoint[];
};
