/**
 * Análisis de publicaciones en redes — MVP con datos SIMULADOS/hardcodeados,
 * no provienen de ninguna base de datos ni API real todavía. Sirve para
 * maquetar el panel de análisis y comparación mientras se conecta una
 * fuente real (scraper propio + base de datos, o las APIs oficiales de
 * cada plataforma).
 *
 * Los "otros políticos" de la comparación son roles ilustrativos
 * (oficialista / oposición / independiente), no personas reales — para no
 * atribuir publicaciones o cifras inventadas a alguien identificable.
 * Al conectar datos reales: reemplazar `PUBLICATIONS` por una consulta a
 * la fuente real y mantener la forma de `Publication`, o sustituir estas
 * funciones por consultas a esa base de datos.
 */

export type Platform = "X" | "Facebook" | "Instagram" | "YouTube";
export type Sentiment = "positivo" | "neutral" | "negativo";
export type PoliticianId = "cabal" | "oficialista" | "oposicion" | "independiente";

export type Politician = {
  id: PoliticianId;
  name: string;
  role: string;
  party: string;
  color: string;
};

export type Publication = {
  id: string;
  politicianId: PoliticianId;
  platform: Platform;
  date: string; // "YYYY-MM-DD"
  topic: string;
  excerpt: string;
  sentiment: Sentiment;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
};

export const POLITICIANS: Politician[] = [
  { id: "cabal", name: "María Fernanda Cabal", role: "Senadora", party: "Centro Democrático", color: "#22c58a" },
  { id: "oficialista", name: "Senador oficialista (ejemplo)", role: "Senador", party: "Pacto Histórico", color: "#f97066" },
  { id: "oposicion", name: "Senadora de oposición (ejemplo)", role: "Senadora", party: "Cambio Radical", color: "#ffc94a" },
  { id: "independiente", name: "Representante independiente (ejemplo)", role: "Representante", party: "Alianza Verde", color: "#60a5fa" },
];

const TOPICS = [
  "Seguridad",
  "Libertad económica",
  "Educación",
  "Congreso",
  "Reforma tributaria",
  "Agro",
  "Salud",
  "Orden público",
] as const;

/** Genera publicaciones de ejemplo, deterministas (sin Math.random en cada
 * render) para que el mismo dataset se sirva igual en servidor y cliente. */
