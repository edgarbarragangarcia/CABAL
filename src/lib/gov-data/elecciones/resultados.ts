import "server-only";

import { unstable_cache } from "next/cache";

import { ELECCIONES_DATA, GEOS } from "@/data/elecciones";
import { findEleccion, type CorporacionInfo, type EleccionInfo } from "./catalogo";

/**
 * Resultados de cualquier elección y corporación del catálogo, ámbito por
 * ámbito: la división territorial sale del snapshot del nomenclátor
 * (scripts/snapshot-elecciones.mjs) y los votos del preconteo oficial de la
 * Registraduría, `https://<host>.registraduria.gov.co/json/ACT/<sigla>/<código>.json`.
 * Cada archivo trae todos los partidos y candidatos de ese ámbito, más el
 * ganador en cada territorio del mapa (`mapagan`).
 */

// ------------------------------------------------------------- tipos ---

export type Candidato = {
  codigo: string;
  nombre: string;
  /** Fórmula (vicepresidencia), si la hay. */
  formula?: string;
  votos: number;
  pct: string;
  electo: boolean;
  /** Votos marcados solo por el logo del partido, sin candidato. */
  soloLista: boolean;
  /** Cédula (pública en el preconteo): nombra su foto y ubica su hoja de vida. */
  cedula?: string;
  /** Posición en el tarjetón, en las presidenciales. */
  sorteo?: string;
};

export type PartidoResultado = {
  codigo: string;
  nombre: string;
  color: string;
  /** Código del nomenclátor que nombra el archivo del logo. */
  logo?: string;
  votos: number;
  pct: string;
  curules: number;
  candidatos: Candidato[];
};

export type Ganador = {
  codigo: string;
  nombre: string;
  /** Código DANE, para ubicarlo en el mapa. */
  dane?: string;
  partido: string;
  partidoNombre: string;
  color: string;
  votos: number;
  pct: string;
  votantes: number;
  participacion: string;
  mesasPct: string;
  /** Candidato ganador (cargos de un solo elegido). */
  candidato?: string;
  empate: boolean;
};

export type Circunscripcion = {
  codigo: string;
  curules: number;
  votantes: number;
  validos: number;
  blancos: number;
  pctBlancos: string;
  partidos: PartidoResultado[];
  mapa: Ganador[];
};

export type Resultado = {
  /** Corte del preconteo, "DD/MM HH:MM". */
  corte: string;
  mesas: { total: number; informadas: number; pct: string };
  censo: number;
  votantes: number;
  participacion: string;
  nulos: number;
  noMarcados: number;
  curules: number;
  circunscripciones: Circunscripcion[];
};

export type AmbitoRef = { codigo: string; nombre: string; nivel: number; dane?: string; mesas?: number };

export type VistaElectoral = {
  eleccion: EleccionInfo;
  corporacion: CorporacionInfo;
  ambito: AmbitoRef;
  ruta: AmbitoRef[];
  hijos: AmbitoRef[];
  /** Ganador en cada hijo (cuando son pocos, se consulta cada uno). */
  ganadoresHijos: Ganador[] | null;
  /** null: la Registraduría no publica este ámbito para la corporación. */
  resultado: Resultado | null;
  fuente: string;
};

// -------------------------------------------------------- geografía ---

/** [código, nombre, nivel, mesas, posición del padre, DANE?] */
type Row = [string, string, number, number, number, string?];

type Geografia = {
  rows: Row[];
  byCode: Map<string, number>;
  children: Map<number, number[]>;
  byDane: Map<string, number>;
};

type EleccionData = {
  corporaciones: { sigla: string; nombre: string; geo: string }[];
  partidos: Record<string, [string, string | null, string?]>;
};

const geoCache = new Map<string, Promise<Geografia>>();

function loadGeografia(key: string): Promise<Geografia> {
  let pending = geoCache.get(key);
  if (!pending) {
    const load = GEOS[key];
    if (!load) throw new Error(`Geografía ${key} no encontrada.`);
    pending = load().then(({ default: data }) => {
      const rows = data as Row[];
      const byCode = new Map<string, number>();
      const children = new Map<number, number[]>();
      const byDane = new Map<string, number>();
      rows.forEach((r, i) => {
        byCode.set(r[0], i);
        if (r[5] && !byDane.has(r[5])) byDane.set(r[5], i);
        if (r[4] >= 0) {
          const list = children.get(r[4]) ?? [];
          list.push(i);
          children.set(r[4], list);
        }
      });
      return { rows, byCode, children, byDane };
    });
    geoCache.set(key, pending);
    pending.catch(() => geoCache.delete(key));
  }
  return pending;
}

const dataCache = new Map<string, Promise<EleccionData>>();

