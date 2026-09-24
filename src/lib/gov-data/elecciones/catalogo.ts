/**
 * Elecciones con preconteo oficial publicado por la Registraduría en JSON
 * (un archivo por corporación y ámbito territorial). Lo usan el servidor
 * (para armar las URLs) y el cliente (selectores), así que no importa nada
 * de servidor.
 */

/** Cómo se leen los resultados: un ganador, listas con curules o consultas. */
export type TipoCorporacion = "uninominal" | "lista" | "consulta";

export type CorporacionInfo = {
  sigla: string;
  nombre: string;
  tipo: TipoCorporacion;
  /** Nivel territorial donde se elige (2 departamento, 3 municipio, 5 comuna); 1 = todo el país. */
  nivelEleccion: number;
};

export type EleccionInfo = {
  id: string;
  nombre: string;
  fecha: string;
  /** Subdominio de registraduria.gov.co con el preconteo. */
  host: string;
  corporaciones: CorporacionInfo[];
};

const PRESIDENTE: CorporacionInfo[] = [
  { sigla: "PR", nombre: "Presidencia", tipo: "uninominal", nivelEleccion: 1 },
];

export const ELECCIONES: EleccionInfo[] = [
  {
    id: "presidencia-2026-2v",
    nombre: "Presidencia 2026 · 2ª vuelta",
    fecha: "2026-06-21",
    host: "resultadosprecpresidente2026-2v",
    corporaciones: PRESIDENTE,
  },
  {
    id: "presidencia-2026-1v",
    nombre: "Presidencia 2026 · 1ª vuelta",
    fecha: "2026-05-31",
    host: "resultadosprecpresidente2026-1v",
    corporaciones: PRESIDENTE,
  },
  {
    id: "congreso-2026",
    nombre: "Congreso 2026",
    fecha: "2026-03-08",
    host: "resultadospreccongreso2026",
    corporaciones: [
      { sigla: "SE", nombre: "Senado", tipo: "lista", nivelEleccion: 1 },
      { sigla: "CA", nombre: "Cámara", tipo: "lista", nivelEleccion: 2 },
      { sigla: "CN", nombre: "Consultas", tipo: "consulta", nivelEleccion: 1 },
      { sigla: "CT", nombre: "CITREP (paz)", tipo: "lista", nivelEleccion: 2 },
    ],
  },
  {
    id: "territoriales-2023",
    nombre: "Territoriales 2023",
    fecha: "2023-10-29",
    host: "resultadosprec2023",
    corporaciones: [
      { sigla: "GO", nombre: "Gobernación", tipo: "uninominal", nivelEleccion: 2 },
      { sigla: "AL", nombre: "Alcaldía", tipo: "uninominal", nivelEleccion: 3 },
      { sigla: "AS", nombre: "Asamblea", tipo: "lista", nivelEleccion: 2 },
      { sigla: "CO", nombre: "Concejo", tipo: "lista", nivelEleccion: 3 },
      { sigla: "JA", nombre: "JAL", tipo: "lista", nivelEleccion: 5 },
    ],
  },
  {
    id: "presidencia-2022-2v",
    nombre: "Presidencia 2022 · 2ª vuelta",
    fecha: "2022-06-19",
    host: "resultadosprecpresidente2v",
    corporaciones: PRESIDENTE,
  },
  {
    id: "presidencia-2022-1v",
    nombre: "Presidencia 2022 · 1ª vuelta",
    fecha: "2022-05-29",
    host: "resultadosprecpresidente1v",
    corporaciones: PRESIDENTE,
  },
  {
    id: "congreso-2022",
    nombre: "Congreso 2022",
    fecha: "2022-03-13",
    host: "resultadospreccongreso",
    corporaciones: [
      { sigla: "SE", nombre: "Senado", tipo: "lista", nivelEleccion: 1 },
      { sigla: "CA", nombre: "Cámara", tipo: "lista", nivelEleccion: 2 },
      { sigla: "CT", nombre: "CITREP (paz)", tipo: "lista", nivelEleccion: 2 },
      { sigla: "PH", nombre: "Consulta Pacto Histórico", tipo: "consulta", nivelEleccion: 1 },
      { sigla: "EP", nombre: "Consulta Equipo por Colombia", tipo: "consulta", nivelEleccion: 1 },
      { sigla: "CC", nombre: "Consulta Centro Esperanza", tipo: "consulta", nivelEleccion: 1 },
    ],
  },
];

/** Circunscripciones (campo `cam` de los archivos del preconteo). */
export const CIRCUNSCRIPCIONES: Record<string, string> = {
  "0": "Nacional",
  "1": "Territorial",
  "2": "Municipal",
  "3": "Local",
  "4": "Indígenas",
  "5": "Afrodescendientes",
  "9": "CITREP",
};

export const NIVELES: Record<number, string> = {
  1: "País",
  2: "Departamento",
  3: "Municipio",
  4: "Zona",
  5: "Comuna",
  6: "Puesto",
  7: "Mesa",
};

export function findEleccion(id: string | null | undefined) {
  return ELECCIONES.find((e) => e.id === id);
}
