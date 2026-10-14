import { MEDIOS_REGIONALES } from "./medios-regionales";
import type { MencionWeb } from "./menciones-web";
import type { Tono } from "./tono";

/**
 * De qué ciudades vienen las menciones y de qué lugares hablan, a partir de las menciones ya ubicadas (ver menciones-web.ts).
 * Código puro, sin servidor: el panel lo recalcula al cambiar un filtro.
 */
export type PuntoCobertura = {
  dane: string;
  nombre: string;
  departamento: string;
  lat: number;
  lon: number;
  total: number;
  medios: { nombre: string; total: number }[];
  facebook: number;
  tonos: Record<Tono, number>;
  /** De -1 (todo negativo) a 1 (todo positivo). */
  indice: number;
  /** Cifras públicas que entregan las fuentes (YouTube y X). */
  likes: number;
  comentarios: number;
  vistas: number;
  /** Fecha de la mención más reciente. */
  ultima: string;
  /** Cuántas menciones hay de cada plataforma (prensa, facebook, youtube…). */
  porPlataforma: Record<string, number>;
};
export type ResumenTono = { total: number; tonos: Record<Tono, number>; indice: number };
export type Cobertura = {
  /** Ciudades desde las que publican los portales (y páginas de Facebook) regionales que nombran a María Fernanda. */
  publicadas: PuntoCobertura[];
  /** Todo en un solo mapa: cada mención va a la ciudad del portal que la publica o, si no tiene, al lugar que nombra su titular. */
  lugares: PuntoCobertura[];
  /** Menciones que no se pueden ubicar (ni portal con sede ni lugar en el titular). */
  sinLugar: MencionWeb[];
  /** Total por departamento (código de 2 dígitos) de las menciones ubicadas. */
  porDepartamento: Record<string, number>;
  /** Lugares que nombran los titulares (donde pasa lo que cuentan). */
  mencionadas: PuntoCobertura[];
  departamentos: { dep: string; nombre: string; publicadas: number; mencionadas: number }[];
  sinUbicar: number;
  /** Prensa nacional e internacional: no se ubica en una ciudad. */
  nacionales: ResumenTono;
  /** Todo lo contado, con su tono. */
  tono: ResumenTono;
  directorio: {
    portales: number;
    departamentos: number;
    conFacebook: number;
    facebookLegible: number;
    portalesConsultados: number;
    paginasConsultadas: number;
    portalesConMenciones: number;
  };
  /** Portales consultados que no la nombran (con el filtro elegido). */
  sinMenciones: { id: string; nombre: string; ciudad: string; departamento: string; dominio: string; fb: string | null }[];
};