function buildPublications(): Publication[] {
  const base: Omit<Publication, "id">[] = [
    // María Fernanda Cabal
    { politicianId: "cabal", platform: "X", date: "2026-09-12", topic: "Seguridad", excerpt: "La inseguridad no se resuelve con discursos, se resuelve con autoridad y resultados.", sentiment: "negativo", likes: 8200, comments: 1450, shares: 2100, reach: 210000 },
    { politicianId: "cabal", platform: "Facebook", date: "2026-09-10", topic: "Libertad económica", excerpt: "El emprendimiento se defiende bajando impuestos, no subiéndolos.", sentiment: "positivo", likes: 5400, comments: 620, shares: 980, reach: 130000 },
    { politicianId: "cabal", platform: "Instagram", date: "2026-09-08", topic: "Educación", excerpt: "Visitamos un colegio rural en Cundinamarca: la educación transforma comunidades.", sentiment: "positivo", likes: 12300, comments: 340, shares: 210, reach: 180000 },
    { politicianId: "cabal", platform: "X", date: "2026-09-05", topic: "Congreso", excerpt: "Radicamos un nuevo proyecto de ley para fortalecer la seguridad ciudadana.", sentiment: "neutral", likes: 4100, comments: 980, shares: 1200, reach: 150000 },
    { politicianId: "cabal", platform: "YouTube", date: "2026-09-02", topic: "Reforma tributaria", excerpt: "Video: por qué la reforma tributaria golpea a la clase media.", sentiment: "negativo", likes: 3900, comments: 510, shares: 640, reach: 95000 },
    { politicianId: "cabal", platform: "X", date: "2026-08-29", topic: "Orden público", excerpt: "Exigimos resultados concretos frente al orden público en las regiones.", sentiment: "negativo", likes: 7600, comments: 1320, shares: 1900, reach: 195000 },
    { politicianId: "cabal", platform: "Facebook", date: "2026-08-25", topic: "Agro", excerpt: "El campo colombiano necesita seguridad jurídica para producir.", sentiment: "positivo", likes: 3300, comments: 280, shares: 410, reach: 88000 },
    { politicianId: "cabal", platform: "Instagram", date: "2026-08-20", topic: "Congreso", excerpt: "12 años en el Congreso trabajando por la libertad y la institucionalidad.", sentiment: "positivo", likes: 15800, comments: 610, shares: 340, reach: 220000 },
    { politicianId: "cabal", platform: "X", date: "2026-08-15", topic: "Salud", excerpt: "El sistema de salud no se arregla estatizándolo, se arregla con gestión.", sentiment: "negativo", likes: 6100, comments: 1050, shares: 1400, reach: 160000 },
    { politicianId: "cabal", platform: "Facebook", date: "2026-08-10", topic: "Seguridad", excerpt: "Reunión con la fuerza pública: la seguridad es la primera libertad.", sentiment: "positivo", likes: 4700, comments: 390, shares: 520, reach: 110000 },

    // Senador oficialista (ejemplo)
    { politicianId: "oficialista", platform: "X", date: "2026-09-11", topic: "Reforma tributaria", excerpt: "La reforma tributaria es un acto de justicia social con los que menos tienen.", sentiment: "positivo", likes: 9100, comments: 1800, shares: 2400, reach: 230000 },
    { politicianId: "oficialista", platform: "Facebook", date: "2026-09-07", topic: "Salud", excerpt: "La reforma a la salud pública sigue avanzando en el Congreso.", sentiment: "neutral", likes: 4200, comments: 890, shares: 610, reach: 120000 },
    { politicianId: "oficialista", platform: "Instagram", date: "2026-09-03", topic: "Agro", excerpt: "Entrega de tierras a comunidades campesinas en el Cauca.", sentiment: "positivo", likes: 10200, comments: 420, shares: 380, reach: 190000 },
    { politicianId: "oficialista", platform: "X", date: "2026-08-28", topic: "Orden público", excerpt: "El cambio no se hace con más fuerza, se hace con más Estado social.", sentiment: "neutral", likes: 5600, comments: 1400, shares: 1100, reach: 140000 },
    { politicianId: "oficialista", platform: "YouTube", date: "2026-08-22", topic: "Educación", excerpt: "Video: la gratuidad en la universidad pública ya es una realidad.", sentiment: "positivo", likes: 6800, comments: 500, shares: 720, reach: 105000 },
    { politicianId: "oficialista", platform: "X", date: "2026-08-16", topic: "Congreso", excerpt: "Denunciamos las maniobras de la oposición para frenar las reformas.", sentiment: "negativo", likes: 7200, comments: 2100, shares: 1800, reach: 175000 },
    { politicianId: "oficialista", platform: "Facebook", date: "2026-08-09", topic: "Seguridad", excerpt: "La paz total sigue siendo la apuesta central de este gobierno.", sentiment: "neutral", likes: 3600, comments: 760, shares: 430, reach: 92000 },

    // Senadora de oposición (ejemplo)
    { politicianId: "oposicion", platform: "X", date: "2026-09-13", topic: "Reforma tributaria", excerpt: "Otra reforma tributaria que asfixia a las empresas y a la clase media.", sentiment: "negativo", likes: 6300, comments: 1150, shares: 1600, reach: 165000 },
    { politicianId: "oposicion", platform: "Instagram", date: "2026-09-06", topic: "Libertad económica", excerpt: "Recorriendo empresarios que generan empleo real en el país.", sentiment: "positivo", likes: 8700, comments: 260, shares: 190, reach: 140000 },
    { politicianId: "oposicion", platform: "Facebook", date: "2026-08-30", topic: "Salud", excerpt: "La reforma a la salud pone en riesgo la atención de millones de colombianos.", sentiment: "negativo", likes: 4900, comments: 940, shares: 780, reach: 118000 },
    { politicianId: "oposicion", platform: "X", date: "2026-08-24", topic: "Orden público", excerpt: "El gobierno le ha entregado territorios enteros a los grupos armados.", sentiment: "negativo", likes: 5500, comments: 1300, shares: 1450, reach: 150000 },
    { politicianId: "oposicion", platform: "Facebook", date: "2026-08-18", topic: "Educación", excerpt: "La calidad educativa importa tanto como la cobertura.", sentiment: "neutral", likes: 2900, comments: 210, shares: 150, reach: 70000 },
    { politicianId: "oposicion", platform: "X", date: "2026-08-12", topic: "Congreso", excerpt: "Radicamos una proposición para blindar la independencia judicial.", sentiment: "neutral", likes: 3100, comments: 480, shares: 390, reach: 82000 },

    // Representante independiente (ejemplo)
    { politicianId: "independiente", platform: "Instagram", date: "2026-09-09", topic: "Educación", excerpt: "Ni con la izquierda ni con la derecha: con la evidencia y los datos.", sentiment: "neutral", likes: 6100, comments: 190, shares: 140, reach: 98000 },
    { politicianId: "independiente", platform: "X", date: "2026-09-04", topic: "Congreso", excerpt: "Votamos en contra del artículo que no tenía estudios de impacto fiscal.", sentiment: "neutral", likes: 2400, comments: 310, shares: 220, reach: 61000 },
    { politicianId: "independiente", platform: "YouTube", date: "2026-08-27", topic: "Agro", excerpt: "Video: lo que ningún partido te cuenta sobre la crisis del agro.", sentiment: "neutral", likes: 4300, comments: 260, shares: 310, reach: 76000 },
    { politicianId: "independiente", platform: "Facebook", date: "2026-08-19", topic: "Salud", excerpt: "Propongo un piloto técnico, no ideológico, para la reforma a la salud.", sentiment: "positivo", likes: 2100, comments: 140, shares: 95, reach: 52000 },
    { politicianId: "independiente", platform: "X", date: "2026-08-13", topic: "Seguridad", excerpt: "La seguridad necesita presupuesto y seguimiento, no solo anuncios.", sentiment: "neutral", likes: 1900, comments: 220, shares: 160, reach: 48000 },
  ];

  return base.map((p, i) => ({ id: `pub-${i + 1}`, ...p }));
}

