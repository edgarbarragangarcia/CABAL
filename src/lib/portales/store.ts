import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { configPorDefecto, type ConfigPortal, type PlantillaId } from "./plantillas";

/** Acceso a los portales generados (tabla `portales`, ver supabase/portales.sql). Solo servidor, con la service role key. */

export type EstadoPortal = "borrador" | "publicado" | "pausado";
export type EventoPortal = { tipo: "creado" | "guardado" | "desplegado" | "pausado" | "reanudado" | "duplicado"; en: string; version?: number };
export type Portal = {
  id: string;
  slug: string;
  nombre: string;
  plantilla: PlantillaId;
  estado: EstadoPortal;
  config: ConfigPortal;
  version: number;
  eventos: EventoPortal[];
  creadoEn: string;
  actualizadoEn: string;
  publicadoEn: string | null;
};

export class ErrorPortales extends Error {
  constructor(public codigo: "sin_db" | "sin_tabla" | "duplicado" | "no_encontrado" | "invalido", mensaje: string) {
    super(mensaje);
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;

function db() {
  const c = getSupabaseServerClient();
  if (!c) throw new ErrorPortales("sin_db", "Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  return c;
}

const sinTabla = (e: { code?: string; message?: string }) => e.code === "42P01" || e.code === "PGRST205" || /schema cache|does not exist/i.test(e.message ?? "");
function fallo(e: { code?: string; message?: string }) {
  if (sinTabla(e)) return new ErrorPortales("sin_tabla", "Falta crear la tabla «portales»: ejecuta supabase/portales.sql en Supabase.");
  if (e.code === "23505") return new ErrorPortales("duplicado", "Ya existe un portal con ese enlace.");
  console.error("[portales]", e);
  return new ErrorPortales("invalido", "No fue posible completar la acción.");
}

const aPortal = (f: Fila): Portal => {
  const base = configPorDefecto(f.plantilla);
  const c = (f.config ?? {}) as Partial<ConfigPortal>;
  return {
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    plantilla: f.plantilla,
    estado: f.estado,
    config: { ...base, ...c, secciones: { ...base.secciones, ...(c.secciones ?? {}) } },
    version: f.version ?? 0,
    eventos: Array.isArray(f.eventos) ? f.eventos : [],
    creadoEn: f.creado_en,
    actualizadoEn: f.actualizado_en,
    publicadoEn: f.publicado_en ?? null,
  };
};

const conEvento = (eventos: EventoPortal[], e: Omit<EventoPortal, "en">) => [...eventos, { ...e, en: new Date().toISOString() }].slice(-40);

export async function hayTabla(): Promise<boolean> {
  // Con GET (no HEAD): una petición HEAD a una tabla inexistente no devuelve error y no deja distinguir los dos casos.
  const { error } = await db().from("portales").select("id").limit(1);
  if (error && sinTabla(error)) return false;
  if (error) throw fallo(error);
  return true;
}

export async function listarPortales(): Promise<Portal[]> {
  const { data, error } = await db().from("portales").select("*").order("actualizado_en", { ascending: false }).limit(200);
  if (error) throw fallo(error);
  return (data ?? []).map(aPortal);
}

async function obtener(id: string): Promise<Portal> {
  const { data, error } = await db().from("portales").select("*").eq("id", id).maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "No existe ese portal.");
  return aPortal(data);
}

export async function crearPortal(i: { nombre: string; slug: string; plantilla: PlantillaId; config: ConfigPortal }): Promise<Portal> {
  const { data, error } = await db()
    .from("portales")
    .insert({ slug: i.slug, nombre: i.nombre, plantilla: i.plantilla, config: i.config, eventos: conEvento([], { tipo: "creado" }) })
    .select("*")
    .single();
  if (error) throw fallo(error);
  return aPortal(data);
}

export async function guardarPortal(id: string, c: { nombre?: string; slug?: string; config?: ConfigPortal }): Promise<Portal> {
  const actual = await obtener(id);
  const { data, error } = await db()
    .from("portales")
    .update({
      ...(c.nombre ? { nombre: c.nombre } : {}),
      ...(c.slug ? { slug: c.slug } : {}),
      ...(c.config ? { config: c.config } : {}),
      eventos: conEvento(actual.eventos, { tipo: "guardado" }),
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw fallo(error);
  return aPortal(data);
}

/** Despliegue = el portal queda en línea en /p/<enlace> con la versión actual de su configuración. Cada despliegue sube la versión. */
export async function cambiarEstado(id: string, accion: "desplegar" | "pausar" | "reanudar"): Promise<Portal> {
  const actual = await obtener(id);
  const ahora = new Date().toISOString();
  const cambios: Fila =
    accion === "desplegar"
      ? { estado: "publicado", version: actual.version + 1, publicado_en: ahora, eventos: conEvento(actual.eventos, { tipo: "desplegado", version: actual.version + 1 }) }
      : accion === "pausar"
        ? { estado: "pausado", eventos: conEvento(actual.eventos, { tipo: "pausado" }) }
        : { estado: "publicado", eventos: conEvento(actual.eventos, { tipo: "reanudado", version: actual.version }) };
  if (accion === "reanudar" && actual.version === 0) throw new ErrorPortales("invalido", "Este portal todavía no se ha desplegado.");
  const { data, error } = await db().from("portales").update({ ...cambios, actualizado_en: ahora }).eq("id", id).select("*").single();
  if (error) throw fallo(error);
  return aPortal(data);
}

export async function duplicarPortal(id: string): Promise<Portal> {
  const o = await obtener(id);
  const { data: existentes } = await db().from("portales").select("slug").like("slug", `${o.slug.slice(0, 30)}-copia%`);
  const usados = new Set((existentes ?? []).map((x: Fila) => x.slug));
  let slug = `${o.slug.slice(0, 30)}-copia`;
  for (let n = 2; usados.has(slug); n++) slug = `${o.slug.slice(0, 28)}-copia-${n}`;
  const { data, error } = await db()
    .from("portales")
    .insert({ slug, nombre: `${o.nombre} (copia)`.slice(0, 80), plantilla: o.plantilla, config: { ...o.config, nombre: `${o.config.nombre} (copia)`.slice(0, 80) }, eventos: conEvento([], { tipo: "duplicado" }) })
    .select("*")
    .single();
  if (error) throw fallo(error);
  return aPortal(data);
}

export async function eliminarPortal(id: string) {
  const { error } = await db().from("portales").delete().eq("id", id);
  if (error) throw fallo(error);
}

/** Para la página pública: el portal con ese enlace (en cualquier estado; la página decide qué mostrar). */
export async function portalPorEnlace(slug: string): Promise<Portal | null> {
  const c = getSupabaseServerClient();
  if (!c) return null;
  const { data, error } = await c.from("portales").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return aPortal(data);
}
