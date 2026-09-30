import "server-only";

import { unstable_cache } from "next/cache";

import { ELECCIONES } from "./catalogo";
import { mismaPersona } from "./comparacion";
import { buscarAmbito, getVistaElectoral, type Candidato } from "./resultados";

/**
 * ¿Esta persona ha sido candidata? Se revisan automáticamente las carreras
 * "nivel 1" (circunscripción nacional, un solo archivo): Senado y
 * Presidencia, en 2018, 2022 y 2026 — incluyendo 2018 aunque venga de un
 * dataset distinto (Socrata, sin cédula nunca: `getVistaElectoral` ya
 * despacha internamente a ese otro origen para esa elección, así que se
 * consulta igual que las demás). Cámara (por departamento) y toda la
 * elección Territoriales 2023 (Gobernación/Alcaldía/Asamblea/Concejo/JAL)
 * quedan fuera del chequeo automático: no hay un índice nacional plano y
 * buscar en miles de territorios uno por uno no es viable en una sola
 * consulta — para esas, `buscarEnTerritorio` revisa una carrera a la vez.
 */

const CARRERAS_NACIONALES = ELECCIONES.flatMap((e) =>
  e.corporaciones
    .filter((c) => c.nivelEleccion === 1 && c.tipo !== "consulta")
    .map((c) => ({
      eleccionId: e.id,
      eleccionNombre: e.nombre,
      fecha: e.fecha,
      sigla: c.sigla,
      corporacionNombre: c.nombre,
    }))
);

type Carrera = (typeof CARRERAS_NACIONALES)[number];

export type CoincidenciaElectoral = {
  eleccionId: string;
  eleccionNombre: string;
  fecha: string;
  corporacion: string;
  corporacionNombre: string;
  partido?: string;
  candidato: { nombre: string; votos: number; pct: string; electo: boolean; cedula?: string };
  coincidePor: "cedula" | "nombre";
};

export type HistorialElectoral = {
  coincidencias: CoincidenciaElectoral[];
  /** Carreras que fallaron al consultarse (red, firewall): no leer eso como "nunca fue candidato". */
  noConsultadas: { eleccionId: string; eleccionNombre: string; corporacion: string }[];
  fuente: string;
};

function coincidenciasEnCandidatos(carrera: Carrera, candidatos: Candidato[], cedula: string, nombre: string) {
  const out: CoincidenciaElectoral[] = [];
  for (const k of candidatos) {
    if (k.soloLista) continue;
    const porCedula = !!k.cedula && k.cedula.trim() === cedula;
    const porNombre = !porCedula && nombre.length > 0 && mismaPersona(k.nombre, nombre);
    if (!porCedula && !porNombre) continue;
    out.push({
      eleccionId: carrera.eleccionId,
      eleccionNombre: carrera.eleccionNombre,
      fecha: carrera.fecha,
      corporacion: carrera.sigla,
      corporacionNombre: carrera.corporacionNombre,
      candidato: {
        nombre: k.nombre,
        votos: k.votos,
        pct: k.pct,
        electo: k.electo,
        ...(k.cedula ? { cedula: k.cedula.trim() } : {}),
      },
      coincidePor: porCedula ? "cedula" : "nombre",
    });
  }
  return out;
}

/** null = no se pudo consultar (para distinguirlo de "sin coincidencias"). */
async function buscarEnCarrera(carrera: Carrera, cedula: string, nombre: string): Promise<CoincidenciaElectoral[] | null> {
  try {
    const vista = await getVistaElectoral({ eleccion: carrera.eleccionId, corporacion: carrera.sigla, ambito: null });
    if (!vista.resultado) return [];
    return vista.resultado.circunscripciones.flatMap((circ) =>
      circ.partidos.flatMap((p) => coincidenciasEnCandidatos(carrera, p.candidatos, cedula, nombre).map((c) => ({ ...c, partido: p.nombre })))
    );
  } catch {
    return null;
  }
}

async function buscarHistorialNacional(cedula: string, nombre: string): Promise<HistorialElectoral> {
  const resultados = await Promise.all(CARRERAS_NACIONALES.map((c) => buscarEnCarrera(c, cedula, nombre)));
  return {
    coincidencias: resultados.flatMap((r) => r ?? []),
    noConsultadas: CARRERAS_NACIONALES.filter((_, i) => resultados[i] === null).map((c) => ({
      eleccionId: c.eleccionId,
      eleccionNombre: c.eleccionNombre,
      corporacion: c.sigla,
    })),
    fuente: "Preconteo oficial de la Registraduría Nacional del Estado Civil — Senado y Presidencia, 2018 a 2026",
  };
}

/** Se revisa una vez por semana: el historial de elecciones cerradas no cambia. */
export const getHistorialElectoralNacional = unstable_cache(buscarHistorialNacional, ["historial-electoral-nacional-v1"], {
  revalidate: 7 * 24 * 3600,
});

/** Búsqueda puntual en Cámara, Gobernación, Alcaldía, Asamblea, Concejo o JAL: una carrera y un territorio a la vez. */
export async function buscarEnTerritorio(
  params: { eleccionId: string; corporacionSigla: string; territorio: string },
  cedula: string,
  nombre: string
): Promise<{ ambitoNombre: string; coincidencias: CoincidenciaElectoral[] }> {
  const opciones = await buscarAmbito(params.eleccionId, params.corporacionSigla, params.territorio);
  const ambito = opciones[0];
  if (!ambito) throw new Error(`No se encontró "${params.territorio}" en esta elección.`);

  const vista = await getVistaElectoral({ eleccion: params.eleccionId, corporacion: params.corporacionSigla, ambito: ambito.codigo });
  const carrera: Carrera = {
    eleccionId: params.eleccionId,
    eleccionNombre: vista.eleccion.nombre,
    fecha: vista.eleccion.fecha,
    sigla: params.corporacionSigla,
    corporacionNombre: vista.corporacion.nombre,
  };
  const coincidencias = (vista.resultado?.circunscripciones ?? []).flatMap((circ) =>
    circ.partidos.flatMap((p) => coincidenciasEnCandidatos(carrera, p.candidatos, cedula, nombre).map((c) => ({ ...c, partido: p.nombre })))
  );
  return { ambitoNombre: ambito.nombre, coincidencias };
}
