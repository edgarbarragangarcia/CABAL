import "server-only";

import { findEleccion } from "@/lib/gov-data/elecciones/catalogo";
import { mismaPersona } from "@/lib/gov-data/elecciones/comparacion";
import type { Resultado } from "@/lib/gov-data/elecciones/resultados";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Cómo le fue a María Fernanda Cabal y a la oposición en un departamento o municipio, a partir de los resultados guardados en
 * Supabase (nunca se consulta a la Registraduría). Cada elección trae el ranking de partidos y de candidatos con ellos señalados.
 *
 * «La oposición» es, aquí, el Pacto Histórico y su lista antecesora de 2018 (Lista de la Decencia): se define en un solo lugar
 * (`ES_OPOSICION`) por si hubiera que cambiarlo.
 */

export const NOMBRE_CABAL = "MARIA FERNANDA CABAL MOLINA";
export const ES_OPOSICION = /PACTO HIST|DECENCIA|COLOMBIA HUMANA/i;
export const ES_PARTIDO_CABAL = /CENTRO DEMOCR/i;
/** Para el filtro `ilike` de las vistas de Supabase (con `*` como comodín). */
const PATRON_OPOSICION = ["partido.ilike.*PACTO HIST*", "partido.ilike.*DECENCIA*", "partido.ilike.*COLOMBIA HUMANA*"].join(",");

export const ELECCIONES_TERRITORIO = [
  { id: "congreso-2026", corporacion: "SE", titulo: "Senado 2026" },
  { id: "congreso-2022", corporacion: "SE", titulo: "Senado 2022" },
  { id: "congreso-2018", corporacion: "SE", titulo: "Senado 2018" },
  { id: "presidencia-2026-2v", corporacion: "PR", titulo: "Presidencia 2026 · 2ª vuelta" },
  { id: "presidencia-2022-2v", corporacion: "PR", titulo: "Presidencia 2022 · 2ª vuelta" },
] as const;

export type FilaRanking = { codigo: string; nombre: string; color: string; votos: number; pct: number; esCabal: boolean; esOposicion: boolean };
export type FilaCandidato = { nombre: string; partido: string; votos: number; pct: number; esCabal: boolean; esOposicion: boolean };

export type EleccionLugar = {
  id: string;
  titulo: string;
  fecha: string;
  corporacion: string;
  /** Hay resultado guardado para este lugar. */
  guardado: boolean;
  /** Lugares sumados (zonas o puestos): cuántos hay y cuántos están guardados. Solo en localidades, barrios y puestos. */
  cobertura?: { total: number; guardados: number };
  /** La Registraduría no publica este lugar para este cargo (marca guardada). */
  noPublicado?: boolean;
  validos: number;
  partidos: FilaRanking[];
  candidatos: FilaCandidato[];
  /** María Fernanda: sus votos y dónde quedó entre los candidatos (solo si aparece con votos propios). */
  cabal: { votos: number; pct: number; partido: string; puesto: number; de: number } | null;
  /** Su partido fue con lista cerrada: solo hay votos por la lista, no por cada candidato. */
  listaCerrada: boolean;
  /** Posición y votos de su partido en el ranking de partidos. */
  partidoCabal: { nombre: string; votos: number; pct: number; puesto: number } | null;
  oposicion: { partidos: string[]; votos: number; pct: number; puesto: number } | null;
  /** Votos de la oposición menos los de su partido, en puntos porcentuales (positivo = la oposición le ganó). */
  ventajaOposicion: number | null;
};

const pct = (votos: number, validos: number) => (validos > 0 ? (votos / validos) * 100 : 0);

