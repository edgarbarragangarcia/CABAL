import "server-only";

import { unstable_cache } from "next/cache";

import { poblacionDe } from "@/lib/dane/poblacion";

import { zonaDe, type Zona } from "./zona";

/**
 * Economía, población y servicios sociales de un departamento o municipio, con datos abiertos oficiales consultados en vivo en
 * datos.gov.co (Socrata): PIB departamental (DANE), educación (Ministerio de Educación), afiliados a salud (Ministerio de Salud) y
 * evaluaciones agropecuarias (Ministerio de Agricultura). La población sale de las proyecciones del DANE ya guardadas en el proyecto.
 * Lo que solo existe por departamento (PIB) se marca como tal: no se inventa un PIB municipal.
 */

const BASE = "https://www.datos.gov.co/resource";
const TOKEN = process.env.SOCRATA_APP_TOKEN;

export type Barra = { etiqueta: string; valor: number };
export type Socio = {
  dane: string;
  nivel: "departamento" | "municipio";
  nombre: string;
  poblacion: {
    anio: number;
    total: number;
    cabecera: number;
    resto: number;
    edades: Barra[];
    evolucion: Barra[];
  } | null;
  educacion: {
    anio: number;
    alcance: "municipio" | "promedio de los municipios";
    cobertura: Barra[];
    desercion: Barra[];
    resumen: { neta: number; desercion: number; aprobacion: number; repitencia: number };
  } | null;
  salud: { anio: number; mes: number; total: number; regimenes: Barra[] } | null;
  economia: {
    anio: number;
    departamento: string;
    esDelDepartamento: boolean;
    total: number;
    sectores: Barra[];
    actividades: Barra[];
    serie: Barra[];
  } | null;
  agro: { anio: number; cultivos: { cultivo: string; produccion: number; area: number }[]; total: number } | null;
  /** Cifras exactas de la comuna o localidad (Censo 2018 del DANE), cuando el lugar elegido está dentro de una. */
  zona: Zona | null;
  zonaAviso: string | null;
  avisos: string[];
};

async function consultar<T = Record<string, string>>(recurso: string, soql: string): Promise<T[]> {
  const u = new URL(`${BASE}/${recurso}.json`);
  u.searchParams.set("$query", soql);
  const r = await fetch(u, { headers: TOKEN ? { "X-App-Token": TOKEN } : undefined, signal: AbortSignal.timeout(20_000), cache: "no-store" });
  if (!r.ok) throw new Error(`datos.gov.co respondió ${r.status}`);
  return (await r.json()) as T[];
}
const n = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
/** Evita comillas dentro del SoQL: los códigos DANE son solo dígitos. */
const codigo = (c: string) => c.replace(/\D/g, "").slice(0, 5);

const REGIMEN: Record<string, string> = { C: "Contributivo", S: "Subsidiado", E: "Régimen especial o de excepción", P: "Regímenes de excepción", N: "Sin régimen" };

const ANIOS_POBLACION = [2018, 2022, 2023, 2026];
const GRUPOS_EDAD = ["0 a 17", "18 a 29", "30 a 44", "45 a 59", "60 o más"];

function poblacion(dane: string): Socio["poblacion"] {
  const p = poblacionDe(dane, 2026);
  if (!p) return null;
  const serie = ANIOS_POBLACION.flatMap((a) => {
    const x = poblacionDe(dane, a);
    return x ? [{ etiqueta: String(a), valor: x.total }] : [];
  });
  return { anio: 2026, total: p.total, cabecera: p.cabecera, resto: p.resto, edades: GRUPOS_EDAD.map((g, i) => ({ etiqueta: g, valor: p.edades[i] })), evolucion: serie };
}

