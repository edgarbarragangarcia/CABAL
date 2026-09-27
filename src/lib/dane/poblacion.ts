import "server-only";

import snapshot from "@/data/dane/municipios.json";
import { sumar, type Poblacion } from "./contexto";

/**
 * Población por municipio y año de elección (DANE, proyecciones del Censo 2018),
 * generada por scripts/snapshot-dane.py. Se busca por código DANE: de 5 dígitos
 * es un municipio; de 2 dígitos, un departamento (suma de sus municipios).
 */

type Registro = { nombre: string; dep: string; departamento: string; pob: Record<string, number[]>; edad: Record<string, number[]> };
const datos = snapshot as unknown as { fuente: string; actualizado: string; anios: number[]; municipios: Record<string, Registro> };

export const FUENTE_DANE = `${datos.fuente} (${datos.actualizado.replace(/^Actualizado el /, "actualizado el ")})`;

/** Del año pedido al más cercano que hay en el archivo. */
export function anioDisponible(anio: number) {
  return datos.anios.reduce((mejor, a) => (Math.abs(a - anio) < Math.abs(mejor - anio) ? a : mejor), datos.anios[0]);
}

function de(r: Registro, anio: number): Poblacion | null {
  const p = r.pob[String(anio)];
  const e = r.edad[String(anio)];
  return p && e ? { total: p[0], cabecera: p[1], resto: p[2], edades: e as Poblacion["edades"] } : null;
}

/** Población de un municipio (código de 5 dígitos) o de un departamento (2 dígitos); sin código, no hay dato. */
export function poblacionDe(dane: string | undefined, anio: number): Poblacion | null {
  if (!dane) return null;
  const a = anioDisponible(anio);
  const registros = Object.values(datos.municipios);
  const lista = dane.length === 5 ? (datos.municipios[dane] ? [datos.municipios[dane]] : []) : registros.filter((r) => r.dep === dane);
  const pobs = lista.map((r) => de(r, a)).filter((p): p is Poblacion => p !== null);
  return pobs.length ? sumar(pobs) : null;
}

/** Población de todo el país. */
export function poblacionPais(anio: number): Poblacion | null {
  const a = anioDisponible(anio);
  const pobs = Object.values(datos.municipios).map((r) => de(r, a)).filter((p): p is Poblacion => p !== null);
  return pobs.length ? sumar(pobs) : null;
}

export const nombreMunicipio = (dane: string) => datos.municipios[dane]?.nombre;
