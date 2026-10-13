import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Historial del monitoreo en Supabase (tabla `monitoreo_items`, ver supabase/monitoreo.sql). Lo que se encuentra en cada consulta
 * se acumula aquí: así el panel muestra más que la última búsqueda y no depende de que la fuente siga mostrándolo.
 * Nunca rompe la consulta: sin Supabase o sin la tabla, devuelve undefined y el panel usa lo que trajo la fuente en vivo.
 */
export type TipoItem = "video" | "dicho" | "cruce" | "prensa" | "x" | "web";
export type ItemMonitoreo = { personaje: string; tipo: TipoItem; enlace: string; titulo: string; medio: string | null; fecha: string; vistas: number | null; nombra: boolean; donde: string | null; contexto: string | null };

const TABLA = "monitoreo_items";

export async function guardarItems(items: ItemMonitoreo[]): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c || items.length === 0) return false;
  try {
    const ahora = new Date().toISOString();
    const { error } = await c.from(TABLA).upsert(items.map((i) => ({ ...i, actualizado_en: ahora })), { onConflict: "personaje,tipo,enlace" });
    return !error;
  } catch {
    return false;
  }
}

/** Lo guardado desde `desde` (ISO), lo más reciente primero. undefined si no se pudo leer. */
export async function leerItems(desde: string): Promise<ItemMonitoreo[] | undefined> {
  const c = getSupabaseServerClient();
  if (!c) return undefined;
  try {
    const { data, error } = await c.from(TABLA).select("personaje, tipo, enlace, titulo, medio, fecha, vistas, nombra, donde, contexto").gte("fecha", desde).order("fecha", { ascending: false }).limit(2000);
    return error ? undefined : (data as ItemMonitoreo[]);
  } catch {
    return undefined;
  }
}
