import "server-only";

import { generarConBusqueda, type FuenteWeb } from "@/lib/ia-config";

const SYSTEM = `Investigas el perfil público de un posible candidato para que una fundación política colombiana decida si le da su aval. Sigue este orden y busca activamente en internet para cada punto — no te conformes con una sola búsqueda genérica del nombre:

1. REDES SOCIALES (lo más importante: dedícale la mayoría de tus búsquedas). Busca la cuenta de esta persona en cada red por separado —por ejemplo "<nombre> Twitter", "<nombre> Instagram", "<nombre> Facebook", "<nombre> LinkedIn", "<nombre> TikTok"— y para cada cuenta que confirmes que es suya reporta: la red, el usuario o enlace, el número de seguidores (o su orden de magnitud si no puedes confirmar la cifra exacta) y qué tan activa está (fecha aproximada de su última publicación, si la ves). Si no encuentras una cuenta verificable en alguna red, dilo explícitamente en vez de omitirla.
2. Menciones recientes en medios, controversias o denuncias públicas.
3. Trayectoria profesional y política, en un párrafo breve.

Reglas:
- Nunca inventes ni redondees una cifra de seguidores que no viste en una fuente real; si no la encontraste, escribe "no se pudo confirmar" en vez de dar un número.
- Si el nombre es común y encuentras varias personas distintas, dilo explícitamente y no mezcles su información.
- Sé objetivo y conciso, en español, con un subtítulo corto por sección.`;

export type ResumenIa = { texto: string; fuentes: FuenteWeb[] };

/**
 * A diferencia de SIRI o Google Noticias, esto no es una fuente fija: es el
 * modelo de IA configurado en /admin/configuracion buscando en internet con
 * su propia herramienta de búsqueda (Claude o Gemini). Cuesta una llamada a
 * esa API por cada clic, así que se dispara a mano (botón "Buscar con IA"),
 * nunca junto con el resto de la ficha.
 */
export async function buscarResumenIa(nombre: string): Promise<ResumenIa> {
  const { texto, fuentes } = await generarConBusqueda({
    system: SYSTEM,
    user: `Investiga a: ${nombre}`,
    maxTokens: 2000,
  });
  if (!texto.trim()) throw new Error("La búsqueda no devolvió resultados.");
  return { texto, fuentes };
}