export function calcularCobertura(menciones: MencionWeb[], consultados: { portales: string[]; paginas: string[] }, tonoDe: (m: MencionWeb) => Tono = (m) => m.tono ?? "neutral"): Cobertura {
  const publicadas = new Map<string, PuntoCobertura>();
  const mencionadas = new Map<string, PuntoCobertura>();
  const lugares = new Map<string, PuntoCobertura>();
  const sinLugar: MencionWeb[] = [];
  const porDepartamento: Record<string, number> = {};
  const departamentos = new Map<string, { dep: string; nombre: string; publicadas: number; mencionadas: number }>();
  const conMenciones = new Set<string>();
  let sinUbicar = 0;
  const vacio = (): ResumenTono => ({ total: 0, tonos: { positivo: 0, neutral: 0, negativo: 0 }, indice: 0 });
  const nacionales = vacio();
  const tono = vacio();
  const nuevo = (dane: string, nombre: string, departamento: string, lat: number, lon: number): PuntoCobertura => ({ dane, nombre, departamento, lat, lon, total: 0, medios: [], facebook: 0, tonos: { positivo: 0, neutral: 0, negativo: 0 }, indice: 0, likes: 0, comentarios: 0, vistas: 0, ultima: "", porPlataforma: {} });
  const sumar = (p: PuntoCobertura, m: MencionWeb, t: Tono) => {
    p.total++;
    p.tonos[t]++;
    p.likes += m.metricas?.likes ?? 0;
    p.comentarios += m.metricas?.comentarios ?? 0;
    p.vistas += m.metricas?.vistas ?? 0;
    if (m.fecha > p.ultima) p.ultima = m.fecha;
    if (m.plataforma === "facebook") p.facebook++;
    p.porPlataforma[m.plataforma] = (p.porPlataforma[m.plataforma] ?? 0) + 1;
  };
  const depDe = (dane: string, nombre: string) => {
    const dep = dane.slice(0, 2);
    return departamentos.get(dep) ?? departamentos.set(dep, { dep, nombre, publicadas: 0, mencionadas: 0 }).get(dep)!;
  };
  for (const m of menciones) {
    const g = m.geo;
    const t = tonoDe(m);
    tono.total++;
    tono.tonos[t]++;
    if (m.nacional && !g?.medio) {
      nacionales.total++;
      nacionales.tonos[t]++;
    }
    if (!g?.medio && !g?.texto && !m.nacional) sinUbicar++;
    const ef = g?.medio ? { dane: g.medio.dane, nombre: g.medio.ciudad, departamento: g.medio.departamento, lat: g.medio.lat, lon: g.medio.lon } : g?.texto ? { dane: g.texto.dane, nombre: g.texto.nombre, departamento: g.texto.departamento, lat: g.texto.lat, lon: g.texto.lon } : null;
    if (ef) {
      const p = lugares.get(ef.dane) ?? lugares.set(ef.dane, nuevo(ef.dane, ef.nombre, ef.departamento, ef.lat, ef.lon)).get(ef.dane)!;
      sumar(p, m, t);
      const fuente = g?.medio?.nombre ?? m.fuente;
      const medio = p.medios.find((x) => x.nombre === fuente);
      if (medio) medio.total++;
      else p.medios.push({ nombre: fuente, total: 1 });
      porDepartamento[ef.dane.slice(0, 2)] = (porDepartamento[ef.dane.slice(0, 2)] ?? 0) + 1;
    } else sinLugar.push(m);
    if (g?.medio) {
      const o = g.medio;
      conMenciones.add(o.id);
      const p = publicadas.get(o.dane) ?? publicadas.set(o.dane, nuevo(o.dane, o.ciudad, o.departamento, o.lat, o.lon)).get(o.dane)!;
      sumar(p, m, t);
      const medio = p.medios.find((x) => x.nombre === o.nombre);
      if (medio) medio.total++;
      else p.medios.push({ nombre: o.nombre, total: 1 });
      depDe(o.dane, o.departamento).publicadas++;
    }
    if (g?.texto) {
      const x = g.texto;
      const p = mencionadas.get(x.dane) ?? mencionadas.set(x.dane, nuevo(x.dane, x.nombre, x.departamento, x.lat, x.lon)).get(x.dane)!;
      sumar(p, m, t);
      depDe(x.dane, x.departamento).mencionadas++;
    }
  }
  const ordenar = (a: PuntoCobertura, b: PuntoCobertura) => b.total - a.total || a.nombre.localeCompare(b.nombre);
  for (const p of publicadas.values()) p.medios.sort((a, b) => b.total - a.total);
  const indice = (r: { total: number; tonos: Record<Tono, number> }) => (r.total ? (r.tonos.positivo - r.tonos.negativo) / r.total : 0);
  for (const p of lugares.values()) p.medios.sort((a, b) => b.total - a.total);
  for (const p of [...publicadas.values(), ...mencionadas.values(), ...lugares.values()]) p.indice = indice(p);
  nacionales.indice = indice(nacionales);
  tono.indice = indice(tono);
  const web = new Set(consultados.portales);
  const fb = new Set(consultados.paginas);
  return {
    publicadas: [...publicadas.values()].sort(ordenar),
    mencionadas: [...mencionadas.values()].sort(ordenar),
    lugares: [...lugares.values()].sort(ordenar),
    sinLugar,
    porDepartamento,
    departamentos: [...departamentos.values()].sort((a, b) => b.publicadas + b.mencionadas - (a.publicadas + a.mencionadas)),
    sinUbicar,
    nacionales,
    tono,
    directorio: {
      portales: MEDIOS_REGIONALES.length,
      departamentos: new Set(MEDIOS_REGIONALES.map((m) => m.dane.slice(0, 2))).size,
      conFacebook: MEDIOS_REGIONALES.filter((m) => m.fb).length,
      facebookLegible: MEDIOS_REGIONALES.filter((m) => m.fb && m.fbIndexado).length,
      portalesConsultados: MEDIOS_REGIONALES.filter((m) => m.web && web.has(m.id)).length,
      paginasConsultadas: MEDIOS_REGIONALES.filter((m) => m.fb && m.fbIndexado && fb.has(m.id)).length,
      portalesConMenciones: conMenciones.size,
    },
    sinMenciones: MEDIOS_REGIONALES.filter((m) => (web.has(m.id) || fb.has(m.id)) && !conMenciones.has(m.id)).map((m) => ({ id: m.id, nombre: m.nombre, ciudad: m.ciudad, departamento: m.departamento, dominio: m.dominio, fb: m.fb })),
  };
}

/** Los 33 departamentos (código DANE de 2 dígitos y nombre), para decir cuáles no tienen ningún portal en el directorio. */
export const DEPARTAMENTOS_CO: [string, string][] = [
  ["05", "Antioquia"], ["08", "Atlántico"], ["11", "Bogotá, D.C."], ["13", "Bolívar"], ["15", "Boyacá"], ["17", "Caldas"], ["18", "Caquetá"], ["19", "Cauca"], ["20", "Cesar"],
  ["23", "Córdoba"], ["25", "Cundinamarca"], ["27", "Chocó"], ["41", "Huila"], ["44", "La Guajira"], ["47", "Magdalena"], ["50", "Meta"], ["52", "Nariño"], ["54", "Norte de Santander"],
  ["63", "Quindío"], ["66", "Risaralda"], ["68", "Santander"], ["70", "Sucre"], ["73", "Tolima"], ["76", "Valle del Cauca"], ["81", "Arauca"], ["85", "Casanare"], ["86", "Putumayo"],
  ["88", "San Andrés y Providencia"], ["91", "Amazonas"], ["94", "Guainía"], ["95", "Guaviare"], ["97", "Vaupés"], ["99", "Vichada"],
];
