import "server-only";

import { SQL_POR_ARCHIVO } from "@/lib/gestor/sql";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Bitácora del piloto de IA: tareas con su tiempo, costo y precisión, y los totales para decidir qué ampliar. */
export type RegistroPiloto = { id: number; fecha: string; tarea: string; area: string; minutos_sin_ia: number; minutos_con_ia: number; costo_cop: number; precision: number | null; errores: number; nota: string | null; usuario: string | null };

export type ResumenPiloto = { registros: number; minutosAhorrados: number; costoCop: number; precisionPromedio: number | null; errores: number; porArea: { area: string; registros: number; minutosAhorrados: number }[] };

export function resumir(lista: RegistroPiloto[]): ResumenPiloto {
  const conPrecision = lista.filter((r) => r.precision !== null);
  const por = new Map<string, { registros: number; minutosAhorrados: number }>();
  for (const r of lista) {
    const e = por.get(r.area) ?? { registros: 0, minutosAhorrados: 0 };
    e.registros++;
    e.minutosAhorrados += r.minutos_sin_ia - r.minutos_con_ia;
    por.set(r.area, e);
  }
  return {
    registros: lista.length,
    minutosAhorrados: lista.reduce((s, r) => s + (r.minutos_sin_ia - r.minutos_con_ia), 0),
    costoCop: lista.reduce((s, r) => s + Number(r.costo_cop), 0),
    precisionPromedio: conPrecision.length ? conPrecision.reduce((s, r) => s + (r.precision ?? 0), 0) / conPrecision.length : null,
    errores: lista.reduce((s, r) => s + r.errores, 0),
    porArea: [...por].map(([area, v]) => ({ area, ...v })).sort((a, b) => b.minutosAhorrados - a.minutosAhorrados),
  };
}

export async function leerPiloto(): Promise<{ disponible: boolean; sql?: string; registros: RegistroPiloto[]; resumen: ResumenPiloto }> {
  const c = getSupabaseServerClient();
  const vacio = resumir([]);
  if (!c) return { disponible: false, registros: [], resumen: vacio };
  const { data, error } = await c.from("piloto_registros").select("*").order("fecha", { ascending: false }).order("id", { ascending: false }).limit(1000);
  if (error) return { disponible: false, sql: SQL_POR_ARCHIVO.piloto, registros: [], resumen: vacio };
  const registros = (data ?? []) as RegistroPiloto[];
  return { disponible: true, registros, resumen: resumir(registros) };
}

export async function agregarRegistro(r: Omit<RegistroPiloto, "id">): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c) return false;
  const { error } = await c.from("piloto_registros").insert(r);
  return !error;
}

export async function borrarRegistro(id: number): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c) return false;
  const { error } = await c.from("piloto_registros").delete().eq("id", id);
  return !error;
}