async function educacion(dane: string): Promise<Socio["educacion"]> {
  const [{ a_o }] = await consultar<{ a_o: string }>("nudc-7mev", "select max(a_o) as a_o");
  if (!a_o) return null;
  const columnas = ["cobertura_neta", "cobertura_neta_transici_n", "cobertura_neta_primaria", "cobertura_neta_secundaria", "cobertura_neta_media", "deserci_n", "deserci_n_transici_n", "deserci_n_primaria", "deserci_n_secundaria", "deserci_n_media", "aprobaci_n", "repitencia"];
  const filtro = dane.length === 5 ? `c_digo_municipio='${codigo(dane)}'` : `c_digo_departamento='${codigo(dane)}'`;
  const [f] = await consultar("nudc-7mev", `select ${columnas.map((c) => `avg(${c}::number) as ${c}`).join(", ")} where a_o='${codigo(a_o) || a_o}' and ${filtro}`);
  if (!f || f.cobertura_neta === undefined) return null;
  const niveles = [["Transición", "transici_n"], ["Primaria", "primaria"], ["Secundaria", "secundaria"], ["Media", "media"]] as const;
  return {
    anio: n(a_o),
    alcance: dane.length === 5 ? "municipio" : "promedio de los municipios",
    cobertura: niveles.map(([e, k]) => ({ etiqueta: e, valor: n(f[`cobertura_neta_${k}`]) })),
    desercion: niveles.map(([e, k]) => ({ etiqueta: e, valor: n(f[`deserci_n_${k}`]) })),
    resumen: { neta: n(f.cobertura_neta), desercion: n(f.deserci_n), aprobacion: n(f.aprobaci_n), repitencia: n(f.repitencia) },
  };
}

async function salud(dane: string): Promise<Socio["salud"]> {
  const [u] = await consultar<{ ano: string; mes: string }>("hn4i-593p", "select ano, mes order by ano desc, mes desc limit 1");
  if (!u) return null;
  const filtro = dane.length === 5 ? `codmunicipio='${codigo(dane)}'` : `coddepto='${codigo(dane)}'`;
  const filas = await consultar<{ idregimen: string; n: string }>("hn4i-593p", `select idregimen, sum(numpersonas::number) as n where ${filtro} and ano='${codigo(u.ano)}' and mes='${codigo(u.mes)}' group by idregimen`);
  if (filas.length === 0) return null;
  const regimenes = filas.map((f) => ({ etiqueta: REGIMEN[f.idregimen] ?? f.idregimen, valor: n(f.n) })).sort((a, b) => b.valor - a.valor);
  return { anio: n(u.ano), mes: n(u.mes), total: regimenes.reduce((s, r) => s + r.valor, 0), regimenes };
}

const NOMBRE_ACTIVIDAD: [RegExp, string][] = [
  [/^Comercio/i, "Comercio, transporte y alojamiento"],
  [/^Administraci/i, "Administración pública, educación y salud"],
  [/^Actividades profesionales/i, "Servicios profesionales y administrativos"],
  [/^Agricultura/i, "Agricultura, ganadería y pesca"],
  [/^Suministro/i, "Electricidad, gas y agua"],
  [/^Actividades art/i, "Arte, recreación y otros servicios"],
  [/^Actividades financieras/i, "Financieras y seguros"],
  [/^Actividades inmobiliarias/i, "Inmobiliarias"],
  [/^Explotaci/i, "Minas y canteras"],
  [/^Industrias/i, "Industria manufacturera"],
  [/^Informaci/i, "Información y comunicaciones"],
];
const corto = (a: string) => NOMBRE_ACTIVIDAD.find(([r]) => r.test(a))?.[1] ?? a;

