/**
 * Datos SIMULADOS de tendencia en redes sociales — no provienen de ninguna
 * fuente real todavía. Sirven para maquetar el dashboard del Centro de
 * control mientras se conecta una fuente real (p. ej. una API de
 * social listening o un scraper propio con base de datos).
 *
 * Al conectar datos reales: reemplazar estas funciones/constantes por una
 * consulta a la fuente real, manteniendo la misma forma de los tipos.
 */

import { colombiaDepartments } from "@/lib/colombia-departments";

export type DailyMention = {
  date: string; // "dd/mm"
  mentions: number;
  sentiment: number; // -1 (negativo) a 1 (positivo)
};

export type SentimentSlice = {
  label: "Positivo" | "Neutral" | "Negativo";
  value: number;
  color: string;
};

export type Platform = "X" | "Facebook" | "Instagram" | "YouTube";

export type PlatformSlice = {
  label: Platform;
  value: number;
  color: string;
};

export type TrendingTopic = {
  tag: string;
  mentions: number;
  deltaPct: number; // variación vs. semana anterior
};

export type SamplePost = {
  platform: Platform;
  excerpt: string;
  mentions: number;
  sentiment: "positivo" | "neutral" | "negativo";
};

export type DateRange = "7d" | "30d" | "90d";
export type PlatformFilter = Platform | "todas";
export type SentimentFilter = "positivo" | "neutral" | "negativo" | "todos";

export const RANGE_DAYS: Record<DateRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Serie diaria determinística (misma cada carga) para los últimos `days` días. */
export function getDailyMentions(days: number = 30): DailyMention[] {
  const rand = seededRandom(42);
  const points: DailyMention[] = [];
  const today = new Date();
  let base = 320;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    base += Math.round((rand() - 0.42) * 60);
    base = Math.max(120, Math.min(1400, base));
    const spike = rand() > 0.93 ? Math.round(rand() * 500) : 0;
    points.push({
      date: d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }),
      mentions: base + spike,
      sentiment: Math.round((rand() * 2 - 1) * 100) / 100,
    });
  }
  return points;
}

export const sentimentBreakdown: SentimentSlice[] = [
  { label: "Positivo", value: 46, color: "#22c58a" },
  { label: "Neutral", value: 31, color: "#a1a1aa" },
  { label: "Negativo", value: 23, color: "#f97066" },
];

export const platformBreakdown: PlatformSlice[] = [
  { label: "X", value: 42, color: "#0f6b4c" },
  { label: "Facebook", value: 24, color: "#22c58a" },
  { label: "Instagram", value: 21, color: "#ffb020" },
  { label: "YouTube", value: 13, color: "#a1a1aa" },
];

/** Fracción 0-1 de menciones que corresponde a cada plataforma. */
export function platformShare(platform: PlatformFilter): number {
  if (platform === "todas") return 1;
  const slice = platformBreakdown.find((p) => p.label === platform);
  return (slice?.value ?? 0) / 100;
}

export const trendingTopics: TrendingTopic[] = [
  { tag: "#LibertadEconómica", mentions: 4820, deltaPct: 18 },
  { tag: "#ReformaLaboral", mentions: 3910, deltaPct: -6 },
  { tag: "#SenadoColombia", mentions: 2745, deltaPct: 12 },
  { tag: "#SeguridadCiudadana", mentions: 2180, deltaPct: 34 },
  { tag: "#EducaciónColombia", mentions: 1590, deltaPct: 5 },
];

export const samplePosts: SamplePost[] = [
  {
    platform: "X",
    excerpt: "Publicación de ejemplo sobre agenda legislativa y libertad económica.",
    mentions: 1284,
    sentiment: "positivo",
  },
  {
    platform: "Facebook",
    excerpt: "Publicación de ejemplo sobre un debate en el Congreso.",
    mentions: 842,
    sentiment: "neutral",
  },
  {
    platform: "Instagram",
    excerpt: "Publicación de ejemplo sobre un evento comunitario de la fundación.",
    mentions: 611,
    sentiment: "positivo",
  },
  {
    platform: "X",
    excerpt: "Publicación de ejemplo con reacciones divididas sobre una propuesta.",
    mentions: 503,
    sentiment: "negativo",
  },
  {
    platform: "YouTube",
    excerpt: "Publicación de ejemplo: fragmento de una intervención en el Senado.",
    mentions: 388,
    sentiment: "positivo",
  },
];

// Peso relativo aproximado por departamento (población/actividad en redes),
// solo para que el mapa de calor simulado se vea creíble — no son cifras
// reales de menciones.
const DEPARTMENT_WEIGHT: Record<string, number> = {
  "Bogotá D.C.": 100,
  Antioquia: 78,
  "Valle del Cauca": 62,
  Atlántico: 48,
  Santander: 40,
  Cundinamarca: 38,
  Bolívar: 34,
  "Norte de Santander": 26,
  Córdoba: 24,
  Tolima: 22,
  Boyacá: 20,
  Caldas: 18,
  Risaralda: 18,
  Huila: 16,
  Cauca: 16,
  Magdalena: 16,
  Meta: 14,
  Nariño: 14,
  Sucre: 12,
  Cesar: 12,
  "La Guajira": 10,
  Quindío: 9,
  Casanare: 7,
  Caquetá: 6,
  Arauca: 5,
  Putumayo: 4,
  Chocó: 4,
  Amazonas: 2,
  Guaviare: 2,
  Vichada: 1.5,
  Guainía: 1,
  Vaupés: 1,
  "San Andrés y Providencia": 3,
};

/** Menciones simuladas por departamento, escaladas por rango y plataforma. */
export function getDepartmentMentions(
  totalMentions: number
): Record<string, number> {
  const totalWeight = colombiaDepartments.reduce(
    (a, d) => a + (DEPARTMENT_WEIGHT[d.name] ?? 2),
    0
  );
  const rand = seededRandom(7);
  const out: Record<string, number> = {};
  for (const dept of colombiaDepartments) {
    const weight = DEPARTMENT_WEIGHT[dept.name] ?? 2;
    const jitter = 0.85 + rand() * 0.3;
    out[dept.name] = Math.round((weight / totalWeight) * totalMentions * jitter);
  }
  return out;
}

/** Un hash determinístico simple para variar el sentimiento por nombre. */
function hashSeed(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 100000;
  return h + 1;
}

/**
 * Sentimiento simulado de un departamento — variación determinística
 * alrededor del promedio nacional (sentimentBreakdown), para no inventar
 * cifras completamente arbitrarias por refresco.
 */
export function getDepartmentSentiment(name: string): SentimentSlice[] {
  const rand = seededRandom(hashSeed(name));
  const jitter = () => Math.round((rand() - 0.5) * 16);
  let pos = sentimentBreakdown[0].value + jitter();
  let neu = sentimentBreakdown[1].value + jitter();
  let neg = sentimentBreakdown[2].value + jitter();
  pos = Math.max(5, pos);
  neu = Math.max(5, neu);
  neg = Math.max(5, neg);
  const total = pos + neu + neg;
  return [
    { label: "Positivo", value: Math.round((pos / total) * 100), color: "#22c58a" },
    { label: "Neutral", value: Math.round((neu / total) * 100), color: "#a1a1aa" },
    { label: "Negativo", value: Math.round((neg / total) * 100), color: "#f97066" },
  ];
}

/** Tema en tendencia "local" simulado: rota determinísticamente por departamento. */
export function getDepartmentTopTopic(name: string): TrendingTopic {
  const idx = hashSeed(name) % trendingTopics.length;
  return trendingTopics[idx];
}
