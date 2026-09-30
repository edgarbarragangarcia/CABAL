import "server-only";

import { generarConBusqueda, type FuenteWeb } from "@/lib/ia-config";

const SYSTEM = `Ayudas a una fundación política colombiana a investigar el perfil público de un posible candidato antes de decidir si le dan su aval. Busca en internet información pública y verificable: redes sociales conocidas (con su enlace si lo encuentras), menciones en medios, controversias o denuncias, trayectoria profesional y política, y cualquier señal relevante para juzgar su idoneidad.

Sé objetivo y conciso (un párrafo corto por tema, en español). Si el nombre es común y encuentras varias personas distintas, dilo explícitamente y no mezcles su información. Si no encuentras nada relevante sobre algún aspecto, dilo en vez de inventar o generalizar. Nunca presentes una suposición como un hecho.`;

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
    maxTokens: 1200,
  });
  if (!texto.trim()) throw new Error("La búsqueda no devolvió resultados.");
  return { texto, fuentes };
}
