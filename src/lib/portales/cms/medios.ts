import "server-only";

import { randomUUID } from "node:crypto";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ErrorPortales } from "../store";
import { MAX_BYTES_IMAGEN, TIPOS_IMAGEN, nombreLimpio, tipoPorFirma, type Medio } from "./medios-puro";

export type { Medio };

/**
 * Biblioteca de medios de cada portal: las imágenes viven en Storage (bucket público «portal-medios», una carpeta por portal)
 * y su registro, texto alternativo y autor en la tabla `portal_medios` (supabase/portales-cms-pro.sql).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;

const BUCKET = "portal-medios";

function db() {
  const c = getSupabaseServerClient();
  if (!c) throw new ErrorPortales("sin_db", "Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  return c;
}
const sinTabla = (e: { code?: string; message?: string }) => e.code === "42P01" || e.code === "PGRST205" || /schema cache|does not exist/i.test(e.message ?? "");
const fallo = (e: { code?: string; message?: string }) =>
  sinTabla(e) ? new ErrorPortales("sin_tabla", "Falta el CMS avanzado: ejecuta supabase/portales-cms-pro.sql en Supabase.") : (console.error("[portales/medios]", e), new ErrorPortales("invalido", "No fue posible completar la acción."));

const aMedio = (f: Fila): Medio => ({ id: f.id, portalId: f.portal_id, nombre: f.nombre, url: f.url, tipo: f.tipo, bytes: f.bytes ?? 0, alt: f.alt ?? "", subidoPor: f.subido_por ?? "", creadoEn: f.creado_en });

export async function listarMedios(portalId: string): Promise<Medio[]> {
  const { data, error } = await db().from("portal_medios").select("*").eq("portal_id", portalId).order("creado_en", { ascending: false }).limit(500);
  if (error) throw fallo(error);
  return ((data ?? []) as Fila[]).map(aMedio);
}

export async function subirMedio(portalId: string, archivo: { nombre: string; bytes: Uint8Array }, autor: string): Promise<Medio> {
  if (archivo.bytes.length === 0) throw new ErrorPortales("invalido", "El archivo está vacío.");
  if (archivo.bytes.length > MAX_BYTES_IMAGEN) throw new ErrorPortales("invalido", "La imagen pesa más de 4 MB.");
  const tipo = tipoPorFirma(archivo.bytes);
  if (!tipo) throw new ErrorPortales("invalido", "Solo se aceptan imágenes JPG, PNG, WebP o GIF.");
  const c = db();
  const ruta = `${portalId}/${randomUUID()}.${TIPOS_IMAGEN[tipo]}`;
  const subir = () => c.storage.from(BUCKET).upload(ruta, archivo.bytes, { contentType: tipo, cacheControl: "31536000", upsert: false });
  let r = await subir();
  if (r.error && /bucket not found|not found/i.test(r.error.message)) {
    await c.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES_IMAGEN, allowedMimeTypes: Object.keys(TIPOS_IMAGEN) });
    r = await subir();
  }
  if (r.error) {
    console.error("[portales/medios] subida:", r.error.message);
    throw new ErrorPortales("invalido", "No fue posible guardar la imagen.");
  }
  const url = c.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
  const { data, error } = await c.from("portal_medios").insert({ portal_id: portalId, nombre: nombreLimpio(archivo.nombre), ruta, url, tipo, bytes: archivo.bytes.length, subido_por: autor.slice(0, 120) }).select("*").single();
  if (error) {
    await c.storage.from(BUCKET).remove([ruta]);
    throw fallo(error);
  }
  return aMedio(data);
}

export async function actualizarAlt(portalId: string, id: string, alt: string): Promise<Medio> {
  const { data, error } = await db().from("portal_medios").update({ alt: alt.slice(0, 160) }).eq("portal_id", portalId).eq("id", id).select("*").maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "No existe esa imagen.");
  return aMedio(data);
}

/** Dónde se usa una imagen (portada de artículos, texto de artículos o de páginas): para avisar antes de borrarla. */
export async function usosDeMedio(portalId: string, url: string): Promise<{ articulos: string[]; paginas: string[] }> {
  const c = db();
  const seguro = url.replace(/[%_,()\\]/g, "");
  const [a, p] = await Promise.all([
    c.from("portal_articulos").select("titulo").eq("portal_id", portalId).or(`portada_url.eq.${seguro},cuerpo.ilike.%${seguro}%`).limit(20),
    c.from("portal_paginas").select("titulo").eq("portal_id", portalId).or(`portada_url.eq.${seguro},cuerpo.ilike.%${seguro}%`).limit(20),
  ]);
  return { articulos: ((a.data ?? []) as Fila[]).map((f) => f.titulo), paginas: ((p.data ?? []) as Fila[]).map((f) => f.titulo) };
}

export async function eliminarMedio(portalId: string, id: string): Promise<void> {
  const c = db();
  const { data, error } = await c.from("portal_medios").select("ruta").eq("portal_id", portalId).eq("id", id).maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "No existe esa imagen.");
  await c.storage.from(BUCKET).remove([data.ruta]);
  const { error: e2 } = await c.from("portal_medios").delete().eq("portal_id", portalId).eq("id", id);
  if (e2) throw fallo(e2);
}

export async function medioPorId(portalId: string, id: string): Promise<Medio | null> {
  const { data } = await db().from("portal_medios").select("*").eq("portal_id", portalId).eq("id", id).maybeSingle();
  return data ? aMedio(data) : null;
}
