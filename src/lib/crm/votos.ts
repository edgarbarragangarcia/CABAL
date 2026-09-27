import { normalizar } from "@/lib/gov-data/elecciones/comparacion";
import type { CrmSnapshot } from "./types";

/**
 * Cruce de la base del CRM con los votos de un candidato, territorio por
 * territorio. Solo cuenta contactos por departamento o municipio: nunca cruza
 * personas con votos (habeas data, Ley 1581, y el voto es secreto).
 *
 * Los nombres del CRM no coinciden exactamente con los de la Registraduría
 * ("Bogotá D.C." / "BOGOTA. D.C.", "Valle del Cauca" / "VALLE"), así que se
 * emparejan sin tildes, sin "D.C.", y admitiendo que uno sea el comienzo del
 * otro por palabras completas ("Valle" / "Valle del Cauca"). Nunca por
 * contención suelta: "Santander" no es "Norte de Santander".
 */

export const normalizarLugar = (s: string) =>
  normalizar(s)
    .replace(/\b(D C|DC|DISTRITO CAPITAL)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function mismoLugar(a: string, b: string) {
  const [x, y] = [normalizarLugar(a), normalizarLugar(b)];
  if (!x || !y) return false;
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

export type Conteo = {
  /** Contactos por lugar (nombre tal como está en el CRM, agrupado por su forma normalizada). */
  lugares: { nombre: string; contactos: number }[];
  total: number;
  /** Contactos sin el dato de lugar que se pidió. */
  sinUbicar: number;
  /** El CRM tiene un campo para ese dato. */
  hayCampo: boolean;
};

const campo = (snapshot: CrmSnapshot, re: RegExp) =>
  snapshot.fields.findIndex((f) => (f.type === "string" || f.type === "enum") && re.test(f.label));

export const RE_MUNICIPIO = /ciudad|municipio/i;
export const RE_DEPARTAMENTO = /departamento|depto|provincia/i;

/**
 * Contactos por departamento (`nivel` "departamento") o por municipio
 * (`nivel` "municipio"); en este último caso, si se da un departamento, solo
 * los de ese departamento (para no mezclar municipios homónimos).
 */
export function contarContactos(
  snapshot: CrmSnapshot,
  nivel: "departamento" | "municipio",
  departamento?: string
): Conteo {
  const iLugar = campo(snapshot, nivel === "departamento" ? RE_DEPARTAMENTO : RE_MUNICIPIO);
  const iDepto = campo(snapshot, RE_DEPARTAMENTO);
  const conteo: Conteo = { lugares: [], total: snapshot.contacts.length, sinUbicar: 0, hayCampo: iLugar >= 0 };
  if (iLugar < 0) return { ...conteo, sinUbicar: conteo.total };

  const valor = (c: CrmSnapshot["contacts"][number], i: number) => {
    const par = c.v.find(([f]) => f === i);
    return par ? snapshot.fields[i].values[par[1][0]] : undefined;
  };
  const porClave = new Map<string, { nombre: string; contactos: number }>();
  const filtra = nivel === "municipio" && !!departamento && iDepto >= 0;
  let contados = 0;
  let enAmbito = 0;
  for (const c of snapshot.contacts) {
    if (filtra) {
      const d = valor(c, iDepto);
      if (!d || !mismoLugar(d, departamento!)) continue;
    }
    enAmbito += 1;
    const lugar = valor(c, iLugar);
    if (!lugar) continue;
    const k = normalizarLugar(lugar);
    const e = porClave.get(k) ?? { nombre: lugar, contactos: 0 };
    e.contactos += 1;
    porClave.set(k, e);
    contados += 1;
  }
  conteo.lugares = [...porClave.values()];
  // Con filtro de departamento, el total son los contactos de ese departamento.
  conteo.total = enAmbito;
  conteo.sinUbicar = enAmbito - contados;
  return conteo;
}

export type Territorio = { clave: string; nombre: string; votos: number };

export type Estado = "base-sin-votos" | "votos-sin-base" | "sin-base" | "equilibrado";

export const ESTADO_NOMBRE: Record<Estado, string> = {
  "base-sin-votos": "Base sin votos",
  "votos-sin-base": "Votos sin base",
  "sin-base": "Sin contactos",
  equilibrado: "Equilibrado",
};

export type FilaCruce = Territorio & {
  contactos: number;
  /** Parte de los votos y de los contactos (0–100) sobre lo emparejado. */
  cuotaVotos: number;
  cuotaContactos: number;
  /** Contactos por cada 1.000 votos. */
  contactosPorMilVotos: number;
  estado: Estado;
};

export type Cruce = {
  filas: FilaCruce[];
  votos: number;
  contactos: number;
  /** Contactos del CRM que no se pudieron ubicar en ningún territorio de la lista. */
  sinEmparejar: number;
};

/**
 * Una parte de los contactos bastante mayor que su parte de los votos es
 * "base sin votos" (hay gente a quien movilizar); al revés, "votos sin base"
 * (hay votos sin presencia propia). El corte es 1,5 veces en un sentido u otro.
 */
const CORTE = 1.5;

export function cruzar(territorios: Territorio[], conteo: Conteo): Cruce {
  const usados = new Set<number>();
  const conContactos = territorios.map((t) => {
    let contactos = 0;
    conteo.lugares.forEach((l, i) => {
      if (mismoLugar(l.nombre, t.nombre)) {
        contactos += l.contactos;
        usados.add(i);
      }
    });
    return { ...t, contactos };
  });
  const votos = conContactos.reduce((s, t) => s + t.votos, 0);
  const contactos = conContactos.reduce((s, t) => s + t.contactos, 0);

  const filas = conContactos
    .map((t): FilaCruce => {
      const cuotaVotos = votos ? (100 * t.votos) / votos : 0;
      const cuotaContactos = contactos ? (100 * t.contactos) / contactos : 0;
      const estado: Estado =
        t.contactos === 0
          ? t.votos > 0
            ? "sin-base"
            : "equilibrado"
          : t.votos === 0 || cuotaContactos >= CORTE * cuotaVotos
            ? "base-sin-votos"
            : cuotaContactos * CORTE <= cuotaVotos
              ? "votos-sin-base"
              : "equilibrado";
      return { ...t, cuotaVotos, cuotaContactos, contactosPorMilVotos: t.votos ? (1000 * t.contactos) / t.votos : 0, estado };
    })
    .filter((f) => f.votos > 0 || f.contactos > 0)
    .sort((a, b) => Math.abs(b.cuotaContactos - b.cuotaVotos) - Math.abs(a.cuotaContactos - a.cuotaVotos));

  const sinEmparejar = conteo.lugares.reduce((s, l, i) => s + (usados.has(i) ? 0 : l.contactos), 0);
  return { filas, votos, contactos, sinEmparejar };
}