function loadEleccionData(id: string): Promise<EleccionData> {
  let pending = dataCache.get(id);
  if (!pending) {
    const load = ELECCIONES_DATA[id as keyof typeof ELECCIONES_DATA];
    if (!load) throw new Error(`Elección ${id} no encontrada.`);
    pending = load().then(({ default: data }) => data as unknown as EleccionData);
    dataCache.set(id, pending);
    pending.catch(() => dataCache.delete(id));
  }
  return pending;
}

const ref = (geo: Geografia, i: number): AmbitoRef => {
  const [codigo, nombre, nivel, mesas, , dane] = geo.rows[i];
  return { codigo, nombre, nivel, dane, ...(nivel === 6 ? { mesas } : {}) };
};

// ----------------------------------------------------------- preconteo ---

type RawCand = {
  codcan: string;
  cedula?: string;
  sorteo?: string;
  nomcan: string;
  apecan: string;
  nomcan2?: string;
  apecan2?: string;
  vot: string;
  pvot: string;
  carg: string;
};
type RawParty = { act: { codpar: string; vot: string; pvot: string; carg: string; cantotabla?: RawCand[] } };
type RawMapa = {
  amb: string;
  codpar: string;
  vot: string;
  pvot: string;
  votant: string;
  pvotant: string;
  pmesesc: string;
  nombre: string;
  hayEmpate: string;
  cantotabla?: { nomcan: string; apecan: string };
};
type RawCamara = {
  cam: string;
  carg: string;
  totales: { act: Record<string, string> };
  partotabla?: RawParty[];
  mapagan?: RawMapa[];
};
type Raw = {
  mdhm: string;
  totales: { act: Record<string, string> };
  camaras?: RawCamara[];
};

