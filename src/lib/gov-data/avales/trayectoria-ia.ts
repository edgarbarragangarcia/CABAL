import "server-only";

import { generarConBusqueda, type FuenteWeb } from "@/lib/ia-config";

const SYSTEM = `Eres investigador de trayectoria política colombiana. Dado el nombre de una persona (y su cédula), averigua en la web TODOS los cargos de elección popular y de gobierno que ha ocupado o a los que se ha postulado, de cualquier año y en cualquier lugar: Presidencia, Senado, Cámara, Gobernación, Alcaldía, Asamblea, Concejo, JAL, ministerios, embajadas, direcciones de entidades, etc. Haz varias búsquedas distintas (Wikipedia, Senado, Cámara, Registraduría, prensa, páginas de partidos).

REGLAS: cada dato debe salir de una fuente que hayas encontrado; no inventes cargos, años ni votos. Si el nombre es común y hay varias personas, dilo y no las mezcles. Si no encuentras nada, devuelve la lista vacía y explícalo.

Responde ÚNICAMENTE con un JSON (sin texto extra ni bloques de código):
{"resumen":"2 a 4 frases","homonimos":"advertencia o cadena vacía","cargos":[{"cargo":"Senador de la República","lugar":"Nacional / departamento / municipio","periodo":"2010-2014","partido":"...","detalle":"votos, si fue electo o solo candidato, etc.","fuente":"medio o sitio"}]}
Ordena los cargos del más reciente al más antiguo. Sé conciso: cada campo de texto en una frase corta (máximo 25 palabras), sin repetir cargos.`;

export type Cargo = { cargo: string; lugar: string; periodo: string; partido: string; detalle: string; fuente: string };
export type Trayectoria = { resumen: string; homonimos: string; cargos: Cargo[]; fuentes: FuenteWeb[]; sinEstructura?: string };

const cad = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));

export async function buscarTrayectoria(nombre: string, cedula: string): Promise<Trayectoria> {
  const { texto, fuentes } = await generarConBusqueda({
    system: SYSTEM,
    user: `Persona: ${nombre}\nCédula: ${cedula}\nBusca su trayectoria política completa.`,
    maxTokens: 12000,
  });
  const limpiar = (t: string) => t.replace(/[\u0000-\u001F]+/g, " ").replace(/,\s*([}\]])/g, "$1");
  const aCargo = (c: Record<string, unknown>): Cargo => ({ cargo: cad(c.cargo), lugar: cad(c.lugar), periodo: cad(c.periodo), partido: cad(c.partido), detalle: cad(c.detalle), fuente: cad(c.fuente) });
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  try {
    const j = JSON.parse(limpiar(texto.slice(ini, fin + 1)));
    const cargos = (Array.isArray(j.cargos) ? j.cargos : []).map(aCargo).filter((c: Cargo) => c.cargo);
    return { resumen: cad(j.resumen), homonimos: cad(j.homonimos), cargos, fuentes };
  } catch {
    // Respuesta cortada o con un defecto: se rescatan los cargos que llegaron completos; nunca se muestra el JSON crudo.
    const cargos: Cargo[] = [];
    for (const m of texto.matchAll(/\{[^{}]*"cargo"[^{}]*\}/g)) {
      try {
        const c = aCargo(JSON.parse(limpiar(m[0])));
        if (c.cargo) cargos.push(c);
      } catch {}
    }
    const resumen = texto.match(/"resumen"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\"/g, '"') ?? "";
    return { resumen, homonimos: "", cargos, fuentes, ...(cargos.length === 0 ? { sinEstructura: "La IA respondió en un formato que no se pudo leer. Pulsa «Volver a buscar»." } : {}) };
  }
}
