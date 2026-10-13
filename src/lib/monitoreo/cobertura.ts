import { MEDIOS_REGIONALES } from "./medios-regionales";
import type { MencionWeb } from "./menciones-web";

/**
 * De qué ciudades vienen las menciones y de qué lugares hablan, a partir de las menciones ya ubicadas (ver menciones-web.ts).
 * Código puro, sin servidor: el panel lo recalcula al cambiar un filtro.
 */
export type PuntoCobertura = { dane: string; nombre: string; departamento: string; lat: number; lon: number; total: number; medios: { nombre: string; total: number }[]; facebook: number };
export type Cobertura = {
  /** Ciudades desde las que publican los portales (y páginas de Facebook) regionales que nombran a María Fernanda. */
  publicadas: PuntoCobertura[];
  /** Lugares que nombran los titulares (donde pasa lo que cuentan). */
  mencionadas: PuntoCobertura[];
  departamentos: { dep: string; nombre: string; publicadas: number; mencionadas: number }[];
  sinUbicar: number;
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

export function calcularCobertura(menciones: MencionWeb[], consultados: { portales: string[]; paginas: string[] }): Cobertura {
  const publicadas = new Map<string, PuntoCobertura>();
  const mencionadas = new Map<string, PuntoCobertura>();
  const departamentos = new Map<string, { dep: string; nombre: string; publicadas: number; mencionadas: number }>();
  const conMenciones = new Set<string>();
  let sinUbicar = 0;
  const depDe = (dane: string, nombre: string) => {
    const dep = dane.slice(0, 2);
    return departamentos.get(dep) ?? departamentos.set(dep, { dep, nombre, publicadas: 0, mencionadas: 0 }).get(dep)!;
  };
  for (const m of menciones) {
    const g = m.geo;
    if (!g?.medio && !g?.texto) sinUbicar++;
    if (g?.medio) {
      const o = g.medio;
      conMenciones.add(o.id);
      const p = publicadas.get(o.dane) ?? publicadas.set(o.dane, { dane: o.dane, nombre: o.ciudad, departamento: o.departamento, lat: o.lat, lon: o.lon, total: 0, medios: [], facebook: 0 }).get(o.dane)!;
      p.total++;
      if (m.plataforma === "facebook") p.facebook++;
      const medio = p.medios.find((x) => x.nombre === o.nombre);
      if (medio) medio.total++;
      else p.medios.push({ nombre: o.nombre, total: 1 });
      depDe(o.dane, o.departamento).publicadas++;
    }
    if (g?.texto) {
      const t = g.texto;
      const p = mencionadas.get(t.dane) ?? mencionadas.set(t.dane, { dane: t.dane, nombre: t.nombre, departamento: t.departamento, lat: t.lat, lon: t.lon, total: 0, medios: [], facebook: 0 }).get(t.dane)!;
      p.total++;
      if (m.plataforma === "facebook") p.facebook++;
      depDe(t.dane, t.departamento).mencionadas++;
    }
  }
  const ordenar = (a: PuntoCobertura, b: PuntoCobertura) => b.total - a.total || a.nombre.localeCompare(b.nombre);
  for (const p of publicadas.values()) p.medios.sort((a, b) => b.total - a.total);
  const web = new Set(consultados.portales);
  const fb = new Set(consultados.paginas);
  return {
    publicadas: [...publicadas.values()].sort(ordenar),
    mencionadas: [...mencionadas.values()].sort(ordenar),
    departamentos: [...departamentos.values()].sort((a, b) => b.publicadas + b.mencionadas - (a.publicadas + a.mencionadas)),
    sinUbicar,
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
