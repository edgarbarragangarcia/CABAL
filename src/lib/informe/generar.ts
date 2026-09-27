import "server-only";

import { generarTexto } from "@/lib/ia-config";
import { formatearInforme, promptAnalisis, recolectar } from "./informe";

const SISTEMA =
  "Eres analista de comunicación política en Colombia. Con los titulares, videos y visitas que te dan, escribe en español una lectura breve de la semana: 'Qué pasó' (2 a 3 frases con los temas dominantes) y 'Qué vigilar' (2 o 3 puntos). Usa solo lo que está en los datos: no inventes hechos, cifras ni opiniones. Sé neutral y concreto.";

/** Recoge las fuentes, pide la lectura a la IA (si no hay proveedor configurado, el informe sale sin ella) y arma el mensaje. */
export async function generarInforme(): Promise<{ html: string; conIA: boolean }> {
  const datos = await recolectar();
  let analisis: string | undefined;
  try {
    if (datos.noticias.length || datos.videos.length) {
      analisis = await generarTexto({ system: SISTEMA, user: promptAnalisis(datos), maxTokens: 700 });
    }
  } catch {
    analisis = undefined;
  }
  return { html: formatearInforme(datos, analisis), conIA: !!analisis?.trim() };
}
