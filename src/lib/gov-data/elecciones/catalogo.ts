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
  /** Qué se elige, para el selector. */
  descripcion: string;
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
  { sigla: "PR", nombre: "Presidencia", descripcion: "Presidente y vicepresidente", tipo: "uninominal", nivelEleccion: 1 },
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
      { sigla: "SE", nombre: "Senado", descripcion: "Senadores, circunscripción nacional", tipo: "lista", nivelEleccion: 1 },
      { sigla: "CA", nombre: "Cámara", descripcion: "Representantes por departamento", tipo: "lista", nivelEleccion: 2 },
      { sigla: "CN", nombre: "Consultas", descripcion: "Consultas interpartidistas", tipo: "consulta", nivelEleccion: 1 },
      { sigla: "CT", nombre: "CITREP (paz)", descripcion: "Curules de paz para víctimas", tipo: "lista", nivelEleccion: 2 },
    ],
  },
  {
    id: "territoriales-2023",
    nombre: "Territoriales 2023",
    fecha: "2023-10-29",
    host: "resultadosprec2023",
    corporaciones: [
      { sigla: "GO", nombre: "Gobernaciones", descripcion: "Gobernador de cada departamento", tipo: "uninominal", nivelEleccion: 2 },
      { sigla: "AL", nombre: "Alcaldías", descripcion: "Alcalde de cada municipio", tipo: "uninominal", nivelEleccion: 3 },
      { sigla: "AS", nombre: "Asambleas", descripcion: "Diputados por departamento", tipo: "lista", nivelEleccion: 2 },
      { sigla: "CO", nombre: "Concejos", descripcion: "Concejales por municipio", tipo: "lista", nivelEleccion: 3 },
      { sigla: "JA", nombre: "Ediles (JAL)", descripcion: "Juntas administradoras locales, por comuna", tipo: "lista", nivelEleccion: 5 },
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
      { sigla: "SE", nombre: "Senado", descripcion: "Senadores, circunscripción nacional", tipo: "lista", nivelEleccion: 1 },
      { sigla: "CA", nombre: "Cámara", descripcion: "Representantes por departamento", tipo: "lista", nivelEleccion: 2 },
      { sigla: "CT", nombre: "CITREP (paz)", descripcion: "Curules de paz para víctimas", tipo: "lista", nivelEleccion: 2 },
      { sigla: "PH", nombre: "Consulta Pacto Histórico", descripcion: "Consulta presidencial", tipo: "consulta", nivelEleccion: 1 },
      { sigla: "EP", nombre: "Consulta Equipo por Colombia", descripcion: "Consulta presidencial", tipo: "consulta", nivelEleccion: 1 },
      { sigla: "CC", nombre: "Consulta Centro Esperanza", descripcion: "Consulta presidencial", tipo: "consulta", nivelEleccion: 1 },
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

/** Una opción del selector: un cargo de una elección. */
export type OpcionCargo = {
  eleccionId: string;
  sigla: string;
  nombre: string;
  descripcion: string;
  fecha: string;
};

export const ANIOS = [...new Set(ELECCIONES.map((e) => e.fecha.slice(0, 4)))];

/** Cargos de un año; las dos vueltas presidenciales son opciones distintas. */
export function cargosDelAnio(anio: string): OpcionCargo[] {
  return ELECCIONES.filter((e) => e.fecha.startsWith(anio)).flatMap((e) =>
    e.corporaciones.map((c) => ({
      eleccionId: e.id,
      sigla: c.sigla,
      nombre: c.sigla === "PR" ? `Presidencia · ${e.id.endsWith("2v") ? "2ª" : "1ª"} vuelta` : c.nombre,
      descripcion: c.descripcion,
      fecha: e.fecha,
    }))
  );
}
