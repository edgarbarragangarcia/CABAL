import "server-only";

import { unstable_cache } from "next/cache";

import snapshot2022 from "@/data/cabal-senado-2022.json";
import { BOGOTA_ZONAS, ELECTORAL_DEPARTMENTS } from "@/lib/electoral-places";
import { GOV_DATASETS } from "./queries";
import { querySocrataDataset } from "./socrata";

/**
 * Resultados de María Fernanda Cabal al Senado, con el mismo recorrido para
 * los dos años: país → departamento → municipio (o localidad en Bogotá) →
 * puesto → mesa.
 *
 * - 2018: dataset mesa a mesa de la Registraduría en datos.gov.co (SODA).
 * - 2022: preconteo oficial de la Registraduría. Hasta el nivel de puesto
 *   sale de src/data/cabal-senado-2022.json (scripts/snapshot-senado-2022.mjs,
 *   cuadrado contra el total nacional); las mesas se consultan en vivo.
 */

export type ElectoralYear = 2018 | 2022;

export type ElectoralArea = {
  /** Con qué se pide el siguiente nivel (códigos de la Registraduría en 2022, nombres en 2018). */
  id: string;
  name: string;
  votos: number;
  mesas: number;
  /** Para ubicarlo en el mapa: código DANE del departamento o número de localidad en Bogotá. */
  geo?: string;
};

export type ElectoralPuesto = {
  id: string;
  /** Número de zona electoral, a dos dígitos (en Bogotá coincide con la localidad). */
  zona: string;
  name: string;
  votos: number;
  mesas: number;
};

export type ElectoralMesa = { mesa: number; votos: number };

export type CabalNivel =
  | {
      nivel: "pais";
      kpis: { label: string; value: string }[];
      fuente: string;
      nota?: string;
      /** Qué cuenta la columna de mesas en este año. */
      mesasLabel: string;
      areas: ElectoralArea[];
    }
  | { nivel: "departamento"; tipo: "municipios" | "localidades"; areas: ElectoralArea[] }
  | { nivel: "municipio" | "zona"; puestos: ElectoralPuesto[] }
  | { nivel: "puesto"; mesas: ElectoralMesa[] };

const fmt = (n: number) => n.toLocaleString("es-CO");

function departmentArea(name: string, id: string, votos: number, mesas: number): ElectoralArea {
  const dept = ELECTORAL_DEPARTMENTS[name];
  return {
    id,
    name: dept?.display ?? (name === "CONSULADOS" ? "Exterior (consulados)" : name),
    votos,
    mesas,
    geo: dept?.dane,
  };
}

function localidadArea(id: string, zona: string, votos: number, mesas: number): ElectoralArea {
  const n = Number(zona);
  return {
    id,
    name: BOGOTA_ZONAS[zona] ?? `Zona ${zona}`,
    votos,
    mesas,
    geo: n >= 1 && n <= 20 ? zona : undefined,
  };
}

// ---------------------------------------------------------------- 2018 ---

const CABAL_2018 = "MARIA FERNANDA CABAL MOLINA";
const BOGOTA_2018 = "BOGOTA D.C.";

