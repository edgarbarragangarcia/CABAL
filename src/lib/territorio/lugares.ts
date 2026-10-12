import "server-only";

import snapshot from "@/data/dane/municipios.json";

/**
 * Departamentos y municipios de Colombia con su código DANE (de las proyecciones de población del DANE que ya están en el
 * repositorio). Los resultados electorales guardados en Supabase se buscan por ese mismo código.
 */

type Registro = { nombre: string; dep: string; departamento: string };
const municipios = (snapshot as unknown as { municipios: Record<string, Registro> }).municipios;

export type LugarBasico = { dane: string; nombre: string };
export type Lugar = LugarBasico & { nivel: "departamento" | "municipio"; departamento?: LugarBasico };

const departamentos = (() => {
  const m = new Map<string, string>();
  for (const r of Object.values(municipios)) m.set(r.dep, r.departamento);
  return [...m].map(([dane, nombre]): LugarBasico => ({ dane, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
})();

export function listaDeLugares() {
  return {
    departamentos,
    municipios: Object.entries(municipios)
      .map(([dane, r]) => ({ dane, nombre: r.nombre, dep: r.dep }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}

/** Un departamento (2 dígitos) o un municipio (5 dígitos) por su código DANE. */
export function lugarDe(dane: string): Lugar | null {
  if (/^\d{2}$/.test(dane)) {
    const d = departamentos.find((x) => x.dane === dane);
    return d ? { ...d, nivel: "departamento" } : null;
  }
  const r = /^\d{5}$/.test(dane) ? municipios[dane] : undefined;
  return r ? { dane, nombre: r.nombre, nivel: "municipio", departamento: { dane: r.dep, nombre: r.departamento } } : null;
}

/** Los municipios de un departamento. */
export const municipiosDe = (dep: string): LugarBasico[] =>
  Object.entries(municipios)
    .filter(([, r]) => r.dep === dep)
    .map(([dane, r]) => ({ dane, nombre: r.nombre }));
