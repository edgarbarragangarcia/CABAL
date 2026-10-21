import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Años que se guardan, con las 101 edades simples de hombres y de mujeres (ver scripts/proyeccion-dane.py). */
export const ANIOS_PROYECCION = [2022, 2026, 2030, 2034] as const;
const POR_PARTE_SQL = 400;
const POR_LOTE = 120;

type Registro = { n: string; d: string; y: Record<string, number[]> };
export type FilaCarga = { dane: string; anio: number; municipio: string; departamento: string; hombres: number[]; mujeres: number[] };

/** Todas las filas del archivo del DANE (el JSON se importa solo aquí para no engordar las demás rutas). */
export async function filasDelArchivo(): Promise<FilaCarga[]> {
  const datos = (await import("@/data/proyeccion-dane.json")).default as unknown as Record<string, Registro>;
  const filas: FilaCarga[] = [];
  for (const [dane, r] of Object.entries(datos)) {
    for (const [anio, v] of Object.entries(r.y)) filas.push({ dane, anio: Number(anio), municipio: r.n, departamento: r.d, hombres: v.slice(0, 101), mujeres: v.slice(101, 202) });
  }
  return filas.sort((a, b) => a.anio - b.anio || a.dane.localeCompare(b.dane));
}

export async function estadoCarga(): Promise<{ filas: number; esperadas: number; porAnio: Record<number, number> }> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Supabase no está conectado.");
  const porAnio: Record<number, number> = {};
  for (const anio of ANIOS_PROYECCION) {
    const { count, error } = await c.from("proyeccion_poblacion").select("*", { count: "exact", head: true }).eq("anio", anio);
    if (error) throw new Error(error.message.includes("proyeccion_poblacion") ? "Falta crear la tabla: corre supabase/proyeccion.sql en el SQL Editor de Supabase." : error.message);
    porAnio[anio] = count ?? 0;
  }
  const esperadas = (await filasDelArchivo()).length;
  return { filas: Object.values(porAnio).reduce((a, b) => a + b, 0), esperadas, porAnio };
}

/** Sube todas las filas a Supabase (se puede repetir: actualiza lo que ya está). */
export async function cargarProyeccion(): Promise<number> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Supabase no está conectado.");
  const filas = await filasDelArchivo();
  for (let i = 0; i < filas.length; i += POR_LOTE) {
    const { error } = await c.from("proyeccion_poblacion").upsert(filas.slice(i, i + POR_LOTE).map((f) => ({ ...f, actualizado_en: new Date().toISOString() })), { onConflict: "dane,anio" });
    if (error) throw new Error(error.message);
  }
  return filas.length;
}

const lit = (t: string) => `'${t.replace(/'/g, "''")}'`;

/** El mismo contenido como SQL, en partes que caben en el SQL Editor de Supabase. */
export async function sqlDeProyeccion(parte: number): Promise<{ sql: string; partes: number } | null> {
  const filas = await filasDelArchivo();
  const partes = Math.ceil(filas.length / POR_PARTE_SQL);
  if (parte < 1 || parte > partes) return null;
  const trozo = filas.slice((parte - 1) * POR_PARTE_SQL, parte * POR_PARTE_SQL);
  const valores = trozo.map((f) => `(${lit(f.dane)},${f.anio},${lit(f.municipio)},${lit(f.departamento)},'{${f.hombres.join(",")}}','{${f.mujeres.join(",")}}')`).join(",\n");
  const sql = `-- Proyección 2030: población DANE por municipio, sexo y edad. Parte ${parte} de ${partes} (${trozo.length} filas).\n-- Antes corre supabase/proyeccion.sql (crea la tabla). Cada parte se puede repetir sin problema.\ninsert into proyeccion_poblacion (dane, anio, municipio, departamento, hombres, mujeres) values\n${valores}\non conflict (dane, anio) do update set municipio = excluded.municipio, departamento = excluded.departamento, hombres = excluded.hombres, mujeres = excluded.mujeres, actualizado_en = now();\n`;
  return { sql, partes };
}
