import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { Fragmento } from "./fragmentos";

/**
 * Los documentos en Supabase: las tablas `documentos` y `documento_fragmentos` (supabase/documentos.sql) y el bucket privado
 * `documentos` de Storage, donde quedan el original y, mientras se sube, sus partes. Solo servidor, con la service role key.
 */

const BUCKET = "documentos";
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Fila = Record<string, any>;

export type Documento = {
  id: string;
  titulo: string;
  archivo: string | null;
  tipo: string | null;
  bytes: number | null;
  paginas: number | null;
  caracteres: number | null;
  fragmentos: number;
  vectorizados: number;
  estado: "subiendo" | "procesando" | "listo" | "error";
  error: string | null;
  modelo: string | null;
  etiquetas: string[];
  ruta: string | null;
  creadoEn: string;
  actualizadoEn: string;
  // Gestor documental (supabase/gestor-documental.sql); sin el SQL quedan en sus valores por omisión.
  carpetaId: string | null;
  descripcion: string | null;
  categoria: string | null;
  autor: string | null;
  fuente: string | null;
  fechaDocumento: string | null;
  confidencial: boolean;
  hash: string | null;
  version: number;
  grupoVersion: string | null;
  vigente: boolean;
  eliminadoEn: string | null;
};

export const aDocumento = (f: Fila): Documento => ({
  id: f.id,
  titulo: f.titulo,
  archivo: f.archivo ?? null,
  tipo: f.tipo ?? null,
  bytes: f.bytes === null || f.bytes === undefined ? null : Number(f.bytes),
  paginas: f.paginas ?? null,
  caracteres: f.caracteres ?? null,
  fragmentos: f.fragmentos ?? 0,
  vectorizados: f.vectorizados ?? 0,
  estado: f.estado,
  error: f.error ?? null,
  modelo: f.modelo ?? null,
  etiquetas: f.etiquetas ?? [],
  ruta: f.ruta ?? null,
  creadoEn: f.creado_en,
  actualizadoEn: f.actualizado_en,
  carpetaId: f.carpeta_id ?? null,
  descripcion: f.descripcion ?? null,
  categoria: f.categoria ?? null,
  autor: f.autor ?? null,
  fuente: f.fuente ?? null,
  fechaDocumento: f.fecha_documento ?? null,
  confidencial: f.confidencial ?? false,
  hash: f.hash ?? null,
  version: f.version ?? 1,
  grupoVersion: f.grupo_version ?? null,
  vigente: f.es_vigente ?? true,
  eliminadoEn: f.eliminado_en ?? null,
});

const faltaTabla = (e: { code?: string; message?: string }) =>
  e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202" || /schema cache|does not exist/i.test(e.message ?? "");

export function cliente() {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  return c;
}

export function fallo(e: { code?: string; message?: string }): never {
  throw new Error(faltaTabla(e) ? "Faltan las tablas de documentos: ejecuta supabase/documentos.sql en Supabase." : (e.message ?? "No se pudo usar Supabase."));
}

/** ¿Está Supabase conectado y tiene las tablas, el vector y las funciones? Se prueba cada pieza. */
export async function estadoDocumentos(): Promise<{ configurada: boolean; tabla: boolean; gestor?: boolean; error?: string }> {
  const c = getSupabaseServerClient();
  if (!c) return { configurada: false, tabla: false };
  for (const tabla of ["documentos", "documento_fragmentos"]) {
    const { error } = await c.from(tabla).select("id").limit(1);
    if (error) return faltaTabla(error) ? { configurada: true, tabla: false } : { configurada: true, tabla: false, error: error.message };
  }
  // Las funciones de búsqueda y de guardado de vectores: sin ellas el SQL quedó a medias.
  const { error } = await c.rpc("guardar_vectores", { p_filas: [] });
  if (error) return faltaTabla(error) ? { configurada: true, tabla: false } : { configurada: true, tabla: false, error: error.message };
  // El gestor documental (carpetas, versiones, papelera...) es una ampliación: sin su SQL todo lo anterior sigue funcionando.
  const g = await c.from("documento_carpetas").select("id").limit(1);
  const g2 = await c.from("documentos").select("carpeta_id, eliminado_en").limit(1);
  return { configurada: true, tabla: true, gestor: !g.error && !g2.error };
}