export const PUBLICATIONS: Publication[] = buildPublications();

export function getPublicationsByPolitician(politicianId: PoliticianId): Publication[] {
  return PUBLICATIONS.filter((p) => p.politicianId === politicianId).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
}

export type EngagementSummary = {
  posts: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  /** (likes + comments + shares) / alcance, en %. */
  engagementRate: number;
};

export function getEngagementSummary(politicianId: PoliticianId): EngagementSummary {
  const posts = getPublicationsByPolitician(politicianId);
  const totals = posts.reduce(
    (acc, p) => ({
      likes: acc.likes + p.likes,
      comments: acc.comments + p.comments,
      shares: acc.shares + p.shares,
      reach: acc.reach + p.reach,
    }),
    { likes: 0, comments: 0, shares: 0, reach: 0 }
  );
  const engagementRate = totals.reach
    ? ((totals.likes + totals.comments + totals.shares) / totals.reach) * 100
    : 0;

  return {
    posts: posts.length,
    ...totals,
    engagementRate: Math.round(engagementRate * 10) / 10,
  };
}

/** Publicaciones por plataforma — para ver dónde concentra su actividad. */
export function getPostingFrequency(
  politicianId: PoliticianId
): { label: Platform; value: number }[] {
  const posts = getPublicationsByPolitician(politicianId);
  const platforms: Platform[] = ["X", "Facebook", "Instagram", "YouTube"];
  return platforms.map((platform) => ({
    label: platform,
    value: posts.filter((p) => p.platform === platform).length,
  }));
}

/** Publicaciones por semana (ISO, agrupadas por fecha de inicio de semana). */
export function getWeeklyPostingTrend(
  politicianId: PoliticianId
): { label: string; value: number }[] {
  const posts = getPublicationsByPolitician(politicianId);
  const byWeek = new Map<string, number>();

  for (const p of posts) {
    const d = new Date(`${p.date}T00:00:00`);
    const day = d.getDay() || 7; // lunes=1 ... domingo=7
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day - 1));
    const key = monday.toISOString().slice(5, 10); // "MM-DD"
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

const TOPIC_COLORS: Record<string, string> = {
  Seguridad: "#f97066",
  "Libertad económica": "#22c58a",
  Educación: "#60a5fa",
  Congreso: "#a78bfa",
  "Reforma tributaria": "#ffc94a",
  Agro: "#34d399",
  Salud: "#f472b6",
  "Orden público": "#fb923c",
};

export function getTopicBreakdown(
  politicianId: PoliticianId
): { label: string; value: number; color: string }[] {
  const posts = getPublicationsByPolitician(politicianId);
  if (posts.length === 0) return [];

  const counts = new Map<string, number>();
  for (const p of posts) counts.set(p.topic, (counts.get(p.topic) ?? 0) + 1);

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      value: Math.round((count / posts.length) * 100),
      color: TOPIC_COLORS[label] ?? "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);
}

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positivo: "#22c58a",
  neutral: "#94a3b8",
  negativo: "#f97066",
};

export function getSentimentBreakdown(
  politicianId: PoliticianId
): { label: string; value: number; color: string }[] {
  const posts = getPublicationsByPolitician(politicianId);
  if (posts.length === 0) return [];

  const order: Sentiment[] = ["positivo", "neutral", "negativo"];
  return order.map((sentiment) => {
    const count = posts.filter((p) => p.sentiment === sentiment).length;
    return {
      label: sentiment[0].toUpperCase() + sentiment.slice(1),
      value: Math.round((count / posts.length) * 100),
      color: SENTIMENT_COLORS[sentiment],
    };
  });
}

export { TOPICS };

/** Compara a todos los políticos en una misma métrica de engagement. */
export function compareByMetric(
  metric: "engagementRate" | "reach" | "likes" | "posts"
): { label: string; value: number; hint: string; color: string }[] {
  return POLITICIANS.map((pol) => {
    const summary = getEngagementSummary(pol.id);
    const value = summary[metric];
    const hint =
      metric === "engagementRate"
        ? `${value}%`
        : value.toLocaleString("es-CO");
    return { label: pol.name, value, hint, color: pol.color };
  }).sort((a, b) => b.value - a.value);
}
