import lugares from "@/data/dane/lugares.json";

import type { NetNode } from "./network";

/**
 * Dónde ubicar a cada persona de la red en el mapa de Colombia: del lugar que trae el CRM (municipio, ciudad, barrio con ciudad,
 * departamento) al municipio DANE y sus coordenadas. Si solo hay departamento, queda en el centro del departamento.
 */
type Fila = [string, string, string, string, number, number, number]; // dane, municipio, cód. depto, depto, población, lat, lon
const FILAS = lugares as unknown as Fila[];

const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

export type Mun = { dane: string; nombre: string; dep: string; depNombre: string; pob: number; lat: number; lon: number };
// El centro de Bogotá: el punto del DANE cae al sur porque incluye el páramo de Sumapaz.
const CENTRO: Record<string, [number, number]> = { "11001": [4.65, -74.1] };
const MUNICIPIOS: Mun[] = FILAS.filter((f) => f[5] != null && f[6] != null).map(([dane, nombre, dep, depNombre, pob, lat, lon]) => ({ dane, nombre, dep, depNombre, pob, lat: CENTRO[dane]?.[0] ?? lat, lon: CENTRO[dane]?.[1] ?? lon }));
/** Palabras que no son un lugar (el país, «otro»…): «Colombia» existe como municipio del Huila, pero casi siempre se refiere al país. */
const NO_LUGAR = new Set(["colombia", "pais", "otro", "otra", "otros", "ninguno", "na", "n a", "no aplica", "sin dato", "desconocido"]);

const porNombre = new Map<string, Mun[]>();
const agregar = (clave: string, m: Mun) => {
  if (clave.length < 3) return;
  const l = porNombre.get(clave) ?? [];
  if (!l.includes(m)) l.push(m);
  porNombre.set(clave, l);
};
for (const m of MUNICIPIOS) {
  const base = plano(m.nombre);
  agregar(base, m);
  agregar(base.replace(/ d c$/, "").trim(), m); // «Bogotá, D.C.» → bogota
  agregar(base.replace(/ de indias$/, "").trim(), m); // «Cartagena de Indias» → cartagena
  // «San José de Cúcuta» → cucuta, «Guadalajara de Buga» → buga, «El Carmen de Viboral» → carmen de viboral…
  const sinPrefijo = base.replace(/^(san jose de|guadalajara de|villa de|santiago de|san juan de|santa fe de|puerto|el|la|los|las) /, "").trim();
  if (sinPrefijo !== base) agregar(sinPrefijo, m);
}

export type Dep = { codigo: string; nombre: string; lat: number; lon: number };
const DEPARTAMENTOS: Dep[] = [...new Set(MUNICIPIOS.map((m) => m.dep))].map((codigo) => {
  const ms = MUNICIPIOS.filter((m) => m.dep === codigo);
  const peso = ms.reduce((s, m) => s + m.pob, 0) || 1;
  return { codigo, nombre: ms[0].depNombre, lat: ms.reduce((s, m) => s + m.lat * m.pob, 0) / peso, lon: ms.reduce((s, m) => s + m.lon * m.pob, 0) / peso };
});
const depPorNombre = new Map(DEPARTAMENTOS.map((d) => [plano(d.nombre).replace(/ d c$/, ""), d]));

export type Ubicacion = { lon: number; lat: number; lugar: string; precision: "municipio" | "departamento" };

/** Los pedazos de un valor como «Laureles (Medellín)» o «Cali - Valle»: cada uno puede ser un lugar. */
const pedazos = (valor: string) => [valor, ...valor.split(/[()/,\-–·;]+/)].map(plano).filter((t) => t && !NO_LUGAR.has(t));

