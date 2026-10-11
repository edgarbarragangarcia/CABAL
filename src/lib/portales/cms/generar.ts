import "server-only";

import { generarTexto } from "@/lib/ia-config";
import { leerArticuloIa, leerIdeasIa, promptArticulo, promptIdeas, type BorradorIa, type ContextoIa, type IdeaIa, type PeticionArticulo } from "./ia";

/**
 * Pide un artículo (o ideas de artículos) al proveedor de IA que el panel tenga configurado en Configuración (Claude, Gemini u
 * OpenAI). Sin clave, `generarTexto` lanza un error claro que se muestra tal cual. El resultado nunca se publica solo.
 */

export async function generarArticulo(c: ContextoIa, p: PeticionArticulo): Promise<BorradorIa> {
  const { system, user, maxTokens } = promptArticulo(c, p);
  const borrador = leerArticuloIa(await generarTexto({ system, user, maxTokens }), c.tematica);
  return { ...borrador, tipo: p.tipoId ?? "", categoria: borrador.categoria || p.categoria || "" };
}

export async function generarIdeas(c: ContextoIa, cantidad = 8, enfoque?: string): Promise<IdeaIa[]> {
  const { system, user, maxTokens } = promptIdeas(c, cantidad, enfoque);
  return leerIdeasIa(await generarTexto({ system, user, maxTokens }), c.tematica);
}
