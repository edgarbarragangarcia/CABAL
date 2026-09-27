import "server-only";

import { unstable_cache } from "next/cache";

import { querySocrataDataset, type SoqlParams } from "../socrata";
import { ELECCIONES_DATA } from "@/data/elecciones";
import { normalizar } from "./comparacion";
import type { Candidato, Circunscripcion, Ganador, PartidoResultado, Resultado } from "./resultados";

/**
 * Congreso 2018 (Senado y Cámara): resultados mesa a mesa de datos.gov.co
 * (75f2-fe2s y vkjr-c6fe). El dataset trae una fila por mesa y candidato, más
 * los votos en blanco, nulos y no marcados; NO trae censo, curules, logos ni
 * cédulas, y le falta el departamento del Cesar. Cada ámbito se resuelve con
 * consultas agrupadas (SoQL) y se arma el mismo `Resultado` que los archivos
 * del preconteo de las otras elecciones.
 */

const DATASET: Record<string, string> = { SE: "75f2-fe2s", CA: "vkjr-c6fe" };

/** [código, nombre, nivel, mesas, posición del padre, DANE?, valor original (zona o puesto)?] */
type Fila = [string, string, number, number, number, string?, string?];
export type GeoAcceso = { rows: Fila[]; byCode: Map<string, number>; children: Map<number, number[]> };

type FilaVotos = { ncircunscripcion?: string; partido?: string; candidato?: string; k?: string; v: string };