/** Ubica a una persona por sus campos de lugar. `null` si ningún dato sirve. */
export function ubicar(node: NetNode): Ubicacion | null {
  const textos = node.traits.filter((t) => t.dim === "lugar").flatMap((t) => pedazos(t.value));
  if (!textos.length) return null;
  // Departamento mencionado (ayuda a desempatar municipios que se llaman igual).
  let dep: Dep | undefined;
  for (const t of textos) {
    dep = depPorNombre.get(t);
    if (dep) break;
  }
  const candidatos: Mun[] = [];
  for (const t of textos) {
    const exacto = porNombre.get(t);
    if (exacto) candidatos.push(...exacto);
  }
  // Sin coincidencia exacta: un municipio de nombre largo contenido en el texto («barrio laureles medellin»).
  if (!candidatos.length) {
    for (const t of textos) {
      let mejor: Mun | null = null;
      for (const [clave, ms] of porNombre) {
        if (clave.length < 6 || !(` ${t} `.includes(` ${clave} `))) continue;
        const m = ms.find((x) => !dep || x.dep === dep.codigo) ?? ms[0];
        if (!mejor || plano(m.nombre).length > plano(mejor.nombre).length) mejor = m;
      }
      if (mejor) candidatos.push(mejor);
    }
  }
  if (candidatos.length) {
    const m = (dep ? candidatos.find((c) => c.dep === dep!.codigo) : null) ?? candidatos.sort((a, b) => b.pob - a.pob)[0];
    return { lon: m.lon, lat: m.lat, lugar: m.nombre === m.depNombre ? m.nombre : `${m.nombre}, ${m.depNombre}`, precision: "municipio" };
  }
  if (dep) return { lon: dep.lon, lat: dep.lat, lugar: dep.nombre, precision: "departamento" };
  return null;
}

/** Reparte a varias personas del mismo lugar en espiral alrededor del punto, para que ninguna tape a otra. */
export function dispersar(ubicaciones: (Ubicacion & { id: number })[]): Map<number, [number, number]> {
  const grupos = new Map<string, (Ubicacion & { id: number })[]>();
  for (const u of ubicaciones) {
    const k = `${u.lon.toFixed(3)},${u.lat.toFixed(3)}`;
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(u);
  }
  const out = new Map<number, [number, number]>();
  const ANGULO_ORO = 2.399963;
  for (const g of grupos.values()) {
    g.forEach((u, k) => {
      const radio = (u.precision === "departamento" ? 0.06 : 0.016) * Math.sqrt(k + (g.length > 1 ? 0.5 : 0));
      out.set(u.id, [u.lon + radio * Math.cos(k * ANGULO_ORO), u.lat + radio * Math.sin(k * ANGULO_ORO)]);
    });
  }
  return out;
}

/** Municipios que pueden corresponder a un nombre (varios si se repite, como «Barbosa» en Antioquia y en Santander). */
/** Nombres del CRM que no coinciden con el oficial («Mompox» es Santa Cruz de Mompox). «nombre|código de departamento» fija el departamento. */
const ALIAS: Record<string, string> = {
  "mompox": "mompos", "santa cruz de mompox": "mompos", "san juan de pasto": "pasto", "san luis de cubarral": "cubarral", "santiago de cali": "cali", "armero guayabal": "armero", "rioviejo": "rio viejo", "san juan de rio seco": "san juan de rioseco",
  "puerto nare la magdalena": "puerto nare", "pueblo viejo": "puebloviejo", "san andres de sotavento": "san andres sotavento", "vista hermosa": "vistahermosa",
  "rio blanco": "rioblanco", "san martin de los llanos": "san martin|50", "el retiro": "retiro|05", "san vicente ferrer": "san vicente|05",
};

export function candidatos(nombre: string): Mun[] {
  const original = plano(nombre);
  if (!original || NO_LUGAR.has(original)) return [];
  const [t, depFijo] = (ALIAS[original] ?? original).split("|");
  if (depFijo) return candidatosPlano(t).filter((m) => m.dep === depFijo);
  return candidatosPlano(t);
}

function candidatosPlano(t: string): Mun[] {
  const exacto = porNombre.get(t) ?? porNombre.get(`el ${t}`) ?? porNombre.get(`la ${t}`);
  if (exacto?.length) return exacto;
  // El nombre del CRM es el final o el principio del oficial («Cucuta» ↔ «san jose de cucuta»): solo si es único.
  const parecidos = new Set<Mun>();
  for (const [clave, ms] of porNombre) if (clave.length >= 5 && (clave.endsWith(` ${t}`) || clave.startsWith(`${t} `))) ms.forEach((m) => parecidos.add(m));
  return parecidos.size === 1 ? [...parecidos] : [];
}

/** Departamento por su nombre en el CRM («Atlantico», «Valle», «Bogota D.C.»). */
export function departamentoDe(nombre: string): Dep | undefined {
  const t = plano(nombre).replace(/ d c$/, "");
  if (!t) return undefined;
  const exacto = depPorNombre.get(t);
  if (exacto) return exacto;
  return DEPARTAMENTOS.find((d) => { const n = plano(d.nombre).replace(/ d c$/, ""); return n.startsWith(t) || t.startsWith(n) || n.includes(t); });
}

export const todosLosDepartamentos = () => DEPARTAMENTOS;
export const municipioPorDane = (dane: string) => MUNICIPIOS.find((m) => m.dane === dane);