/** Los documentos; `papelera` trae solo los eliminados y, si no, se omiten (cuando el gestor está activo). */
export async function listarDocumentos(opciones: { papelera?: boolean } = {}): Promise<Documento[]> {
  const base = () => cliente().from("documentos").select("*").order("creado_en", { ascending: false }).limit(1000);
  const q = opciones.papelera ? base().not("eliminado_en", "is", null) : base().is("eliminado_en", null);
  const { data, error } = await q;
  if (error) {
    // Sin el SQL del gestor no existe la columna: se lista todo, como antes.
    if (error.code === "42703" || /eliminado_en/.test(error.message ?? "")) {
      if (opciones.papelera) return [];
      const r = await base();
      if (r.error) fallo(r.error);
      return (r.data ?? []).map(aDocumento);
    }
    fallo(error);
  }
  return (data ?? []).map(aDocumento);
}

export async function obtenerDocumento(id: string): Promise<Documento | null> {
  const { data, error } = await cliente().from("documentos").select("*").eq("id", id).maybeSingle();
  if (error) fallo(error);
  return data ? aDocumento(data) : null;
}

export async function crearDocumento(d: { titulo: string; archivo: string; tipo: string; bytes: number; etiquetas: string[]; extras?: Record<string, unknown> }): Promise<Documento> {
  const { data, error } = await cliente()
    .from("documentos")
    .insert({ titulo: d.titulo, archivo: d.archivo, tipo: d.tipo, bytes: d.bytes, etiquetas: d.etiquetas, estado: "subiendo", ...(d.extras ?? {}) })
    .select("*")
    .single();
  if (error) fallo(error);
  return aDocumento(data);
}

export type CambiosDocumento = Partial<Pick<Documento, "titulo" | "tipo" | "paginas" | "caracteres" | "fragmentos" | "vectorizados" | "estado" | "error" | "modelo" | "ruta">>;

export async function actualizarDocumento(id: string, cambios: CambiosDocumento): Promise<void> {
  const { error } = await cliente()
    .from("documentos")
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq("id", id);
  if (error) fallo(error);
}

/** Borra el documento (sus fragmentos se van con él) y sus archivos. */
export async function borrarDocumento(id: string): Promise<void> {
  const c = cliente();
  await borrarArchivos(id);
  const { error } = await c.from("documentos").delete().eq("id", id);
  if (error) fallo(error);
}

/** Guarda los fragmentos de un documento (sin vector todavía), reemplazando los que hubiera. */
export async function guardarFragmentos(id: string, fragmentos: Fragmento[]): Promise<void> {
  const c = cliente();
  const { error: borrar } = await c.from("documento_fragmentos").delete().eq("documento_id", id);
  if (borrar) fallo(borrar);
  for (let i = 0; i < fragmentos.length; i += 100) {
    const { error } = await c.from("documento_fragmentos").insert(
      fragmentos.slice(i, i + 100).map((f) => ({ documento_id: id, posicion: f.posicion, pagina: f.pagina, contenido: f.contenido, caracteres: f.contenido.length }))
    );
    if (error) fallo(error);
  }
}

/** Los fragmentos que aún no tienen vector, en orden. */
export async function fragmentosSinVector(id: string, limite: number): Promise<{ id: number; contenido: string }[]> {
  const { data, error } = await cliente()
    .from("documento_fragmentos")
    .select("id, contenido")
    .eq("documento_id", id)
    .is("embedding", null)
    .order("posicion")
    .limit(limite);
  if (error) fallo(error);
  return (data ?? []) as { id: number; contenido: string }[];
}

export async function contarSinVector(id: string): Promise<number> {
  const { count, error } = await cliente().from("documento_fragmentos").select("id", { count: "exact", head: true }).eq("documento_id", id).is("embedding", null);
  if (error) fallo(error);
  return count ?? 0;
}