/** Los ids de 2018 son los nombres de la Registraduría unidos con "|": depto|municipio|zona|puesto. */
const split2018 = (id: string) => id.split("|");
const esc = (s: string) => s.replace(/'/g, "''");
const pad2 = (zona: string) => zona.padStart(2, "0");

function query2018<T>(select: string, filters: Record<string, string>, group?: string) {
  const where = [
    `candidato='${CABAL_2018}'`,
    ...Object.entries(filters).map(([col, value]) => `${col}='${esc(value)}'`),
  ];
  return querySocrataDataset<T>(GOV_DATASETS.senado2018.id, {
    $select: select,
    $where: where.join(" AND "),
    $group: group,
    $limit: 50000,
  });
}

type Totales2018 = { v: string; m: string };

async function pais2018(): Promise<CabalNivel> {
  // El dataset solo trae filas de mesas donde la candidata tuvo votos, así
  // que count(*) = mesas con votos.
  const rows = await query2018<Totales2018 & { ndepto: string; nmpio: string }>(
    "ndepto, nmpio, sum(votos) as v, count(*) as m",
    {},
    "ndepto, nmpio"
  );
  const byDept = new Map<string, { votos: number; mesas: number }>();
  let votos = 0;
  let mesas = 0;
  for (const r of rows) {
    const t = byDept.get(r.ndepto) ?? { votos: 0, mesas: 0 };
    t.votos += Number(r.v);
    t.mesas += Number(r.m);
    byDept.set(r.ndepto, t);
    votos += Number(r.v);
    mesas += Number(r.m);
  }
  const municipios = rows.filter((r) => r.ndepto !== "CONSULADOS").length;

  return {
    nivel: "pais",
    kpis: [
      { label: "Votos", value: fmt(votos) },
      { label: "Mesas con votos", value: fmt(mesas) },
      { label: "Municipios con votos", value: fmt(municipios) },
    ],
    fuente: "Registraduría Nacional del Estado Civil — datos.gov.co (dataset 75f2-fe2s), mesa a mesa.",
    nota: "El dataset no incluye el departamento del Cesar.",
    mesasLabel: "mesas con votos",
    areas: [...byDept].map(([name, t]) => departmentArea(name, name, t.votos, t.mesas)),
  };
}

async function departamento2018(ndepto: string): Promise<CabalNivel> {
  if (ndepto === BOGOTA_2018) {
    const rows = await query2018<Totales2018 & { nmpio: string; zz: string }>(
      "nmpio, zz, sum(votos) as v, count(*) as m",
      { ndepto },
      "nmpio, zz"
    );
    return {
      nivel: "departamento",
      tipo: "localidades",
      areas: rows.map((r) =>
        localidadArea(`${ndepto}|${r.nmpio}|${r.zz}`, pad2(r.zz), Number(r.v), Number(r.m))
      ),
    };
  }
  const rows = await query2018<Totales2018 & { nmpio: string }>(
    "nmpio, sum(votos) as v, count(*) as m",
    { ndepto },
    "nmpio"
  );
  return {
    nivel: "departamento",
    tipo: "municipios",
    areas: rows.map((r) => ({
      id: `${ndepto}|${r.nmpio}`,
      name: r.nmpio,
      votos: Number(r.v),
      mesas: Number(r.m),
    })),
  };
}

async function puestos2018(id: string, nivel: "municipio" | "zona"): Promise<CabalNivel> {
  const [ndepto, nmpio, zz] = split2018(id);
  const rows = await query2018<Totales2018 & { zz: string; pp: string; npuesto: string }>(
    "zz, pp, npuesto, sum(votos) as v, count(*) as m",
    nivel === "zona" ? { ndepto, nmpio, zz } : { ndepto, nmpio },
    "zz, pp, npuesto"
  );
  return {
    nivel,
    puestos: rows.map((r) => ({
      id: `${ndepto}|${nmpio}|${r.zz}|${r.pp}`,
      zona: pad2(r.zz),
      name: r.npuesto,
      votos: Number(r.v),
      mesas: Number(r.m),
    })),
  };
}

async function puesto2018(id: string): Promise<CabalNivel> {
  const [ndepto, nmpio, zz, pp] = split2018(id);
  const rows = await query2018<{ mesa: string; votos: string }>("mesa, votos", {
    ndepto,
    nmpio,
    zz,
    pp,
  });
  return {
    nivel: "puesto",
    mesas: rows
      .map((r) => ({ mesa: Number(r.mesa), votos: Number(r.votos) }))
      .sort((a, b) => a.mesa - b.mesa),
  };
}

// ---------------------------------------------------------------- 2022 ---

/** [código, nombre, mesas, votos]; el código del puesto (13 dígitos) empieza
 * por el de su departamento (4), municipio (7) y zona (9). */
type Puesto2022 = [string, string, number, number];

const PUESTOS_2022 = snapshot2022.puestos as Puesto2022[];
const NOMBRES_2022: Record<string, string> = {
  ...snapshot2022.departamentos,
  ...snapshot2022.municipios,
};
const BOGOTA_2022 = "1600";
const BOGOTA_MUNICIPIO_2022 = "1600001";

/** Suma votos y mesas de los puestos bajo `prefix`, agrupados por los primeros `keyLength` dígitos. */
function sum2022(prefix: string, keyLength: number) {
  const out = new Map<string, { votos: number; mesas: number }>();
  for (const [code, , mesas, votos] of PUESTOS_2022) {
    if (!code.startsWith(prefix)) continue;
    const key = code.slice(0, keyLength);
    const t = out.get(key) ?? { votos: 0, mesas: 0 };
    t.votos += votos;
    t.mesas += mesas;
    out.set(key, t);
  }
  return out;
}

function pais2022(): CabalNivel {
  const { nacional } = snapshot2022;
  const municipios = [...sum2022("", 7)].filter(
    ([code, t]) => t.votos > 0 && !code.startsWith("88")
  ).length;
  return {
    nivel: "pais",
    kpis: [
      { label: "Votos", value: fmt(nacional.votos) },
      { label: "% del Senado", value: nacional.pvot },
      { label: "Mesas informadas", value: nacional.pmesasInformadas },
      { label: "Municipios con votos", value: fmt(municipios) },
    ],
    fuente:
      "Preconteo oficial de la Registraduría (resultadospreccongreso.registraduria.gov.co), corte del 14 de marzo de 2022, 3:40 a. m.",
    mesasLabel: "mesas",
    areas: [...sum2022("", 4)].map(([code, t]) =>
      departmentArea(NOMBRES_2022[code], code, t.votos, t.mesas)
    ),
  };
}

function departamento2022(code: string): CabalNivel {
  if (code === BOGOTA_2022) {
    return {
      nivel: "departamento",
      tipo: "localidades",
      areas: [...sum2022(BOGOTA_MUNICIPIO_2022, 9)].map(([zona, t]) =>
        localidadArea(zona, zona.slice(7, 9), t.votos, t.mesas)
      ),
    };
  }
  return {
    nivel: "departamento",
    tipo: "municipios",
    areas: [...sum2022(code, 7)].map(([mpio, t]) => ({
      id: mpio,
      name: NOMBRES_2022[mpio] ?? mpio,
      votos: t.votos,
      mesas: t.mesas,
    })),
  };
}

function puestos2022(prefix: string, nivel: "municipio" | "zona"): CabalNivel {
  return {
    nivel,
    puestos: PUESTOS_2022.filter(([code]) => code.startsWith(prefix)).map(
      ([code, name, mesas, votos]) => ({ id: code, zona: code.slice(7, 9), name, votos, mesas })
    ),
  };
}

/** Objeto de la candidata dentro de cantotabla, en el JSON del preconteo. */
const CABAL_2022_RE = /\{[^{}]*"nomcan":"MARIA FERNANDA","apecan":"CABAL MOLINA"[^{}]*\}/;

/**
 * Votos de la candidata en un ámbito del preconteo (aquí, una mesa). Lee el
 * archivo solo hasta encontrarla: los partidos vienen ordenados por votos y
 * cada archivo pesa ~150 KB.
 */
async function fetchCabalVotes2022(code: string): Promise<number> {
  const res = await fetch(`${snapshot2022.fuente}/json/ACT/SE/${code}.json`, { cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`Registraduría respondió ${res.status} para ${code}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      const match = text.match(CABAL_2022_RE);
      if (match) return Number(JSON.parse(match[0]).vot);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (!text.includes(`"amb":"${code}"`)) throw new Error(`Respuesta inesperada para ${code}`);
  return 0;
}

/** El firewall de la Registraduría corta conexiones si llegan muchas seguidas: reintentar con pausa. */
async function readCabalVotes2022(code: string): Promise<number> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchCabalVotes2022(code);
    } catch (err) {
      if (attempt >= 3) {
        throw new Error(
          "La Registraduría no respondió (puede estar limitando las consultas). Intenta de nuevo en unos minutos.",
          { cause: err }
        );
      }
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
}

/** El dominio del preconteo podría reutilizarse en otra elección: validar
 * una vez por instancia que siga sirviendo el mismo corte del snapshot. */
let preconteoCheck: Promise<void> | null = null;
function ensurePreconteo2022() {
  preconteoCheck ??= fetch(`${snapshot2022.fuente}/json/ACT/SE/00.json`, { cache: "no-store" })
    .then((res) => res.text())
    .then((text) => {
      if (!text.includes(`"mdhm":"${snapshot2022.corte}"`)) {
        throw new Error("La Registraduría ya no publica el preconteo de Senado 2022 en ese dominio.");
      }
    })
    .catch((err) => {
      preconteoCheck = null;
      throw err;
    });
  return preconteoCheck;
}

/** Evita consultas duplicadas mientras una misma petición está en curso. */
const mesas2022Cache = new Map<string, Promise<ElectoralMesa[]>>();

async function fetchMesas2022(code: string): Promise<ElectoralMesa[]> {
  const puesto = PUESTOS_2022.find(([c]) => c === code);
  if (!puesto) throw new Error(`Puesto ${code} no encontrado.`);
  await ensurePreconteo2022();

  // El archivo de cada mesa es el código del puesto + el número de mesa a 6 dígitos.
  const total = puesto[2];
  const mesas: ElectoralMesa[] = [];
  let next = 1;
  async function worker() {
    while (next <= total) {
      const mesa = next++;
      mesas.push({ mesa, votos: await readCabalVotes2022(code + String(mesa).padStart(6, "0")) });
    }
  }
  // Pocas a la vez: son muchas peticiones al mismo servidor por cada puesto.
  await Promise.all(Array.from({ length: Math.min(4, total) }, worker));
  return mesas.sort((a, b) => a.mesa - b.mesa);
}

/** Resultados cerrados: cada puesto se consulta a la Registraduría una sola vez
 * y queda en la caché de datos de Next (persiste entre peticiones y despliegues). */
const cachedMesas2022 = unstable_cache(fetchMesas2022, ["cabal-senado-2022-mesas"], {
  revalidate: false,
});

function mesas2022(code: string): Promise<ElectoralMesa[]> {
  let pending = mesas2022Cache.get(code);
  if (!pending) {
    pending = cachedMesas2022(code);
    mesas2022Cache.set(code, pending);
    pending.catch(() => mesas2022Cache.delete(code));
  }
  return pending;
}

// ----------------------------------------------------------------------

export async function getCabalNivel(
  year: ElectoralYear,
  nivel: string,
  id: string
): Promise<CabalNivel> {
  if (year === 2018) {
    if (nivel === "pais") return pais2018();
    if (nivel === "departamento") return departamento2018(id);
    if (nivel === "municipio" || nivel === "zona") return puestos2018(id, nivel);
    if (nivel === "puesto") return puesto2018(id);
  } else {
    if (nivel === "pais") return pais2022();
    if (nivel === "departamento") return departamento2022(id);
    if (nivel === "municipio" || nivel === "zona") return puestos2022(id, nivel);
    if (nivel === "puesto") return { nivel: "puesto", mesas: await mesas2022(id) };
  }
  throw new Error(`Nivel no válido: ${nivel}`);
}
