import "server-only";

import { SQL_POR_ARCHIVO } from "@/lib/gestor/sql";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { CAMARAS, daneDeSede } from "./catalogo";

/**
 * Cámaras de comercio con lo que reporta el RUES (Confecámaras) en datos.gov.co. Cada cámara se consulta con tres agregaciones
 * (conteos, sin traer filas ni datos de personas): matrículas por estado, activas por tipo de organización y establecimientos.
 */
const BASE = "https://www.datos.gov.co/resource";
const REGISTRO = "c82u-588k";
const ESTABLECIMIENTOS = "nb3d-v3n7";
const TABLA = "camaras_comercio";

export type Camara = {
  codigo: string; nombre: string; sede: string | null; departamento: string | null; dane: string | null;
  total: number; activas: number; canceladas: number; personas_naturales: number; sociedades: number; esadl: number; establecimientos: number;
  organizaciones: Record<string, number> | null; fuente: string | null; actualizado_en: string;
};

async function agregar(recurso: string, select: string, where: string, group: string): Promise<Record<string, string>[]> {
  const url = `${BASE}/${recurso}.json?${new URLSearchParams({ $select: select, $where: where, $group: group, $limit: "500" })}`;
  let ultimo = "";
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(40_000), headers: { Accept: "application/json" } });
      if (r.ok) return (await r.json()) as Record<string, string>[];
      ultimo = `datos.gov.co respondió ${r.status}`;
    } catch (e) {
      ultimo = e instanceof Error ? e.message : "sin respuesta";
    }
    await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
  }
  throw new Error(`No se pudo consultar datos.gov.co: ${ultimo}`);
}

const entero = (v: unknown) => Number(v) || 0;
const esSociedad = (t: string) => /^SOCIEDAD|^EMPRESAS UNIPERSONALES|^EMPRESAS ASOCIATIVAS|^OTRAS SOCIEDADES/i.test(t);

/** Trae y guarda una cámara. */
export async function cargarCamara(codigo: string): Promise<Camara> {
  const base = CAMARAS.find((c) => c.codigo === codigo);
  if (!base) throw new Error("Esa cámara no existe.");
  const cliente = getSupabaseServerClient();
  if (!cliente) throw new Error("Falta conectar Supabase.");
  const cam = `codigo_camara='${codigo}'`;
  const [estados, tipos, estab] = await Promise.all([
    agregar(REGISTRO, "camara_comercio,estado_matricula,count(*) as n", cam, "camara_comercio,estado_matricula"),
    agregar(REGISTRO, "organizacion_juridica,count(*) as n", `${cam} AND estado_matricula='ACTIVA'`, "organizacion_juridica"),
    agregar(ESTABLECIMIENTOS, "count(*) as n", `${cam} AND estado_matricula='ACTIVA'`, "codigo_camara").catch(() => [] as Record<string, string>[]),
  ]);
  const nombre = estados.find((e) => e.camara_comercio)?.camara_comercio ?? base.sede;
  const total = estados.reduce((s, e) => s + entero(e.n), 0);
  const activas = estados.filter((e) => e.estado_matricula === "ACTIVA").reduce((s, e) => s + entero(e.n), 0);
  const canceladas = estados.filter((e) => /^CANCELADA/.test(e.estado_matricula ?? "")).reduce((s, e) => s + entero(e.n), 0);
  const organizaciones: Record<string, number> = {};
  let naturales = 0;
  let sociedades = 0;
  let esadl = 0;
  for (const t of tipos) {
    const tipo = t.organizacion_juridica ?? "Sin dato";
    const n = entero(t.n);
    organizaciones[tipo] = n;
    if (/^PERSONA NATURAL/i.test(tipo)) naturales += n;
    else if (esSociedad(tipo)) sociedades += n;
    else esadl += n;
  }
  const fila = {
    codigo, nombre, sede: base.sede, departamento: base.departamento, dane: daneDeSede(base.sede, base.departamento),
    total, activas, canceladas, personas_naturales: naturales, sociedades, esadl, establecimientos: entero(estab[0]?.n),
    organizaciones, fuente: "RUES · Confecámaras (datos.gov.co)", actualizado_en: new Date().toISOString(),
  };
  const { error } = await cliente.from(TABLA).upsert(fila, { onConflict: "codigo" });
  if (error) throw new Error(/camaras_comercio|schema cache|does not exist/i.test(error.message) ? "Falta crear la tabla de cámaras de comercio en Supabase." : error.message);
  return fila as Camara;
}

export async function leerCamaras(): Promise<{ disponible: boolean; sql?: string; camaras: Camara[] }> {
  const c = getSupabaseServerClient();
  if (!c) return { disponible: false, camaras: [] };
  const { data, error } = await c.from(TABLA).select("*").order("activas", { ascending: false });
  if (error) return { disponible: false, sql: SQL_POR_ARCHIVO.camaras, camaras: [] };
  return { disponible: true, camaras: (data ?? []) as Camara[] };
}