/** Convierte un resultado guardado en el resumen que muestra la pantalla. */
export function resumirResultado(r: Resultado): Omit<EleccionLugar, "id" | "titulo" | "fecha" | "corporacion" | "guardado" | "noPublicado"> {
  const validos = r.circunscripciones.reduce((s, c) => s + c.validos, 0);
  const porPartido = new Map<string, FilaRanking & { candidatos: { nombre: string; votos: number; soloLista: boolean }[] }>();
  for (const c of r.circunscripciones) {
    for (const p of c.partidos) {
      const clave = `${p.codigo}|${p.nombre}`;
      const f = porPartido.get(clave) ?? { codigo: p.codigo, nombre: p.nombre, color: p.color, votos: 0, pct: 0, esCabal: false, esOposicion: ES_OPOSICION.test(p.nombre), candidatos: [] };
      f.votos += p.votos;
      for (const k of p.candidatos) f.candidatos.push({ nombre: k.nombre, votos: k.votos, soloLista: k.soloLista });
      porPartido.set(clave, f);
    }
  }
  const partidos = [...porPartido.values()].sort((a, b) => b.votos - a.votos);
  for (const p of partidos) {
    p.pct = pct(p.votos, validos);
    p.esCabal = p.candidatos.some((k) => !k.soloLista && mismaPersona(k.nombre, NOMBRE_CABAL));
  }

  const todos = partidos.flatMap((p) => p.candidatos.filter((k) => !k.soloLista).map((k) => ({ nombre: k.nombre, partido: p.nombre, votos: k.votos, esCabal: mismaPersona(k.nombre, NOMBRE_CABAL), esOposicion: p.esOposicion })));
  const conVotos = todos.filter((k) => k.votos > 0).sort((a, b) => b.votos - a.votos);
  const yo = conVotos.find((k) => k.esCabal);
  const cabal = yo ? { votos: yo.votos, pct: pct(yo.votos, validos), partido: yo.partido, puesto: 1 + conVotos.filter((k) => k.votos > yo.votos).length, de: conVotos.length } : null;

  // El partido de María Fernanda: el de sus votos si aparece; si no (lista cerrada), el Centro Democrático por su nombre.
  const miPartido = partidos.find((p) => p.esCabal) ?? partidos.find((p) => ES_PARTIDO_CABAL.test(p.nombre));
  const partidoCabal = miPartido ? { nombre: miPartido.nombre, votos: miPartido.votos, pct: miPartido.pct, puesto: 1 + partidos.filter((p) => p.votos > miPartido.votos).length } : null;
  // Lista cerrada: todos los votos del partido son por la lista (el departamento trae a los candidatos con 0 votos, el municipio no).
  const personales = (miPartido?.candidatos ?? []).filter((k) => !k.soloLista).reduce((s, k) => s + k.votos, 0);
  const listaCerrada = !!miPartido && !miPartido.esCabal && personales === 0 && miPartido.votos > 0 && ES_PARTIDO_CABAL.test(miPartido.nombre);

  const opos = partidos.filter((p) => p.esOposicion);
  const votosOpos = opos.reduce((s, p) => s + p.votos, 0);
  const oposicion = opos.length > 0 ? { partidos: opos.map((p) => p.nombre), votos: votosOpos, pct: pct(votosOpos, validos), puesto: 1 + partidos.filter((p) => p.votos > opos[0].votos).length } : null;

  return {
    validos,
    partidos: partidos.slice(0, 12).map(({ candidatos: _c, ...f }) => f),
    candidatos: conVotos.slice(0, 8).map((k) => ({ ...k, pct: pct(k.votos, validos) })),
    cabal,
    listaCerrada,
    partidoCabal,
    oposicion,
    ventajaOposicion: oposicion && miPartido ? oposicion.pct - miPartido.pct : null,
  };
}

/** Las elecciones de un departamento (nivel 2) o municipio (nivel 5 dígitos), leídas de Supabase. */
export async function eleccionesDeLugar(dane: string): Promise<EleccionLugar[]> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const nivel = dane.length === 2 ? 2 : 3;
  return Promise.all(
    ELECCIONES_TERRITORIO.map(async (e): Promise<EleccionLugar> => {
      const info = findEleccion(e.id);
      const vacio = { id: e.id, titulo: e.titulo, fecha: info?.fecha ?? "", corporacion: e.corporacion, validos: 0, partidos: [], candidatos: [], cabal: null, listaCerrada: false, partidoCabal: null, oposicion: null, ventajaOposicion: null };
      const { data, error } = await c.from("resultados_electorales").select("vacio, datos").eq("eleccion", e.id).eq("corporacion", e.corporacion).eq("nivel", nivel).eq("dane", dane).limit(1);
      if (error) throw new Error(error.message);
      const fila = data?.[0] as { vacio: boolean; datos: Resultado | null } | undefined;
      if (!fila) return { ...vacio, guardado: false };
      if (fila.vacio || !fila.datos) return { ...vacio, guardado: true, noPublicado: true };
      return { ...vacio, ...resumirResultado(fila.datos), guardado: true };
    })
  );
}