async function economia(dane: string, nombreDepartamento: string): Promise<Socio["economia"]> {
  const dep = codigo(dane).slice(0, 2);
  const [{ a_o }] = await consultar<{ a_o: string }>("kgyi-qc7j", `select max(a_o) as a_o where c_digo_departamento_divipola='${dep}'`);
  if (!a_o) return null;
  const precios = "tipo_de_precios='PIB a precios corrientes'";
  const [filas, serie] = await Promise.all([
    consultar<{ actividad: string; sector: string; v: string }>("kgyi-qc7j", `select actividad, sector, valor_miles_de_millones_de as v where c_digo_departamento_divipola='${dep}' and a_o='${codigo(a_o)}' and ${precios} order by v desc limit 40`),
    consultar<{ a_o: string; v: string }>("kgyi-qc7j", `select a_o, sum(valor_miles_de_millones_de::number) as v where c_digo_departamento_divipola='${dep}' and ${precios} group by a_o order by a_o`),
  ]);
  if (filas.length === 0) return null;
  const porSector = new Map<string, number>();
  for (const f of filas) porSector.set(f.sector, (porSector.get(f.sector) ?? 0) + n(f.v));
  const total = filas.reduce((s, f) => s + n(f.v), 0);
  return {
    anio: n(a_o),
    departamento: nombreDepartamento,
    esDelDepartamento: dane.length === 5,
    total,
    sectores: [...porSector].map(([etiqueta, valor]) => ({ etiqueta, valor })).sort((a, b) => b.valor - a.valor),
    actividades: filas.map((f) => ({ etiqueta: corto(f.actividad), valor: n(f.v) })).filter((f) => f.etiqueta !== "Impuestos").sort((a, b) => b.valor - a.valor).slice(0, 8),
    serie: serie.map((s) => ({ etiqueta: s.a_o, valor: n(s.v) })).slice(-12),
  };
}

async function agro(dane: string): Promise<Socio["agro"]> {
  const [{ a_o }] = await consultar<{ a_o: string }>("uejq-wxrr", "select max(a_o) as a_o");
  if (!a_o) return null;
  const campo = dane.length === 5 ? "c_digo_dane_municipio" : "c_digo_dane_departamento";
  // El último año suele venir incompleto: se toma el más reciente que ya tenga cultivos del lugar.
  for (const anio of [n(a_o), n(a_o) - 1, n(a_o) - 2]) {
    const filas = await consultar<{ cultivo: string; p: string; a: string }>("uejq-wxrr", `select cultivo, sum(producci_n::number) as p, sum(rea_cosechada::number) as a where ${campo}='${codigo(dane)}' and a_o='${anio}' group by cultivo order by p desc limit 8`);
    if (filas.length > 0) return { anio, cultivos: filas.map((f) => ({ cultivo: f.cultivo, produccion: n(f.p), area: n(f.a) })), total: filas.reduce((s, f) => s + n(f.p), 0) };
  }
  return null;
}

async function seccion<T>(clave: string, dane: string, extra: string, f: () => Promise<T>): Promise<{ v: T | null; error?: string }> {
  try {
    // La función lanza si falla: unstable_cache no guarda lo que lanza, así una caída de datos.gov.co no queda en caché.
    const v = await unstable_cache(f, ["socio-v1", clave, dane, extra], { revalidate: 60 * 60 * 24 })();
    return { v };
  } catch (e) {
    return { v: null, error: `${clave}: ${e instanceof Error ? e.message : "no respondió"}` };
  }
}

export async function socioeconomicoDe(dane: string, nombre: string, nombreDepartamento: string, localidad?: { nombre: string; numero?: string }): Promise<Socio> {
  const d = codigo(dane);
  const [edu, sal, eco, agr] = await Promise.all([
    seccion("educación", d, "", () => educacion(d)),
    seccion("salud", d, "", () => salud(d)),
    seccion("economía", d, nombreDepartamento, () => economia(d, nombreDepartamento)),
    seccion("agro", d, "", () => agro(d)),
  ]);
  const zonaR = localidad && d.length === 5 ? await zonaDe(d, nombre, localidad.nombre, localidad.numero) : null;
  return {
    dane: d,
    nivel: d.length === 5 ? "municipio" : "departamento",
    nombre,
    poblacion: poblacion(d),
    educacion: edu.v,
    salud: sal.v,
    economia: eco.v,
    agro: agr.v,
    zona: zonaR?.zona ?? null,
    zonaAviso: zonaR && !zonaR.zona ? (zonaR.motivo ?? null) : null,
    avisos: [edu, sal, eco, agr].flatMap((s) => (s.error ? [`No se pudo consultar ${s.error}.`] : [])),
  };
}
