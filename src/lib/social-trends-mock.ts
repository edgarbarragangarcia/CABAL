/**
 * Datos SIMULADOS de tendencia en redes sociales — no provienen de ninguna
 * fuente real todavía. Sirven para maquetar el dashboard del Centro de
 * control mientras se conecta una fuente real (p. ej. una API de
 * social listening o un scraper propio con base de datos).
 *
 * Al conectar datos reales: reemplazar estas funciones/constantes por una
 * consulta a la fuente real, manteniendo la misma forma de los tipos.
 */

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

export type PlatformSlice = {
  label: string;
  value: number;
  color: string;
};

export type TrendingTopic = {
  tag: string;
  mentions: number;
  deltaPct: number; // variación vs. semana anterior
};

export type SamplePost = {
  platform: "X" | "Facebook" | "Instagram" | "YouTube";
  excerpt: string;
  mentions: number;
  sentiment: "positivo" | "neutral" | "negativo";
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Genera una serie de 30 días determinística (misma cada carga). */
export function getDailyMentions(): DailyMention[] {
  const rand = seededRandom(42);
  const points: DailyMention[] = [];
  const today = new Date();
  let base = 320;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    base += Math.round((rand() - 0.42) * 60);
    base = Math.max(120, Math.min(1400, base));
    // picos ocasionales (simulando un evento mediático)
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
];
