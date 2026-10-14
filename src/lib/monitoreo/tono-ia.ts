import "server-only";

import { generarTexto } from "@/lib/ia-config";
import { parsearTonos, type Tono } from "./sentimiento";

/**
 * Tono de titulares y publicaciones hacia María Fernanda, medido por la IA configurada (Configuración). Es mucho más fino que el
 * estimado por palabras: entiende quién critica a quién. Se clasifica por lotes y se recuerda el resultado para no repetir el gasto.
 */
const LOTE = 50;
const recuerdo = new Map<string, Tono>();
const clave = (t: string) => t.toLowerCase().replace(/\W+/g, " ").trim().slice(0, 160);

const SISTEMA =
  "Clasificas el tono de titulares y publicaciones de prensa y redes colombianas desde el punto de vista de cómo dejan ante el lector a la política María Fernanda Cabal. " +
  "'positivo': la favorece o destaca un logro, apoyo o ventaja suya. 'negativo': la perjudica, la critica, la ataca o informa de un revés, conflicto o ruptura que la golpea. " +
  "'neutral': informa sin inclinarse, o trata de otras personas. Importa quién actúa: si ella critica a otro, es neutral (o positivo si la presenta con fuerza); si otro la critica a ella, es negativo. " +
  "Responde SOLO con un objeto JSON que asigne a cada número su tono, por ejemplo {\"1\":\"neutral\",\"2\":\"negativo\"}. Sin texto adicional ni bloques de código.";

const SISTEMA_COMENTARIOS =
  "Clasificas comentarios que escribe la gente bajo videos y publicaciones sobre la política colombiana María Fernanda Cabal. " +
  "'positivo': el comentario la apoya, la defiende o la elogia (o apoya sus ideas). 'negativo': la ataca, la insulta, se burla de ella, la critica o rechaza lo que hace. " +
  "'neutral': pregunta, informa, habla de otra cosa o no toma partido. Si el comentario ataca a sus críticos o a sus rivales, es positivo hacia ella. " +
  "Responde SOLO con un objeto JSON que asigne a cada número su tono, por ejemplo {\"1\":\"neutral\",\"2\":\"negativo\"}. Sin texto adicional ni bloques de código.";

/** Clasifica los textos (sin repetir los ya medidos) y devuelve el tono de cada uno en el mismo orden. */
export async function clasificarTonos(textos: string[], comentarios = false): Promise<(Tono | null)[]> {
  const unicos = [...new Set(textos.map(clave))].filter((k) => k && !recuerdo.has(k));
  const porClave = new Map(textos.map((t) => [clave(t), t]));
  const lotes: string[][] = [];
  for (let i = 0; i < unicos.length; i += LOTE) lotes.push(unicos.slice(i, i + LOTE));
  const cola = [...lotes];
  let error: Error | null = null;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cola.length && !error) {
        const lote = cola.shift()!;
        try {
          const salida = await generarTexto({ system: comentarios ? SISTEMA_COMENTARIOS : SISTEMA, user: lote.map((k, i) => `${i + 1}. ${porClave.get(k)!.replace(/\s+/g, " ").slice(0, 260)}`).join("\n"), maxTokens: 1200 });
          const tonos = parsearTonos(salida, lote.length);
          lote.forEach((k, i) => tonos?.[i] && recuerdo.set(k, tonos[i]!));
        } catch (e) {
          error = e instanceof Error ? e : new Error("No fue posible clasificar.");
        }
      }
    })
  );
  if (error && unicos.every((k) => !recuerdo.has(k))) throw error;
  return textos.map((t) => recuerdo.get(clave(t)) ?? null);
}
