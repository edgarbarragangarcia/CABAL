import "server-only";

import { createHash } from "node:crypto";

import { SQL_POR_ARCHIVO } from "@/lib/gestor/sql";
import { getSupabaseServerClient } from "@/lib/supabase-server";

import { construirHuella, elegirEjemplos, bloqueVoz, type Huella, type ItemVoz } from "./huella";

const TABLA = "voz_corpus";
export const FORMATOS_VOZ = ["general", "x", "instagram", "facebook", "tiktok", "columna", "discurso", "entrevista"] as const;
export type FormatoVoz = (typeof FORMATOS_VOZ)[number];

export type FuenteVoz = { id: string; tipo: "archivo" | "youtube" | "texto"; titulo: string; fuente: string | null; formato: string; palabras: number; caracteres: number; paginas: number | null; activo: boolean; creadoEn: string; vistaPrevia: string };

type Fila = Record<string, unknown>;

export async function listarVoz(): Promise<{ disponible: boolean; sql?: string; fuentes: FuenteVoz[]; huella: Huella | null }> {
  const c = getSupabaseServerClient();
  if (!c) return { disponible: false, fuentes: [], huella: null };
  const { data, error } = await c.from(TABLA).select("id, tipo, titulo, fuente, formato, contenido, palabras, caracteres, paginas, activo, creado_en").order("creado_en", { ascending: false }).limit(2000);
  if (error) return { disponible: false, sql: SQL_POR_ARCHIVO.voz, fuentes: [], huella: null };
  const filas = (data ?? []) as Fila[];
  const fuentes = filas.map((f): FuenteVoz => ({
    id: String(f.id), tipo: f.tipo as FuenteVoz["tipo"], titulo: String(f.titulo), fuente: (f.fuente as string | null) ?? null, formato: String(f.formato), palabras: Number(f.palabras) || 0,
    caracteres: Number(f.caracteres) || 0, paginas: (f.paginas as number | null) ?? null, activo: !!f.activo, creadoEn: String(f.creado_en), vistaPrevia: String(f.contenido).slice(0, 700),
  }));
  const activos = filas.filter((f) => f.activo).map((f) => String(f.contenido));
  return { disponible: true, fuentes, huella: activos.length ? construirHuella(activos) : null };
}

export async function agregarTexto(d: { tipo: FuenteVoz["tipo"]; titulo: string; fuente?: string | null; formato: string; contenido: string; paginas?: number | null; por: string | null }): Promise<{ ok: true; id: string; palabras: number } | { ok: false; duplicado?: boolean; error: string }> {
  const c = getSupabaseServerClient();
  if (!c) return { ok: false, error: "Falta conectar Supabase." };
  const contenido = d.contenido.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (contenido.length < 40) return { ok: false, error: "El texto es demasiado corto." };
  const hash = createHash("sha256").update(contenido.toLowerCase().replace(/\s+/g, " ")).digest("hex");
  const palabras = (contenido.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  const { data, error } = await c.from(TABLA).insert({
    tipo: d.tipo, titulo: d.titulo.slice(0, 200), fuente: d.fuente ?? null, formato: (FORMATOS_VOZ as readonly string[]).includes(d.formato) ? d.formato : "general",
    contenido, palabras, caracteres: contenido.length, paginas: d.paginas ?? null, hash, creado_por: d.por,
  }).select("id").single();
  if (error) {
    if (error.code === "23505") return { ok: false, duplicado: true, error: "Ese texto ya estaba cargado." };
    return { ok: false, error: /voz_corpus|schema cache|does not exist/i.test(error.message) ? "Falta crear la tabla de la voz: ejecuta voz.sql en Supabase." : error.message };
  }
  return { ok: true, id: String((data as Fila).id), palabras };
}

export async function cambiarVoz(id: string, c: { activo?: boolean; formato?: string; titulo?: string }): Promise<boolean> {
  const cli = getSupabaseServerClient();
  if (!cli) return false;
  const fila: Record<string, unknown> = {};
  if (typeof c.activo === "boolean") fila.activo = c.activo;
  if (typeof c.formato === "string" && (FORMATOS_VOZ as readonly string[]).includes(c.formato)) fila.formato = c.formato;
  if (typeof c.titulo === "string" && c.titulo.trim()) fila.titulo = c.titulo.trim().slice(0, 200);
  if (!Object.keys(fila).length) return false;
  return !(await cli.from(TABLA).update(fila).eq("id", id)).error;
}

export async function borrarVoz(id: string): Promise<boolean> {
  const c = getSupabaseServerClient();
  return !!c && !(await c.from(TABLA).delete().eq("id", id)).error;
}

/** Los textos activos completos, para armar los ejemplos y la huella de una redacción. */
async function corpusActivo(): Promise<ItemVoz[]> {
  const c = getSupabaseServerClient();
  if (!c) return [];
  const { data, error } = await c.from(TABLA).select("id, titulo, formato, contenido").eq("activo", true).limit(2000);
  if (error) return [];
  return ((data ?? []) as Fila[]).map((f) => ({ id: String(f.id), titulo: String(f.titulo), formato: String(f.formato), contenido: String(f.contenido) }));
}

/** El bloque de voz para la IA (vacío si todavía no hay textos suyos) y la huella con la que se verifica lo escrito. */
export async function vozParaRedactar(formato: string, tema: string): Promise<{ bloque: string; huella: Huella | null }> {
  const items = await corpusActivo();
  if (!items.length) return { bloque: "", huella: null };
  const huella = construirHuella(items.map((i) => i.contenido));
  const fmt = formato === "nota" ? "general" : formato === "bullets" ? "entrevista" : formato;
  return { bloque: bloqueVoz(huella, elegirEjemplos(items, fmt, tema)), huella };
}

export async function huellaActual(): Promise<Huella | null> {
  const items = await corpusActivo();
  return items.length ? construirHuella(items.map((i) => i.contenido)) : null;
}
