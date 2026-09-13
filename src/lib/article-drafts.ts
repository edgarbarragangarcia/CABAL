/**
 * Generador de PROPUESTAS de artículo — por ahora es una plantilla local
 * (sin llamar a ningún modelo de IA real), porque este proyecto no tiene
 * configurada ninguna clave de API de IA todavía.
 *
 * Para conectar generación real: reemplazar `draftArticle` por una llamada
 * a `/api/admin/redactor/generate` que a su vez llame a la API de Claude
 * (u otro proveedor) con `ANTHROPIC_API_KEY` en el servidor. La forma de
 * entrada/salida (`DraftInput` / `ArticleDraft`) puede quedar igual.
 */

import type { TrendingTopic } from "@/lib/social-trends-mock";

export type Tone = "institucional" | "cercano" | "combativo";

export const TONE_LABEL: Record<Tone, string> = {
  institucional: "Institucional",
  cercano: "Cercano",
  combativo: "Combativo",
};

export type DraftInput = {
  topic: TrendingTopic;
  city: string;
  mentions: number;
  tone: Tone;
};

export type ArticleDraft = {
  headline: string;
  lede: string;
  paragraphs: string[];
  suggestedTags: string[];
};

const OPENERS: Record<Tone, (topic: string, city: string) => string> = {
  institucional: (topic, city) =>
    `La conversación pública alrededor de ${topic} continúa tomando fuerza en ${city}, en un contexto donde la ciudadanía exige respuestas concretas y sostenidas en el tiempo.`,
  cercano: (topic, city) =>
    `En ${city}, cada vez más personas están hablando de ${topic} — en la calle, en las redes, en las conversaciones de todos los días.`,
  combativo: (topic, city) =>
    `Mientras el gobierno mira para otro lado, en ${city} la gente ya está exigiendo resultados sobre ${topic}.`,
};

const BODY_1: Record<Tone, (topic: string, city: string, mentions: string) => string> = {
  institucional: (topic, city, mentions) =>
    `El seguimiento hecho por la Fundación Escuela Libertad registra ${mentions} menciones relacionadas con ${topic} en ${city} durante el periodo analizado, una señal clara de que el tema está en la agenda pública regional.`,
  cercano: (topic, city, mentions) =>
    `Solo en ${city} contamos ${mentions} menciones sobre ${topic} — números que confirman algo que muchos vecinos ya venían diciendo desde hace semanas.`,
  combativo: (topic, city, mentions) =>
    `${mentions} menciones en ${city} sobre ${topic} no son casualidad: son la prueba de un malestar que las autoridades no pueden seguir ignorando.`,
};

const BODY_2: Record<Tone, (topic: string) => string> = {
  institucional: (topic) =>
    `Desde la fundación reiteramos la importancia de la educación cívica y el acceso a información verificada para que ${topic} se discuta con datos, no con consignas.`,
  cercano: (topic) =>
    `Por eso queremos invitarte a informarte con nosotros sobre ${topic}, con cifras claras y explicadas de forma sencilla.`,
  combativo: (topic) =>
    `No podemos permitir que ${topic} se quede en promesas vacías — es momento de exigir hechos, no discursos.`,
};

const CLOSERS: Record<Tone, (city: string) => string> = {
  institucional: (city) =>
    `Seguiremos monitoreando la evolución de este tema en ${city} y en el resto del país, con el mismo rigor que aplicamos a todos nuestros observatorios.`,
  cercano: (city) =>
    `Si vives en ${city} y quieres contarnos tu experiencia, nuestras puertas (y nuestras redes) están abiertas.`,
  combativo: (city) =>
    `En ${city} y en toda Colombia, la libertad se defiende exigiendo cuentas — hoy más que nunca.`,
};

export function draftArticle({ topic, city, mentions, tone }: DraftInput): ArticleDraft {
  const topicLabel = topic.tag.replace(/^#/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
  const mentionsFmt = mentions.toLocaleString("es-CO");

  const headline =
    tone === "combativo"
      ? `${topicLabel}: la exigencia crece en ${city}`
      : tone === "cercano"
        ? `Lo que se está diciendo sobre ${topicLabel} en ${city}`
        : `${topicLabel} gana relevancia en la agenda pública de ${city}`;

  return {
    headline,
    lede: OPENERS[tone](topicLabel, city),
    paragraphs: [
      BODY_1[tone](topicLabel, city, mentionsFmt),
      BODY_2[tone](topicLabel),
      CLOSERS[tone](city),
    ],
    suggestedTags: [topic.tag, `#${city.replace(/\s+/g, "")}`, "#EscuelaLibertad"],
  };
}
