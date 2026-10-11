import type { CorporacionInfo, EleccionInfo } from "./catalogo";
import type { Resultado } from "./resultados";

/**
 * Parte pura del almacén de resultados en Supabase (sin red ni `server-only`): cómo se convierte un resultado en una fila de
 * la tabla `resultados_electorales`, qué se poda y cuándo una fila guardada sigue valiendo. Va aparte de `almacen.ts` para
 * poder probarla sola.
 */

/** El territorio al que pertenece un resultado (los niveles son los de `NIVELES` del catálogo). */
export type Territorio = { codigo: string; nombre?: string; nivel?: number; dane?: string };

export type FilaResultado = {
  eleccion: string;
  corporacion: string;
  ambito: string;
  ambito_nombre: string | null;
  nivel: number | null;
  dane: string | null;
  vacio: boolean;
  con_mapa: boolean;
  podado: boolean;
  corte: string | null;
  mesas_total: number | null;
  mesas_informadas: number | null;
  censo: number | null;
  votantes: number | null;
  nulos: number | null;
  no_marcados: number | null;
  curules: number | null;
  datos: Resultado | null;
};

/**
 * En las listas (Senado, Cámara, Concejos...) cada territorio pequeño trae a los cientos de candidatos de la lista, casi todos
 * con 0 votos. A partir del municipio y por debajo del nivel donde se elige el cargo se guardan solo los que tienen votos (o
 * salieron electos): un candidato que no aparece tiene 0, que es como lo leen todas las consultas. El resto de la fila queda igual.
 */
export function podar(r: Resultado, corporacion: CorporacionInfo, nivel: number | undefined): { resultado: Resultado; podado: boolean } {
  if (corporacion.tipo !== "lista" || !nivel || nivel < 3 || nivel <= corporacion.nivelEleccion) return { resultado: r, podado: false };
  let podado = false;
  const circunscripciones = r.circunscripciones.map((c) => ({
    ...c,
    partidos: c.partidos.map((p) => {
      const candidatos = p.candidatos.filter((k) => k.votos > 0 || k.electo || k.soloLista);
      if (candidatos.length === p.candidatos.length) return p;
      podado = true;
      return { ...p, candidatos };
    }),
  }));
  return podado ? { resultado: { ...r, circunscripciones }, podado } : { resultado: r, podado };
}

/** La fila que se guarda: el resultado completo en `datos` y, aparte, lo que sirve para filtrar y consultar. `r` nulo = la fuente no publica ese territorio. */
export function filaDe(eleccion: EleccionInfo, corporacion: CorporacionInfo, t: Territorio, r: Resultado | null, conMapa: boolean): FilaResultado {
  const { resultado, podado } = r ? podar(r, corporacion, t.nivel) : { resultado: null, podado: false };
  return {
    eleccion: eleccion.id,
    corporacion: corporacion.sigla,
    ambito: t.codigo,
    ambito_nombre: t.nombre ?? null,
    nivel: t.nivel ?? null,
    dane: t.dane ?? null,
    vacio: resultado === null,
    con_mapa: conMapa,
    podado,
    corte: resultado?.corte || null,
    mesas_total: resultado?.mesas.total ?? null,
    mesas_informadas: resultado?.mesas.informadas ?? null,
    censo: resultado?.censo ?? null,
    votantes: resultado?.votantes ?? null,
    nulos: resultado?.nulos ?? null,
    no_marcados: resultado?.noMarcados ?? null,
    curules: resultado?.curules ?? null,
    datos: resultado,
  };
}

const DIA_MS = 86_400_000;
/** Durante los primeros días tras la elección el preconteo sigue moviéndose: las filas incompletas se renuevan cada pocos minutos. */
const DIAS_EN_CURSO = 3;
const MINUTOS_VIGENTE = 10;

/** ¿Sigue valiendo una fila guardada? Los resultados cerrados no caducan; los de una elección en curso, si el preconteo no estaba completo, sí. */
export function sigueVigente(
  eleccion: Pick<EleccionInfo, "fecha">,
  fila: { mesas_total: number | null; mesas_informadas: number | null; actualizado_en: string },
  ahora = Date.now()
): boolean {
  const enCurso = ahora - Date.parse(`${eleccion.fecha}T00:00:00-05:00`) < DIAS_EN_CURSO * DIA_MS;
  if (!enCurso) return true;
  const total = fila.mesas_total ?? 0;
  if (total > 0 && (fila.mesas_informadas ?? 0) >= total) return true;
  return ahora - Date.parse(fila.actualizado_en) < MINUTOS_VIGENTE * 60_000;
}

/** Reparte las filas en lotes que quepan en una petición (por filas y por tamaño aproximado del JSON). */
export function enLotes<T extends { datos: unknown }>(filas: T[], maxFilas = 40, maxBytes = 900_000): T[][] {
  const lotes: T[][] = [];
  let actual: T[] = [];
  let bytes = 0;
  for (const f of filas) {
    const peso = f.datos ? JSON.stringify(f.datos).length + 400 : 400;
    if (actual.length > 0 && (actual.length >= maxFilas || bytes + peso > maxBytes)) {
      lotes.push(actual);
      actual = [];
      bytes = 0;
    }
    actual.push(f);
    bytes += peso;
  }
  if (actual.length > 0) lotes.push(actual);
  return lotes;
}
