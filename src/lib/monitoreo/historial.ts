import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Historial del monitoreo en Supabase (tabla `monitoreo_items`, ver supabase/monitoreo.sql). Lo que se encuentra en cada consulta
 * se acumula aquí: así el panel muestra más que la última búsqueda y no depende de que la fuente siga mostrándolo. Además guarda
 * (columnas `datos`, `tono`, `tono_ia`) las cifras, la miniatura, el canal y el tono de cada mención: se analiza una vez y queda.
 * Nunca rompe la consulta: sin Supabase o sin la tabla, devuelve undefined y el panel usa lo que trajo la fuente en vivo; sin las
 * columnas nuevas (falta ejecutar monitoreo.sql de nuevo) guarda y lee como antes.
 */
export type TipoItem = "video" | "dicho" | "cruce" | "prensa" | "x" | "web";
export type TonoGuardado = "positivo" | "neutral" | "negativo";
export type ItemMonitoreo = {
  personaje: string;
  tipo: TipoItem;
  enlace: string;
  titulo: string;
  medio: string | null;
  fecha: string;
  vistas: number | null;
  nombra: boolean;
  donde: string | null;
  contexto: string | null;
  /** Cuándo se guardó o se completó por última vez (solo al leer). */
  actualizado_en?: string;
  /** Cifras, miniatura, canal… (solo si hay columnas nuevas). `undefined` = no tocar lo ya guardado. */
  datos?: Record<string, unknown> | null;
  tono?: TonoGuardado | null;
  tono_ia?: boolean;
};

const TABLA = "monitoreo_items";
const BASE = "personaje, tipo, enlace, titulo, medio, fecha, vistas, nombra, donde, contexto, actualizado_en";
const EXTENDIDAS = `${BASE}, datos, tono, tono_ia`;

type Cliente = NonNullable<ReturnType<typeof getSupabaseServerClient>>;
let extendidas: { ok: boolean; en: number } | null = null;

/** ¿Existen las columnas del archivo (`datos`, `tono`, `tono_ia`)? Se comprueba una vez cada cinco minutos. */
async function hayExtendidas(c: Cliente): Promise<boolean> {
  // Un «sí» se recuerda cinco minutos; un «no» solo veinte segundos: si acaban de ejecutar el SQL, no debe seguir diciendo que faltan.
  if (extendidas && Date.now() - extendidas.en < (extendidas.ok ? 5 * 60_000 : 20_000)) return extendidas.ok;
  try {
    const { error } = await c.from(TABLA).select("datos, tono, tono_ia").limit(1);
    extendidas = { ok: !error, en: Date.now() };
  } catch {
    extendidas = { ok: false, en: Date.now() };
  }
  return extendidas.ok;
}

export const archivoDisponible = async (): Promise<boolean> => {
  const c = getSupabaseServerClient();
  return c ? hayExtendidas(c) : false;
};

/**
 * Sube filas en tandas y, si una tanda falla (una fila rara, un duplicado, un tropiezo), la parte a la mitad hasta aislar la
 * fila mala: así una sola fila defectuosa no deja sin guardar las otras 800. Devuelve cuántas quedaron guardadas.
 */
async function subirTanda(c: Cliente, filas: Record<string, unknown>[], profundidad = 0): Promise<number> {
  if (filas.length === 0) return 0;
  const { error } = await c.from(TABLA).upsert(filas, { onConflict: "personaje,tipo,enlace" });
  if (!error) return filas.length;
  if (filas.length === 1 || profundidad > 8) return 0;
  const mitad = Math.ceil(filas.length / 2);
  return (await subirTanda(c, filas.slice(0, mitad), profundidad + 1)) + (await subirTanda(c, filas.slice(mitad), profundidad + 1));
}

/** Guarda las menciones (sin repetir el mismo enlace dentro del envío) y dice si quedó guardada al menos una. */
export async function guardarItems(items: ItemMonitoreo[]): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c || items.length === 0) return false;
  try {
    const ahora = new Date().toISOString();
    const con = await hayExtendidas(c);
    // Un mismo envío no puede traer dos veces la misma mención (Postgres rechaza todo el lote): la última gana.
    const unicos = new Map<string, ItemMonitoreo>();
    for (const i of items) unicos.set(`${i.personaje}|${i.tipo}|${i.enlace}`, i);
    // En un mismo envío todas las filas llevan las mismas columnas: las que traen datos van aparte de las que no (no se borra lo ya guardado).
    const conDatos: Record<string, unknown>[] = [];
    const sinDatos: Record<string, unknown>[] = [];
    for (const i of unicos.values()) {
      const { datos, tono, tono_ia, ...base } = i;
      const fila: Record<string, unknown> = { ...base, actualizado_en: ahora };
      if (con && (datos !== undefined || tono !== undefined || tono_ia !== undefined)) {
        conDatos.push({ ...fila, datos: datos ?? null, tono: tono ?? null, tono_ia: tono_ia ?? false });
      } else sinDatos.push(fila);
    }
    let guardadas = 0;
    for (const grupo of [sinDatos, conDatos]) {
      for (let i = 0; i < grupo.length; i += 200) guardadas += await subirTanda(c, grupo.slice(i, i + 200));
    }
    return guardadas > 0;
  } catch {
    return false;
  }
}

/**
 * Lo guardado desde `desde` (ISO), lo más reciente primero. undefined si no se pudo leer. Se lee por páginas de mil (el límite de
 * Supabase por respuesta) hasta `limite` filas.
 */
export async function leerItems(desde: string, opciones: { personaje?: string; limite?: number } = {}): Promise<ItemMonitoreo[] | undefined> {
  const c = getSupabaseServerClient();
  if (!c) return undefined;
  try {
    const con = await hayExtendidas(c);
    const limite = opciones.limite ?? 2000;
    const filas: ItemMonitoreo[] = [];
    for (let desdeFila = 0; desdeFila < limite; desdeFila += 1000) {
      let q = c.from(TABLA).select(con ? EXTENDIDAS : BASE).gte("fecha", desde).order("fecha", { ascending: false }).range(desdeFila, Math.min(desdeFila + 999, limite - 1));
      if (opciones.personaje) q = q.eq("personaje", opciones.personaje);
      const { data, error } = await q;
      if (error) return desdeFila === 0 ? undefined : filas;
      const pagina = (data ?? []) as unknown as ItemMonitoreo[];
      filas.push(...pagina);
      if (pagina.length < 1000) break;
    }
    return filas;
  } catch {
    return undefined;
  }
}

/** Completa filas ya guardadas con lo analizado (ficha del video, tono): solo escribe esas columnas. */
export async function actualizarDatos(filas: { personaje: string; tipo: TipoItem; enlace: string; titulo: string; fecha: string; vistas?: number | null; datos?: Record<string, unknown>; tono?: TonoGuardado; tono_ia?: boolean }[]): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c || filas.length === 0) return false;
  try {
    if (!(await hayExtendidas(c))) return false;
    const ahora = new Date().toISOString();
    const { error } = await c.from(TABLA).upsert(
      filas.map((f) => ({ ...f, actualizado_en: ahora })),
      { onConflict: "personaje,tipo,enlace" }
    );
    return !error;
  } catch {
    return false;
  }
}
