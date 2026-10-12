import "server-only";

import type { Resultado } from "@/lib/gov-data/elecciones/resultados";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { resumirResultado } from "./votacion";

/** Elecciones del Senado en que María Fernanda tuvo votos propios (en 2026 su partido fue con lista cerrada). */
export const ELECCIONES_MAPA = [
  { id: "congreso-2022", titulo: "Senado 2022" },
  { id: "congreso-2018", titulo: "Senado 2018" },
] as const;

/**
 * Votos de María Fernanda Cabal en cada hijo de un lugar, para pintar el mapa: los departamentos de Colombia (`co`) o los municipios
 * de un departamento (`13`). Solo lee de Supabase; un lugar sin resultado guardado no aparece.
 */
export async function votosCabalPorLugar(eleccion: string, padre: string): Promise<{ votos: Record<string, number>; guardados: number }> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  let q = c.from("resultados_electorales").select("dane, datos").eq("eleccion", eleccion).eq("corporacion", "SE").eq("vacio", false);
  q = padre === "co" ? q.eq("nivel", 2) : q.eq("nivel", 3).like("dane", `${padre}%`);
  const { data, error } = await q.limit(1200);
  if (error) throw new Error(error.message);
  const votos: Record<string, number> = {};
  let guardados = 0;
  for (const f of (data ?? []) as { dane: string | null; datos: Resultado | null }[]) {
    if (!f.dane || !f.datos) continue;
    guardados++;
    votos[f.dane] = resumirResultado(f.datos).cabal?.votos ?? 0;
  }
  return { votos, guardados };
}
