import "server-only";

import { unstable_cache } from "next/cache";

import type { Barra } from "./socioeconomico";

/**
 * Cifras exactas de una comuna o localidad: el Censo Nacional de Población y Vivienda 2018 del DANE, sumado por manzana censal
 * (capa `MGN2018/Serv_CapaManzanaInt_2018` del geoportal del DANE, campos `CD_LC_CM` y `NMB_LC_CM`: código y nombre de la comuna o
 * localidad). Solo se usan campos cuyo significado se verificó contra el propio censo (las edades suman el total, el universo de los
 * servicios coincide con las viviendas ocupadas, el estrato de energía crece donde se espera). En Medellín se agregan las empresas
 * registradas por comuna de la Cámara de Comercio de Medellín (datos.gov.co). Nada se estima ni se reparte: si una zona no está en
 * la fuente, no hay cifra.
 */

const DANE = "https://portalgis.dane.gov.co/mparcgis/rest/services/MGN2018/Serv_CapaManzanaInt_2018/MapServer/0/query";
const SOCRATA = "https://www.datos.gov.co/resource";

/** Diccionario de los campos usados (comprobado contra el censo; ver el comentario de arriba). */
const CAMPOS_PERSONAS = ["TP27_PERSO", "TP32_1_SEX", "TP32_2_SEX", "TP16_HOG", ...Array.from({ length: 9 }, (_, i) => `TP34_${i + 1}_EDA`)];
const CAMPOS_SERVICIOS = [
  "TP19_EE_1", "TP19_EE_2", "TP19_EE_E1", "TP19_EE_E2", "TP19_EE_E3", "TP19_EE_E4", "TP19_EE_E5", "TP19_EE_E6", "TP19_EE_E9",
  "TP19_ACU_1", "TP19_ACU_2", "TP19_ALC_1", "TP19_ALC_2", "TP19_GAS_1", "TP19_GAS_2", "TP19_GAS_9", "TP19_RECB1", "TP19_RECB2",
  "TP19_INTE1", "TP19_INTE2", "TP19_INTE9",
];
const CAMPOS_VIVIENDA = ["TP15_1_OCU", "TP15_2_OCU", "TP15_3_OCU", "TP15_4_OCU", "TP14_1_TIP", "TP14_2_TIP", "TP14_3_TIP", "TP14_4_TIP", "TP14_5_TIP", "TP14_6_TIP", "TP51PRIMAR", "TP51SECUND", "TP51SUPERI", "TP51POSTGR"];

type Fila = Record<string, number | string | null>;

export type Servicio = { clave: string; etiqueta: string; si: number; no: number; sin: number; pct: number; pctMunicipio: number };
export type Zona = {
  codigo: string;
  nombre: string;
  tipo: string;
  municipio: string;
  personas: number;
  hombres: number;
  mujeres: number;
  hogares: number;
  personasPorHogar: number;
  edades: Barra[];
  /** Porcentaje de 60 años o más, y el del conjunto de comunas del municipio. */
  mayores60: { pct: number; pctMunicipio: number };
  menores20: { pct: number; pctMunicipio: number };
  viviendas: { ocupadas: number; desocupadas: number; temporales: number; tipos: Barra[]; totalUnidades: number };
  estrato: Barra[];
  servicios: Servicio[];
  educacion: Barra[];
  /** Cuántas comunas o localidades hay en la fuente para este municipio, y qué parte de su población suman. */
  contexto: { zonas: number; personasMunicipio: number; pctDelMunicipio: number };
  empresas: { anio: number; total: number; actividades: Barra[]; fuente: string } | null;
  fuente: string;
};

