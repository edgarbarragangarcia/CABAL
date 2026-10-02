import "server-only";

import { generarTexto } from "@/lib/ia-config";
import type { Noticia } from "@/lib/informe/fuentes";

/**
 * Sentimiento de los titulares, clasificado por la IA configurada. Es el tono
 * de lo que dicen los medios sobre ella, no el de la gente en redes.
 */

export type Tono = "positivo" | "neutral" | "negativo";
export type Sentimiento = {
  positivo: number;
  neutral: number;
  negativo: number;
  /** Titulares clasificados. */
  total: number;
  /** De -1 (todo negativo) a 1 (todo positivo). */
  indice: number;
  /** Algunos titulares por tono, para verificar la clasificación. */
  ejemplos: { titulo: string; medio: string; tono: Tono }[];
};

const MAX_TITULARES = 40;

const tonoDe = (x: unknown): Tono | null => {
  const t = String(x).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return t.includes("posit") ? "positivo" : t.includes("negat") ? "negativo" : t.includes("neutr") ? "neutral" : null;
};

/** Acepta {"1":"positivo",...} o un arreglo; un titular sin tono válido se descarta, no se adivina. */
export function parsearTonos(texto: string, n: number): (Tono | null)[] | null {
  const m = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as unknown;
    const tonos = Array.from({ length: n }, (_, i) => tonoDe(Array.isArray(j) ? j[i] : (j as Record<string, unknown>)[String(i + 1)]));
    return tonos.some(Boolean) ? tonos : null;
  } catch {
    return null;
  }
}

export function resumirTonos(lista: Noticia[], tonos: (Tono | null)[]): Sentimiento {
  const cuenta = { positivo: 0, neutral: 0, negativo: 0 };
  for (const t of tonos) if (t) cuenta[t]++;
  const total = cuenta.positivo + cuenta.neutral + cuenta.negativo;
  const ejemplo = (tono: Tono) =>
    lista.flatMap((n, i) => (tonos[i] === tono ? [{ titulo: n.titulo, medio: n.medio, tono }] : [])).slice(0, 2);
  return {
    ...cuenta,
    total,
    indice: total ? (cuenta.positivo - cuenta.negativo) / total : 0,
    ejemplos: [...ejemplo("positivo"), ...ejemplo("negativo"), ...ejemplo("neutral")],
  };
}

export async function sentimientoDe(lista: Noticia[], tipo: "titulares" | "publicaciones" = "titulares"): Promise<Sentimiento> {
  const titulares = lista.slice(0, MAX_TITULARES);
  if (titulares.length === 0) return resumirTonos([], []);
  const texto = await generarTexto({
    maxTokens: 1200,
    system:
      `Clasificas el tono de ${tipo === "titulares" ? "titulares de prensa colombiana" : "publicaciones y comentarios de redes sociales (X, YouTube)"} sobre la política María Fernanda Cabal, desde el punto de vista de cómo la deja ante el lector: 'positivo' (la favorece o destaca un logro), 'negativo' (la perjudica, la critica o informa de un conflicto o revés para ella) o 'neutral' (informa sin inclinarse). Responde SOLO con un objeto JSON que asigne a cada número de titular su tono, por ejemplo {\"1\":\"neutral\",\"2\":\"negativo\"}. Sin texto adicional ni bloques de código.`,
    user: titulares.map((n, i) => `${i + 1}. ${n.titulo} (${n.medio})`).join("\n"),
  });
  const tonos = parsearTonos(texto, titulares.length);
  if (!tonos) throw new Error("La IA no devolvió una clasificación válida. Intenta de nuevo.");
  return resumirTonos(titulares, tonos);
}
