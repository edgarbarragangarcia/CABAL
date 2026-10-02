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

export function parsearTonos(texto: string, n: number): Tono[] | null {
  const m = texto.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[0]) as unknown;
    if (!Array.isArray(arr) || arr.length !== n) return null;
    const tonos = arr.map((x) => String(x).toLowerCase().trim());
    return tonos.every((t) => t === "positivo" || t === "neutral" || t === "negativo") ? (tonos as Tono[]) : null;
  } catch {
    return null;
  }
}

export function resumirTonos(lista: Noticia[], tonos: Tono[]): Sentimiento {
  const cuenta = { positivo: 0, neutral: 0, negativo: 0 };
  for (const t of tonos) cuenta[t]++;
  const total = tonos.length;
  const ejemplo = (tono: Tono) =>
    lista.flatMap((n, i) => (tonos[i] === tono ? [{ titulo: n.titulo, medio: n.medio, tono }] : [])).slice(0, 2);
  return {
    ...cuenta,
    total,
    indice: total ? (cuenta.positivo - cuenta.negativo) / total : 0,
    ejemplos: [...ejemplo("positivo"), ...ejemplo("negativo"), ...ejemplo("neutral")],
  };
}

export async function sentimientoDe(lista: Noticia[]): Promise<Sentimiento> {
  const titulares = lista.slice(0, MAX_TITULARES);
  if (titulares.length === 0) return resumirTonos([], []);
  const texto = await generarTexto({
    maxTokens: 400,
    system:
      "Clasificas el tono de titulares de prensa colombiana sobre la política María Fernanda Cabal, desde el punto de vista de cómo la deja ante el lector: 'positivo' (la favorece o destaca un logro), 'negativo' (la perjudica, la critica o informa de un conflicto o revés para ella) o 'neutral' (informa sin inclinarse). Responde SOLO con un arreglo JSON de strings, uno por titular y en el mismo orden, por ejemplo [\"neutral\",\"negativo\"]. Sin texto adicional.",
    user: titulares.map((n, i) => `${i + 1}. ${n.titulo} (${n.medio})`).join("\n"),
  });
  const tonos = parsearTonos(texto, titulares.length);
  if (!tonos) throw new Error("La IA no devolvió una clasificación válida. Intenta de nuevo.");
  return resumirTonos(titulares, tonos);
}
