import "server-only";

import { generarConBusqueda, type FuenteWeb } from "@/lib/ia-config";
import type { Tema } from "./presencia-internet";

const SYSTEM = `Eres analista de inteligencia política para la Fundación Escuela Libertad (María Fernanda Cabal). Investigas a fondo el perfil público de una persona que pide un aval, para que la Fundación decida con evidencia. Usa tu herramienta de búsqueda web activamente (varias búsquedas distintas, no una sola) y apóyate también en los titulares de prensa que se te entregan.

Investiga, en este orden:
1. Redes sociales: cuenta de la persona en X/Twitter, Instagram, Facebook, TikTok, YouTube y LinkedIn (usuario o enlace, seguidores, actividad reciente) y de qué habla.
2. Orientación política: discurso, partidos y causas que ha apoyado, con quién se ha aliado, a quién ha criticado o respaldado. ¿Su discurso es de izquierda, centro o derecha?
3. ¿Ha hablado alguna vez de María Fernanda Cabal (a favor o en contra), o de su partido y su entorno? Cita qué dijo, dónde y cuándo.
4. Controversias, denuncias, procesos, contradicciones o cambios de bando.
5. Trayectoria profesional y política.

REGLAS ESTRICTAS:
- Todo hecho debe poder rastrearse a una fuente. No inventes ni redondees cifras (seguidores, fechas). Si no lo encontraste, di "no se encontró" o "no se pudo confirmar".
- Si el nombre es común y hay varias personas, dilo y separa; no mezcles.
- Distingue hecho de inferencia: la orientación es una inferencia, justifícala con evidencia concreta y marca la confianza.
- Un titular no prueba el contenido de una nota: no atribuyas a la persona algo que el titular solo insinúa.

Responde ÚNICAMENTE con un objeto JSON (sin texto antes ni después, sin bloques de código) con esta forma exacta:
{
 "resumen": "3 a 5 frases con lo esencial",
 "homonimos": "advertencia si hay varias personas con ese nombre, o cadena vacía",
 "orientacion": {"etiqueta": "izquierda|centro-izquierda|centro|centro-derecha|derecha|no determinable", "confianza": "alta|media|baja", "justificacion": "por qué", "evidencia": ["hecho concreto con su fuente", "..."]},
 "cabal": {"hablaDeCabal": "si|no|no se encontró", "detalle": "qué dijo y en qué contexto, o por qué no se encontró", "citas": ["cita o referencia concreta con fecha y medio", "..."]},
 "redes": [{"red": "X", "usuario": "@...", "seguidores": "cifra confirmada o 'no se pudo confirmar'", "actividad": "última publicación aproximada y temas"}],
 "controversias": ["..."],
 "trayectoria": "párrafo breve",
 "riesgo": {"nivel": "bajo|medio|alto", "motivos": ["..."]},
 "recomendacion": "una frase: qué conviene verificar o decidir antes de dar el aval"
}`;

export type Analisis = {
  resumen: string;
  homonimos: string;
  orientacion: { etiqueta: string; confianza: string; justificacion: string; evidencia: string[] };
  cabal: { hablaDeCabal: string; detalle: string; citas: string[] };
  redes: { red: string; usuario: string; seguidores: string; actividad: string }[];
  controversias: string[];
  trayectoria: string;
  riesgo: { nivel: string; motivos: string[] };
  recomendacion: string;
};

export type ResumenIa = { analisis: Analisis | null; texto: string; fuentes: FuenteWeb[] };

const lista = (x: unknown): string[] => (Array.isArray(x) ? x.map(String).filter(Boolean) : []);
const cad = (x: unknown) => (typeof x === "string" ? x : "");

export function leerAnalisis(texto: string): Analisis | null {
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (ini < 0 || fin <= ini) return null;
  // Saltos de línea sueltos dentro de las cadenas y comas finales invalidan el JSON aunque el contenido esté bien.
  const limpio = texto.slice(ini, fin + 1).replace(/[\u0000-\u001F]+/g, " ").replace(/,\s*([}\]])/g, "$1");
  try {
    const j = JSON.parse(limpio) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    return {
      resumen: cad(j.resumen),
      homonimos: cad(j.homonimos),
      orientacion: {
        etiqueta: cad(j.orientacion?.etiqueta) || "no determinable",
        confianza: cad(j.orientacion?.confianza) || "baja",
        justificacion: cad(j.orientacion?.justificacion),
        evidencia: lista(j.orientacion?.evidencia),
      },
      cabal: { hablaDeCabal: cad(j.cabal?.hablaDeCabal) || "no se encontró", detalle: cad(j.cabal?.detalle), citas: lista(j.cabal?.citas) },
      redes: Array.isArray(j.redes)
        ? j.redes.map((r: Record<string, unknown>) => ({ red: cad(r.red), usuario: cad(r.usuario), seguidores: cad(r.seguidores), actividad: cad(r.actividad) }))
        : [],
      controversias: lista(j.controversias),
      trayectoria: cad(j.trayectoria),
      riesgo: { nivel: cad(j.riesgo?.nivel) || "medio", motivos: lista(j.riesgo?.motivos) },
      recomendacion: cad(j.recomendacion),
    };
  } catch {
    return null;
  }
}

/** Resumen de los titulares por tema, para que el modelo parta de evidencia real y no solo de su búsqueda. */
function titulares(temas: Tema[]) {
  return temas
    .map((t) => `## ${t.titulo}\n${t.noticias.slice(0, 15).map((n) => `- ${n.titulo} (${n.medio}, ${n.fecha.slice(0, 10)})`).join("\n") || "- (sin resultados)"}`)
    .join("\n\n");
}

/**
 * Cuesta una llamada a la IA configurada (con búsqueda web), por eso solo se
 * dispara con el botón, nunca sola.
 */
export async function buscarResumenIa(nombre: string, temas: Tema[]): Promise<ResumenIa> {
  const { texto, fuentes } = await generarConBusqueda({
    system: SYSTEM,
    user: `Persona a investigar: ${nombre}\n\nTitulares de prensa ya recolectados (Google Noticias):\n\n${titulares(temas)}`,
    maxTokens: 6000,
  });
  if (!texto.trim()) throw new Error("La búsqueda no devolvió resultados.");
  return { analisis: leerAnalisis(texto), texto, fuentes };
}