const esc = (s: string) => s.replace(/'/g, "''");
const pad6 = (n: number) => String(n).padStart(6, "0");
const num = (s: string | undefined) => Number(s ?? 0) || 0;
const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

const ESPECIAL: Record<string, "blancos" | "nulos" | "noMarcados"> = {
  "VOTOS EN BLANCO": "blancos",
  "VOTOS NULOS": "nulos",
  "VOTOS NO MARCADOS": "noMarcados",
};
const SOLO_LISTA = "SOLO POR EL PARTIDO";

/** Códigos de circunscripción de la Registraduría (ver CIRCUNSCRIPCIONES en el catálogo). */
function codigoCircunscripcion(nombre: string) {
  const n = normalizar(nombre);
  if (n.startsWith("NACIONAL")) return "0";
  if (n.startsWith("TERRITORIAL")) return "1";
  if (n.startsWith("INDIGENA")) return "4";
  if (n.startsWith("AFRO")) return "5";
  return "6";
}

/** Partidos que cambiaron de nombre entre 2018 y 2022 (clave y valor, sin tildes ni signos). */
const RENOMBRADOS: Record<string, string> = {
  "PARTIDO SOCIAL DE UNIDAD NACIONAL PARTIDO DE LA U": "PARTIDO DE LA UNION POR LA GENTE PARTIDO DE LA U",
  // El dataset trae este nombre cortado ("DEL COMÚ").
  "PARTIDO FUERZA ALTERNATIVA REVOLUCIONARIA DEL COMU": "PARTIDO COMUNES",
};

type Oficial = { color: string; logo?: string };
let oficiales: Promise<Map<string, Oficial>> | null = null;

/** Color y logo oficiales de los partidos, según el nomenclátor de 2022 (los de 2018 no los traen). */
function cargarOficiales() {
  oficiales ??= ELECCIONES_DATA["congreso-2022"]().then(({ default: d }) => {
    const m = new Map<string, Oficial>();
    for (const [nombre, color, logo] of Object.values((d as unknown as { partidos: Record<string, [string, string | null, string?]> }).partidos)) {
      if (color) m.set(normalizar(nombre), { color, ...(logo && logo !== "0" ? { logo } : {}) });
    }
    return m;
  });
  return oficiales;
}

/** El partido de 2018 en el nomenclátor de 2022: por nombre exacto, renombrado, sin "G.S.C." o como comienzo del nombre. */
function oficialDe(m: Map<string, Oficial>, nombre: string): Oficial | undefined {
  const n = normalizar(nombre);
  const sinGsc = n.replace(/^G S C /, "PARTIDO ");
  for (const k of [n, RENOMBRADOS[n], sinGsc]) if (k && m.has(k)) return m.get(k);
  if (n.split(" ").length < 3) return undefined;
  for (const [k, v] of m) if (k.startsWith(`${n} `)) return v;
  return undefined;
}

function fallbackColor(clave: string) {
  let h = 0;
  for (const ch of clave) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

const porcentaje = (parte: number, total: number) =>
  `${(total ? (100 * parte) / total : 0).toFixed(2).replace(".", ",")}%`;

/** Las respuestas de datos.gov.co no cambian (resultados cerrados): quedan en caché de datos de Next. */
const consultarCacheada = unstable_cache(
  async (dataset: string, params: string) => querySocrataDataset<FilaVotos>(dataset, JSON.parse(params) as SoqlParams),
  ["congreso-2018-soda"],
  { revalidate: false }
);

/** Filtros SoQL del ámbito y su nivel, desde el código (país, departamento... o mesa = puesto + 6 dígitos). */
function ambitoDe(geo: GeoAcceso, codigo: string) {
  let idx = geo.byCode.get(codigo);
  let mesa: number | null = null;
  if (idx === undefined) {
    const puesto = geo.byCode.get(codigo.slice(0, -6));
    if (puesto !== undefined && geo.rows[puesto][2] === 6) {
      idx = puesto;
      mesa = Number(codigo.slice(-6));
    }
  }
  if (idx === undefined) return null;
  const donde: string[] = [];
  for (let i = idx; i > 0; i = geo.rows[i][4]) {
    const [, nombre, nivel, , , , original] = geo.rows[i];
    if (nivel === 2) donde.push(`ndepto='${esc(nombre)}'`);
    else if (nivel === 3) donde.push(`nmpio='${esc(nombre)}'`);
    else if (nivel === 4) donde.push(`zz='${esc(original ?? "")}'`);
    else if (nivel === 6) donde.push(`pp='${esc(original ?? "")}'`);
  }
  if (mesa !== null) donde.push(`mesa='${mesa}'`);
  return { idx, mesa, donde, nivel: mesa !== null ? 7 : geo.rows[idx][2] };
}

/** Mesas bajo un ámbito. */
function contarMesas(geo: GeoAcceso, idx: number): number {
  const [, , nivel, mesas] = geo.rows[idx];
  if (nivel === 6) return mesas;
  return (geo.children.get(idx) ?? []).reduce((s, h) => s + contarMesas(geo, h), 0);
}

type Acumulado = {
  partidos: Map<string, { nombre: string; candidatos: { nombre: string; votos: number }[]; votos: number }>;
  blancos: number;
  nulos: number;
  noMarcados: number;
};
const vacio = (): Acumulado => ({ partidos: new Map(), blancos: 0, nulos: 0, noMarcados: 0 });

function sumar(a: Acumulado, f: FilaVotos) {
  const votos = num(f.v);
  const especial = ESPECIAL[clean(f.candidato).toUpperCase()];
  if (!f.partido && especial) {
    a[especial] += votos;
    return;
  }
  const nombre = clean(f.partido) || "SIN PARTIDO";
  const clave = normalizar(nombre);
  const p = a.partidos.get(clave) ?? { nombre, candidatos: [], votos: 0 };
  p.votos += votos;
  p.candidatos.push({ nombre: clean(f.candidato) || SOLO_LISTA, votos });
  a.partidos.set(clave, p);
}

const totales = (a: Acumulado) => {
  const validos = [...a.partidos.values()].reduce((s, p) => s + p.votos, 0) + a.blancos;
  return { validos, votantes: validos + a.nulos + a.noMarcados };
};

/**
 * Resultado de un ámbito. Con `conMapa`, también el ganador en cada territorio
 * hijo (para el mapa y las listas); sin él, solo los totales del ámbito.
 */
export async function resultadoCongreso2018(
  sigla: string,
  codigo: string,
  geo: GeoAcceso,
  conMapa: boolean
): Promise<Resultado | null> {
  const dataset = DATASET[sigla];
  const ambito = dataset ? ambitoDe(geo, codigo) : null;
  if (!ambito) return null;
  const oficiales = await cargarOficiales();
  const colorDe = (nombre: string) => oficialDe(oficiales, nombre)?.color ?? fallbackColor(normalizar(nombre));
  const donde = ambito.donde.join(" AND ");
  const pedir = (params: SoqlParams) => consultarCacheada(dataset, JSON.stringify(params));

  const filas = await pedir({
    $select: "ncircunscripcion,partido,candidato,sum(votos) as v",
    ...(donde ? { $where: donde } : {}),
    $group: "ncircunscripcion,partido,candidato",
    $limit: 50000,
  });
  if (filas.length === 0) return null;

  const porCirc = new Map<string, Acumulado>();
  for (const f of filas) {
    const c = codigoCircunscripcion(f.ncircunscripcion ?? "");
    const a = porCirc.get(c) ?? vacio();
    sumar(a, f);
    porCirc.set(c, a);
  }

  // Ganador en cada hijo, por circunscripción.
  const mapas = new Map<string, Ganador[]>();
  const columna = { 1: "ndepto", 2: "nmpio", 3: "zz", 4: "pp", 6: "mesa" }[ambito.nivel as 1 | 2 | 3 | 4 | 6];
  if (conMapa && columna) {
    const [porPartido, especiales] = await Promise.all([
      pedir({
        $select: `${columna} as k,ncircunscripcion,partido,sum(votos) as v`,
        ...(donde ? { $where: `${donde} AND partido IS NOT NULL` } : { $where: "partido IS NOT NULL" }),
        $group: `${columna},ncircunscripcion,partido`,
        $limit: 50000,
      }),
      pedir({
        $select: `${columna} as k,ncircunscripcion,candidato,sum(votos) as v`,
        ...(donde ? { $where: `${donde} AND partido IS NULL` } : { $where: "partido IS NULL" }),
        $group: `${columna},ncircunscripcion,candidato`,
        $limit: 50000,
      }),
    ]);
    const hijos = new Map<string, { codigo: string; nombre: string; dane?: string }>();
    if (ambito.nivel === 6) {
      for (let m = 1; m <= geo.rows[ambito.idx][3]; m++) hijos.set(String(m), { codigo: codigo + pad6(m), nombre: `Mesa ${m}` });
    } else {
      for (const h of geo.children.get(ambito.idx) ?? []) {
        const [cod, nombre, nivel, , , dane, original] = geo.rows[h];
        hijos.set(nivel === 2 || nivel === 3 ? nombre : (original ?? ""), { codigo: cod, nombre, ...(dane ? { dane } : {}) });
      }
    }
    const acumulados = new Map<string, Acumulado>();
    const clave = (c: string, k: string | undefined) => `${c}|${k ?? ""}`;
    for (const f of porPartido) {
      const c = codigoCircunscripcion(f.ncircunscripcion ?? "");
      const a = acumulados.get(clave(c, f.k)) ?? vacio();
      sumar(a, { ...f, candidato: SOLO_LISTA });
      acumulados.set(clave(c, f.k), a);
    }
    for (const f of especiales) {
      const c = codigoCircunscripcion(f.ncircunscripcion ?? "");
      const a = acumulados.get(clave(c, f.k)) ?? vacio();
      sumar(a, f);
      acumulados.set(clave(c, f.k), a);
    }
    for (const [k, a] of acumulados) {
      const [c, hijoKey] = k.split("|");
      const hijo = hijos.get(hijoKey);
      if (!hijo || a.partidos.size === 0) continue;
      const { validos, votantes } = totales(a);
      const [ganador] = [...a.partidos.values()].sort((x, y) => y.votos - x.votos);
      const lista = mapas.get(c) ?? [];
      lista.push({
        codigo: hijo.codigo,
        nombre: hijo.nombre,
        dane: hijo.dane,
        partido: normalizar(ganador.nombre),
        partidoNombre: ganador.nombre,
        color: colorDe(ganador.nombre),
        votos: ganador.votos,
        pct: porcentaje(ganador.votos, validos),
        votantes,
        participacion: "",
        mesasPct: "100,00%",
        empate: false,
      });
      mapas.set(c, lista);
    }
  }

  const circunscripciones: Circunscripcion[] = [...porCirc.entries()]
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([c, a]) => {
      const { validos, votantes } = totales(a);
      const partidos: PartidoResultado[] = [...a.partidos.entries()]
        .sort(([, x], [, y]) => y.votos - x.votos)
        .map(([clave, p]) => ({
          codigo: clave,
          nombre: p.nombre,
          color: colorDe(p.nombre),
          ...(oficialDe(oficiales, p.nombre)?.logo ? { logo: oficialDe(oficiales, p.nombre)!.logo } : {}),
          votos: p.votos,
          pct: porcentaje(p.votos, validos),
          curules: 0,
          candidatos: [...p.candidatos]
            .sort((x, y) => y.votos - x.votos)
            .map((k): Candidato => {
              const soloLista = k.nombre === SOLO_LISTA;
              return {
                // El código del candidato es su nombre normalizado: estable entre territorios.
                codigo: soloLista ? "0" : normalizar(k.nombre).replace(/ /g, "_"),
                nombre: k.nombre,
                votos: k.votos,
                pct: porcentaje(k.votos, validos),
                electo: false,
                soloLista,
              };
            }),
        }));
      return {
        codigo: c,
        curules: 0,
        votantes,
        validos,
        blancos: a.blancos,
        pctBlancos: porcentaje(a.blancos, validos),
        partidos,
        mapa: mapas.get(c) ?? [],
      };
    });

  const principal = porCirc.get(circunscripciones[0].codigo)!;
  const mesas = ambito.mesa !== null ? 1 : contarMesas(geo, ambito.idx);
  return {
    corte: "",
    mesas: { total: mesas, informadas: mesas, pct: "100,00%" },
    // El dataset no trae el censo: sin él no hay participación ni abstención.
    censo: 0,
    votantes: totales(principal).votantes,
    participacion: "",
    nulos: principal.nulos,
    noMarcados: principal.noMarcados,
    curules: 0,
    circunscripciones,
  };
}