const num = (s: string | undefined) => Number(s ?? 0) || 0;
const clean = (s: string | undefined) => (s ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const fullName = (nom?: string, ape?: string) => clean(`${nom ?? ""} ${ape ?? ""}`);

/** Color estable para partidos sin color oficial en el nomenclátor. */
function fallbackColor(codigo: string) {
  let h = 0;
  for (const ch of codigo) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

function normalizar(raw: Raw, partidos: EleccionData["partidos"], geo: Geografia): Resultado {
  const t = raw.totales.act;
  const partido = (codigo: string) => {
    const [nombre, color, logo] = partidos[codigo] ?? [`Partido ${codigo}`, null];
    return { nombre: clean(nombre), color: color ?? fallbackColor(codigo), ...(logo ? { logo } : {}) };
  };
  const mdhm = raw.mdhm ?? "";
  return {
    corte: mdhm.length === 8 ? `${mdhm.slice(2, 4)}/${mdhm.slice(0, 2)} ${mdhm.slice(4, 6)}:${mdhm.slice(6, 8)}` : "",
    mesas: { total: num(t.metota), informadas: num(t.mesesc), pct: t.pmesesc ?? "" },
    censo: num(t.centota),
    votantes: num(t.votant),
    participacion: t.pvotant ?? "",
    nulos: num(t.votnul),
    noMarcados: num(t.votnma),
    curules: num(t.cargtota ?? t.carg),
    circunscripciones: (raw.camaras ?? []).map((c) => {
      const ct = c.totales?.act ?? {};
      return {
        codigo: c.cam,
        curules: num(c.carg),
        votantes: num(ct.votant),
        validos: num(ct.votval),
        blancos: num(ct.votbla),
        pctBlancos: ct.pvotbla ?? "",
        partidos: (c.partotabla ?? []).map(({ act: p }) => ({
          codigo: p.codpar,
          ...partido(p.codpar),
          votos: num(p.vot),
          pct: p.pvot,
          curules: num(p.carg),
          candidatos: (p.cantotabla ?? []).map((x) => {
            const formula = fullName(x.nomcan2, x.apecan2);
            return {
              codigo: x.codcan,
              nombre: fullName(x.nomcan, x.apecan),
              ...(formula ? { formula } : {}),
              votos: num(x.vot),
              pct: x.pvot,
              electo: x.carg === "1",
              soloLista: x.codcan === "0",
              ...(x.cedula && x.cedula !== "0" ? { cedula: x.cedula } : {}),
              ...(x.sorteo ? { sorteo: x.sorteo } : {}),
            };
          }),
        })),
        mapa: (c.mapagan ?? []).map((m) => {
          const i = geo.byCode.get(m.amb);
          const p = partido(m.codpar);
          return {
            codigo: m.amb,
            nombre: clean(m.nombre),
            dane: i === undefined ? undefined : geo.rows[i][5],
            partido: m.codpar,
            partidoNombre: p.nombre,
            color: p.color,
            votos: num(m.vot),
            pct: m.pvot,
            votantes: num(m.votant),
            participacion: m.pvotant,
            mesasPct: m.pmesesc,
            ...(m.cantotabla ? { candidato: fullName(m.cantotabla.nomcan, m.cantotabla.apecan) } : {}),
            empate: m.hayEmpate === "1",
          };
        }),
      };
    }),
  };
}

/** El firewall de la Registraduría corta conexiones si llegan muchas seguidas: reintentar con pausa. */
async function descargar(url: string): Promise<Raw | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
      // Ámbitos sin elección para esa corporación (p. ej. JAL donde no hay).
      // Un 403 no cuenta: puede ser el firewall limitando, y esto se cachea para siempre.
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Algunos servidores responden la página de la app en vez de un 404.
      if (!text.trimStart().startsWith("{")) return null;
      return JSON.parse(text) as Raw;
    } catch (err) {
      if (attempt >= 3) {
        throw new Error(
          "La Registraduría no respondió (puede estar limitando las consultas). Intenta de nuevo en unos minutos.",
          { cause: err }
        );
      }
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
}

/** Resultados cerrados: cada archivo se pide una sola vez y queda en la caché de datos de Next. */
const descargarCacheado = unstable_cache(descargar, ["elecciones-preconteo-v2"], { revalidate: false });

const enCurso = new Map<string, Promise<Raw | null>>();
function descargarUnaVez(url: string) {
  let pending = enCurso.get(url);
  if (!pending) {
    pending = descargarCacheado(url);
    enCurso.set(url, pending);
    const done = () => enCurso.delete(url);
    pending.then(done, done);
  }
  return pending;
}

async function resultadoDe(
  eleccion: EleccionInfo,
  sigla: string,
  codigo: string,
  partidos: EleccionData["partidos"],
  geo: Geografia
): Promise<Resultado | null> {
  const raw = await descargarUnaVez(
    `https://${eleccion.host}.registraduria.gov.co/json/ACT/${sigla}/${codigo}.json`
  );
  return raw ? normalizar(raw, partidos, geo) : null;
}

/** Ganador de un ámbito completo (para las listas de zonas y puestos). */
function ganadorDe(ambito: AmbitoRef, r: Resultado | null): Ganador | null {
  const c = r?.circunscripciones[0];
  if (!r || !c) return null;
  const partidos = [...c.partidos].filter((p) => p.votos > 0).sort((a, b) => b.votos - a.votos);
  const top = partidos[0];
  if (!top) return null;
  const cand = [...top.candidatos].filter((x) => !x.soloLista).sort((a, b) => b.votos - a.votos)[0];
  return {
    codigo: ambito.codigo,
    nombre: ambito.nombre,
    dane: ambito.dane,
    partido: top.codigo,
    partidoNombre: top.nombre,
    color: top.color,
    votos: top.votos,
    pct: top.pct,
    votantes: r.votantes,
    participacion: r.participacion,
    mesasPct: r.mesas.pct,
    ...(cand ? { candidato: cand.nombre } : {}),
    empate: partidos[1]?.votos === top.votos,
  };
}

/** Pocas a la vez: son peticiones al mismo servidor. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

const MAX_HIJOS_CONSULTADOS = 40;

// -------------------------------------------------------------- vista ---

type ParamsAmbito = {
  eleccion: string;
  corporacion: string;
  ambito?: string | null;
  dane?: string | null;
};

/** Elección, corporación y ámbito pedidos, con su ruta y sus hijos (las mesas, si es un puesto). */
async function contexto(params: ParamsAmbito) {
  const eleccion = findEleccion(params.eleccion);
  if (!eleccion) throw new Error("Elección no válida.");
  const corporacion =
    eleccion.corporaciones.find((c) => c.sigla === params.corporacion) ?? eleccion.corporaciones[0];

  const data = await loadEleccionData(eleccion.id);
  const corpData = data.corporaciones.find((c) => c.sigla === corporacion.sigla);
  if (!corpData) throw new Error("Corporación no disponible para esta elección.");
  const geo = await loadGeografia(corpData.geo);

  // Ámbito: por código; si no, por DANE (al cambiar de elección se conserva
  // el departamento o municipio); si no, el país.
  let codigo = params.ambito ?? "";
  let mesa: number | null = null;
  let idx = geo.byCode.get(codigo);
  if (idx === undefined && codigo) {
    // Mesas: código del puesto + número de mesa a 6 dígitos.
    const puesto = geo.byCode.get(codigo.slice(0, -6));
    if (puesto !== undefined && geo.rows[puesto][2] === 6) {
      idx = puesto;
      mesa = Number(codigo.slice(-6));
    }
  }
  if (idx === undefined && params.dane) idx = geo.byDane.get(params.dane);
  if (idx === undefined) idx = 0;
  if (mesa === null) codigo = geo.rows[idx][0];

  const ruta: AmbitoRef[] = [];
  for (let i = idx; i >= 0; i = geo.rows[i][4]) ruta.unshift(ref(geo, i));

  let ambito = ref(geo, idx);
  let hijos: AmbitoRef[];
  if (mesa !== null) {
    ambito = { codigo, nombre: `Mesa ${mesa}`, nivel: 7 };
    ruta.push(ambito);
    hijos = [];
  } else if (ambito.nivel === 6) {
    hijos = Array.from({ length: ambito.mesas ?? 0 }, (_, k) => ({
      codigo: ambito.codigo + String(k + 1).padStart(6, "0"),
      nombre: `Mesa ${k + 1}`,
      nivel: 7,
    }));
  } else {
    hijos = (geo.children.get(idx) ?? []).map((i) => ref(geo, i));
  }
  return { eleccion, corporacion, data, geo, codigo, ambito, ruta, hijos };
}

export async function getVistaElectoral(params: ParamsAmbito): Promise<VistaElectoral> {
  const { eleccion, corporacion, data, geo, codigo, ambito, ruta, hijos } = await contexto(params);
  const resultado = await resultadoDe(eleccion, corporacion.sigla, codigo, data.partidos, geo);

  // Del país y los departamentos, `mapagan` ya trae el ganador de cada hijo.
  // Más abajo se consulta cada hijo, si no son demasiados.
  const mapa = resultado?.circunscripciones[0]?.mapa ?? [];
  const cubiertos = hijos.length > 0 && hijos.every((h) => mapa.some((m) => m.codigo === h.codigo));
  let ganadoresHijos: Ganador[] | null = null;
  if (!cubiertos && hijos.length > 0 && hijos.length <= MAX_HIJOS_CONSULTADOS && ambito.nivel >= 3) {
    const lista = await mapLimit(hijos, 4, async (h) => {
      try {
        return ganadorDe(h, await resultadoDe(eleccion, corporacion.sigla, h.codigo, data.partidos, geo));
      } catch {
        return null;
      }
    });
    ganadoresHijos = lista.filter((g): g is Ganador => g !== null);
  }

  return {
    eleccion,
    corporacion,
    ambito,
    ruta,
    hijos,
    ganadoresHijos,
    resultado,
    fuente: `Preconteo oficial de la Registraduría Nacional del Estado Civil (${eleccion.host}.registraduria.gov.co)`,
  };
}

// -------------------------------------------------------- un candidato ---

export type VotosHijo = {
  codigo: string;
  nombre: string;
  nivel: number;
  dane?: string;
  /** null: aún no se consultó (ver `pendientes`). */
  votos: number | null;
  /** % de los votos válidos del territorio. */
  pct: string;
};

export type VotosCandidato = {
  ambito: AmbitoRef;
  votos: number;
  pct: string;
  hijos: VotosHijo[];
  /** Hijos que no alcanzaron a consultarse: la siguiente llamada los completa (los demás ya están en caché). */
  pendientes: number;
};

/** Tiempo de consulta por llamada: Vercel corta la función a los 60 s. */
const PRESUPUESTO_MS = 40_000;

/**
 * Votos de un candidato en un ámbito y en cada uno de sus hijos, hasta las
 * mesas. Cada hijo es un archivo del preconteo con todos los candidatos, así
 * que se consulta uno por uno (y queda en caché, como en la vista general).
 */
export async function getVotosCandidato(
  params: ParamsAmbito & { circunscripcion: string; partido: string; candidato: string }
): Promise<VotosCandidato> {
  const { eleccion, corporacion, data, geo, codigo, ambito, hijos } = await contexto(params);
  const delCandidato = (r: Resultado | null) => {
    const circ =
      r?.circunscripciones.find((c) => c.codigo === params.circunscripcion) ??
      (r?.circunscripciones.length === 1 ? r.circunscripciones[0] : undefined);
    const x = circ?.partidos
      .find((p) => p.codigo === params.partido)
      ?.candidatos.find((k) => k.codigo === params.candidato);
    return { votos: x?.votos ?? 0, pct: x?.pct ?? "" };
  };

  const propio = delCandidato(await resultadoDe(eleccion, corporacion.sigla, codigo, data.partidos, geo));
  const limite = Date.now() + PRESUPUESTO_MS;
  const votosHijos = await mapLimit(hijos, 6, async (h): Promise<VotosHijo> => {
    const base = { codigo: h.codigo, nombre: h.nombre, nivel: h.nivel, ...(h.dane ? { dane: h.dane } : {}) };
    if (Date.now() > limite) return { ...base, votos: null, pct: "" };
    try {
      return { ...base, ...delCandidato(await resultadoDe(eleccion, corporacion.sigla, h.codigo, data.partidos, geo)) };
    } catch {
      return { ...base, votos: null, pct: "" };
    }
  });

  return {
    ambito,
    ...propio,
    hijos: votosHijos,
    pendientes: votosHijos.filter((h) => h.votos === null).length,
  };
}
