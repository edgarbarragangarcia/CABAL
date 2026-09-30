import "server-only";

import { unstable_cache } from "next/cache";

import { querySocrataDataset } from "../socrata";
import { AVALES_DATASETS } from "./datasets";

/**
 * Sanciones e inhabilidades disciplinarias vigentes o históricas de una
 * persona, del dataset abierto SIRI (Función Pública). Es la misma fuente
 * que consulta el formulario de "Consulta de Antecedentes" de la
 * Procuraduría, pero publicada como dato abierto (Ley de Transparencia): sin
 * la pregunta de verificación que ese formulario exige, y sin restricción de
 * uso. No reemplaza el certificado oficial.
 */

type SiriRow = {
  numero_siri: string;
  tipo_inhabilidad: string;
  calidad_persona?: string;
  numero_identificacion: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  cargo?: string;
  lugar_hechos_departamento?: string;
  lugar_hechos_municipio?: string;
  sanciones?: string;
  duracion_anos?: string;
  duracion_mes?: string;
  duracion_dias?: string;
  providencia?: string;
  autoridad?: string;
  fecha_efectos_juridicos?: string;
  numero_proceso?: string;
  entidad_sancionado?: string;
};

export type SancionDisciplinaria = {
  numeroSiri: string;
  tipoInhabilidad: string;
  calidadPersona: string;
  cargo: string;
  entidadSancionado: string;
  lugarHechos: string;
  sanciones: string;
  duracion: string;
  providencia: string;
  autoridad: string;
  fechaEfectosJuridicos: string;
  numeroProceso: string;
};

export type AntecedentesDisciplinarios = {
  encontrada: boolean;
  sanciones: SancionDisciplinaria[];
  fuente: string;
};

const clean = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim();

const duracion = (r: SiriRow) =>
  [
    r.duracion_anos && `${clean(r.duracion_anos)} año(s)`,
    r.duracion_mes && `${clean(r.duracion_mes)} mes(es)`,
    r.duracion_dias && `${clean(r.duracion_dias)} día(s)`,
  ]
    .filter(Boolean)
    .join(", ");

const FUENTE = `${AVALES_DATASETS.antecedentesDisciplinarios.source} (datos.gov.co)`;

async function buscar(cedula: string): Promise<AntecedentesDisciplinarios> {
  const rows = await querySocrataDataset<SiriRow>(AVALES_DATASETS.antecedentesDisciplinarios.id, {
    $where: `trim(numero_identificacion)='${cedula}'`,
    $limit: 200,
  });

  const sanciones = rows.map((r) => ({
    numeroSiri: r.numero_siri,
    tipoInhabilidad: clean(r.tipo_inhabilidad),
    calidadPersona: clean(r.calidad_persona),
    cargo: clean(r.cargo),
    entidadSancionado: clean(r.entidad_sancionado),
    lugarHechos: [clean(r.lugar_hechos_municipio), clean(r.lugar_hechos_departamento)].filter(Boolean).join(", "),
    sanciones: clean(r.sanciones),
    duracion: duracion(r),
    providencia: clean(r.providencia),
    autoridad: clean(r.autoridad),
    fechaEfectosJuridicos: clean(r.fecha_efectos_juridicos),
    numeroProceso: clean(r.numero_proceso),
  }));

  return { encontrada: sanciones.length > 0, sanciones, fuente: FUENTE };
}

/** Sanciones nuevas pesan en una decisión de aval: caché más corta que la hoja de vida. */
export const getAntecedentesDisciplinarios = unstable_cache(buscar, ["antecedentes-disciplinarios-v1"], {
  revalidate: 24 * 3600,
});