async function consultaDane(mpio: string, campos: string[]): Promise<Record<string, Fila>> {
  const u = new URL(DANE);
  u.searchParams.set("f", "json");
  u.searchParams.set("where", `MPIO_CDPMP='${mpio.replace(/\D/g, "").slice(0, 5)}'`);
  u.searchParams.set("groupByFieldsForStatistics", "CD_LC_CM,NMB_LC_CM,TP_LC_CM");
  u.searchParams.set("outStatistics", JSON.stringify(campos.map((c) => ({ statisticType: "sum", onStatisticField: c, outStatisticFieldName: c }))));
  const r = await fetch(u, { signal: AbortSignal.timeout(45_000), cache: "no-store" });
  const texto = await r.text();
  let j: { features?: { attributes: Fila }[]; error?: { message?: string } };
  try {
    j = JSON.parse(texto);
  } catch {
    throw new Error(`El geoportal del DANE no respondió (${r.status}).`);
  }
  if (j.error || !j.features) throw new Error(j.error?.message ?? "El geoportal del DANE devolvió un error.");
  const out: Record<string, Fila> = {};
  for (const f of j.features) {
    const cod = String(f.attributes.CD_LC_CM ?? "").trim();
    if (cod) out[cod] = f.attributes;
  }
  return out;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();

async function censoDelMunicipio(mpio: string) {
  const [p, s, v] = await Promise.all([consultaDane(mpio, CAMPOS_PERSONAS), consultaDane(mpio, CAMPOS_SERVICIOS), consultaDane(mpio, CAMPOS_VIVIENDA)]);
  const todas: Record<string, Fila> = {};
  for (const cod of Object.keys(p)) todas[cod] = { ...p[cod], ...(s[cod] ?? {}), ...(v[cod] ?? {}) };
  return todas;
}

const censoCache = (mpio: string) => unstable_cache(() => censoDelMunicipio(mpio), ["zona-censo-v1", mpio], { revalidate: 60 * 60 * 24 * 30 })();

/** Qué comuna o localidad del DANE corresponde al nombre que trae el árbol de territorio. */
export function emparejarZona(nombre: string, filas: Record<string, Fila>, numeroZona?: string): string | null {
  const etiqueta = norm(nombre);
  const nombres = Object.entries(filas).map(([cod, f]) => ({ cod, nombre: norm(String(f.NMB_LC_CM ?? "")) })).filter((x) => x.nombre);
  // 1) El nombre del DANE aparece completo en la etiqueta (la más larga gana: «la candelaria» antes que «candelaria»).
  const porNombre = nombres.filter((x) => ` ${etiqueta} `.includes(` ${x.nombre} `)).sort((a, b) => b.nombre.length - a.nombre.length);
  if (porNombre.length > 0) return porNombre[0].cod;
  // 2) Número de comuna o localidad en la etiqueta («comuna 14»), solo si ese código existe y el nombre no lo contradice.
  const m = etiqueta.match(/(?:comuna|localidad)\s*0*(\d+)/);
  const num = (numeroZona ?? m?.[1])?.padStart(2, "0");
  if (num && filas[num]) {
    const del = norm(String(filas[num].NMB_LC_CM ?? ""));
    const palabras = etiqueta.split(" ").filter((w) => w.length > 3 && !/^(comuna|localidad|corregimiento)$/.test(w));
    if (!del || palabras.length === 0 || palabras.some((w) => del.includes(w))) return num;
  }
  return null;
}

function pct(parte: number, total: number) {
  return total > 0 ? (parte / total) * 100 : 0;
}

function armarZona(cod: string, filas: Record<string, Fila>, municipio: string): Zona {
  const f = filas[cod];
  const todas = Object.values(filas);
  const suma = (campo: string) => todas.reduce((s, x) => s + n(x[campo]), 0);
  const personas = n(f.TP27_PERSO);
  const personasMunicipio = suma("TP27_PERSO");
  const edadesCampos = Array.from({ length: 9 }, (_, i) => `TP34_${i + 1}_EDA`);
  const ETIQ_EDAD = ["0 a 9", "10 a 19", "20 a 29", "30 a 39", "40 a 49", "50 a 59", "60 a 69", "70 a 79", "80 o más"];
  const edades = edadesCampos.map((c, i) => ({ etiqueta: ETIQ_EDAD[i], valor: n(f[c]) }));
  const mayores = (x: Fila) => n(x.TP34_7_EDA) + n(x.TP34_8_EDA) + n(x.TP34_9_EDA);
  const menores = (x: Fila) => n(x.TP34_1_EDA) + n(x.TP34_2_EDA);
  const ocupadas = n(f.TP15_1_OCU);
  const serv = (clave: string, etiqueta: string, si: string, no: string, sin?: string): Servicio => {
    const s = n(f[si]);
    const nn = n(f[no]);
    const ss = sin ? n(f[sin]) : 0;
    const siMun = suma(si);
    const totMun = siMun + suma(no) + (sin ? suma(sin) : 0);
    return { clave, etiqueta, si: s, no: nn, sin: ss, pct: pct(s, s + nn + ss), pctMunicipio: pct(siMun, totMun) };
  };
  const niveles = [["Primaria", "TP51PRIMAR"], ["Secundaria", "TP51SECUND"], ["Superior", "TP51SUPERI"], ["Posgrado", "TP51POSTGR"]] as const;
  return {
    codigo: cod,
    nombre: String(f.NMB_LC_CM ?? ""),
    tipo: String(f.TP_LC_CM ?? ""),
    municipio,
    personas,
    hombres: n(f.TP32_1_SEX),
    mujeres: n(f.TP32_2_SEX),
    hogares: n(f.TP16_HOG),
    personasPorHogar: n(f.TP16_HOG) > 0 ? personas / n(f.TP16_HOG) : 0,
    edades,
    mayores60: { pct: pct(mayores(f), personas), pctMunicipio: pct(todas.reduce((s, x) => s + mayores(x), 0), personasMunicipio) },
    menores20: { pct: pct(menores(f), personas), pctMunicipio: pct(todas.reduce((s, x) => s + menores(x), 0), personasMunicipio) },
    viviendas: {
      ocupadas,
      desocupadas: n(f.TP15_4_OCU),
      temporales: n(f.TP15_3_OCU),
      totalUnidades: n(f.TP15_1_OCU) + n(f.TP15_2_OCU) + n(f.TP15_3_OCU) + n(f.TP15_4_OCU),
      tipos: [
        { etiqueta: "Casa", valor: n(f.TP14_1_TIP) },
        { etiqueta: "Apartamento", valor: n(f.TP14_2_TIP) },
        { etiqueta: "Cuarto", valor: n(f.TP14_3_TIP) },
        { etiqueta: "Otro tipo", valor: n(f.TP14_4_TIP) + n(f.TP14_5_TIP) + n(f.TP14_6_TIP) },
      ],
    },
    estrato: [1, 2, 3, 4, 5, 6].map((e) => ({ etiqueta: `Estrato ${e}`, valor: n(f[`TP19_EE_E${e}`]) })),
    servicios: [
      serv("energia", "Energía eléctrica", "TP19_EE_1", "TP19_EE_2"),
      serv("acueducto", "Acueducto", "TP19_ACU_1", "TP19_ACU_2"),
      serv("alcantarillado", "Alcantarillado", "TP19_ALC_1", "TP19_ALC_2"),
      serv("recoleccion", "Recolección de basuras", "TP19_RECB1", "TP19_RECB2"),
      serv("gas", "Gas natural", "TP19_GAS_1", "TP19_GAS_2", "TP19_GAS_9"),
      serv("internet", "Internet", "TP19_INTE1", "TP19_INTE2", "TP19_INTE9"),
    ],
    educacion: niveles.map(([etiqueta, c]) => ({ etiqueta, valor: n(f[c]) })),
    contexto: { zonas: Object.keys(filas).length, personasMunicipio, pctDelMunicipio: pct(personas, personasMunicipio) },
    empresas: null,
    fuente: "DANE, Censo Nacional de Población y Vivienda 2018 (resultados por manzana, geoportal del DANE)",
  };
}

/** Medellín: empresas registradas por comuna (Cámara de Comercio de Medellín para Antioquia), por divisiones CIIU. */
const COLUMNA_CAMARA: Record<string, string> = {
  popular: "popular", "santa cruz": "santa_cruz", manrique: "manrique", aranjuez: "aranjuez", castilla: "castilla", "doce de octubre": "doce_de_octubre",
  robledo: "robledo", "villa hermosa": "villa_hermosa", "buenos aires": "buenos_aires", "la candelaria": "la_candelaria", "laureles estadio": "laureles_estadio",
  "la america": "la_america", "san javier": "san_javier", "el poblado": "el_poblado", guayabal: "guayabal", belen: "belen",
};

async function empresasMedellin(nombreZona: string): Promise<NonNullable<Zona["empresas"]> | null> {
  const col = COLUMNA_CAMARA[norm(nombreZona)];
  if (!col) return null;
  const get = async (q: string) => {
    const u = new URL(`${SOCRATA}/2zc9-bpzw.json`);
    u.searchParams.set("$query", q);
    const r = await fetch(u, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!r.ok) throw new Error(`datos.gov.co respondió ${r.status}`);
    return (await r.json()) as Record<string, string>[];
  };
  const [{ a_o }] = await get("select max(a_o) as a_o");
  const [tot] = await get(`select sum(${col}::number) as total where a_o='${a_o.replace(/\D/g, "")}'`);
  const filas = await get(`select descripci_n, ${col} as n where a_o='${a_o.replace(/\D/g, "")}' and division!='0' order by ${col}::number desc limit 5`);
  return {
    anio: Number(a_o),
    total: Number(tot.total),
    actividades: filas.map((x) => ({ etiqueta: x.descripci_n, valor: Number(x.n) })),
    fuente: "Cámara de Comercio de Medellín para Antioquia, estructura empresarial por comunas (datos.gov.co)",
  };
}

export type ZonaRespuesta = { zona: Zona | null; motivo?: string };

/** Cifras de la comuna o localidad que corresponde a `nombre` dentro del municipio `dane` (5 dígitos). */
export async function zonaDe(dane: string, municipio: string, nombre: string, numeroZona?: string): Promise<ZonaRespuesta> {
  let filas: Record<string, Fila>;
  try {
    filas = await censoCache(dane);
  } catch (e) {
    return { zona: null, motivo: e instanceof Error ? e.message : "No se pudo consultar el censo del DANE." };
  }
  if (Object.keys(filas).length === 0) return { zona: null, motivo: "El DANE no publica comunas o localidades para este municipio en el Censo 2018." };
  const cod = emparejarZona(nombre, filas, numeroZona);
  if (!cod) return { zona: null, motivo: `No encontré «${nombre}» entre las comunas o localidades del Censo 2018 del DANE (${Object.keys(filas).length} en este municipio).` };
  const zona = armarZona(cod, filas, municipio);
  if (dane === "05001") {
    try {
      zona.empresas = await unstable_cache(() => empresasMedellin(zona.nombre), ["zona-empresas-v1", zona.nombre], { revalidate: 60 * 60 * 24 * 7 })();
    } catch {
      zona.empresas = null;
    }
  }
  return { zona };
}