export async function guardarVectores(filas: { id: number; embedding: number[]; modelo: string }[]): Promise<void> {
  if (filas.length === 0) return;
  const { error } = await cliente().rpc("guardar_vectores", { p_filas: filas });
  if (error) fallo(error);
}

export type Hallazgo = { documentoId: string; titulo: string; posicion: number; pagina: number | null; contenido: string; similitud: number };

export async function buscarFragmentos(embedding: number[], modelo: string, cantidad: number, documento?: string): Promise<Hallazgo[]> {
  const { data, error } = await cliente().rpc("buscar_fragmentos", {
    p_consulta: embedding,
    p_modelo: modelo,
    p_cantidad: cantidad,
    p_documento: documento ?? null,
  });
  if (error) fallo(error);
  return ((data ?? []) as Fila[]).map((f) => ({
    documentoId: f.documento_id,
    titulo: f.titulo,
    posicion: f.posicion,
    pagina: f.pagina ?? null,
    contenido: f.contenido,
    similitud: Number(f.similitud),
  }));
}

// ---------------------------------------------------------------- archivos ---

let bucketListo = false;

/** Crea el bucket privado si no existe (una vez por instancia). */
async function asegurarBucket() {
  if (bucketListo) return;
  const c = cliente();
  const { error } = await c.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 50 * 1024 * 1024 });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(`No se pudo preparar el almacén de archivos: ${error.message}`);
  bucketListo = true;
}

const nombreSeguro = (nombre: string) => nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "documento";
const rutaParte = (id: string, n: number) => `tmp/${id}/${String(n).padStart(4, "0")}`;

/** Guarda una parte del archivo mientras se sube (el navegador lo manda en trozos: Vercel no admite más de 4,5 MB por petición). */
export async function subirParte(id: string, n: number, datos: Buffer): Promise<void> {
  await asegurarBucket();
  const { error } = await cliente().storage.from(BUCKET).upload(rutaParte(id, n), datos, { contentType: "application/octet-stream", upsert: true });
  if (error) throw new Error(`No se pudo guardar la parte ${n + 1} del archivo: ${error.message}`);
}

/** Junta las partes en el archivo completo. */
export async function juntarPartes(id: string, partes: number): Promise<Buffer> {
  const c = cliente();
  const trozos: Buffer[] = [];
  for (let n = 0; n < partes; n++) {
    const { data, error } = await c.storage.from(BUCKET).download(rutaParte(id, n));
    if (error || !data) throw new Error(`Falta la parte ${n + 1} de ${partes} del archivo: vuelve a subirlo.`);
    trozos.push(Buffer.from(await data.arrayBuffer()));
  }
  return Buffer.concat(trozos);
}

/** Guarda el archivo original y borra las partes. Devuelve la ruta. */
export async function guardarOriginal(id: string, nombre: string, datos: Buffer, partes: number): Promise<string> {
  const c = cliente();
  const ruta = `${id}/${nombreSeguro(nombre)}`;
  const { error } = await c.storage.from(BUCKET).upload(ruta, datos, { contentType: "application/octet-stream", upsert: true });
  if (error) throw new Error(`No se pudo guardar el archivo original: ${error.message}`);
  await c.storage.from(BUCKET).remove(Array.from({ length: partes }, (_, n) => rutaParte(id, n)));
  return ruta;
}

/** Borra todo lo que haya guardado de un documento (el original y las partes que hubieran quedado). */
export async function borrarArchivos(id: string): Promise<void> {
  const c = cliente();
  const rutas: string[] = [];
  for (const carpeta of [id, `tmp/${id}`]) {
    const { data } = await c.storage.from(BUCKET).list(carpeta, { limit: 1000 });
    for (const o of data ?? []) rutas.push(`${carpeta}/${o.name}`);
  }
  if (rutas.length > 0) await c.storage.from(BUCKET).remove(rutas);
}

/** Enlace temporal (10 minutos) para bajar el original. */
export async function enlaceOriginal(ruta: string): Promise<string | null> {
  const { data } = await cliente().storage.from(BUCKET).createSignedUrl(ruta, 600);
  return data?.signedUrl ?? null;
}
