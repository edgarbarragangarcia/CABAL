import "server-only";

import { after } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ErrorPortales } from "../store";
import { anuncioVigente, slugDeTitulo, slugUnico } from "./puro";
import {
  ajustesPorDefecto,
  problemaParaPublicar,
  resumenVacio,
  type AjustesPortal,
  type Anuncio,
  type Articulo,
  type ArticuloLista,
  type DatosAnuncio,
  type DatosArticulo,
  type ResumenPortal,
} from "./tipos";

/**
 * Acceso a datos del CMS de los portales (ver supabase/portales.sql). Todos los portales comparten estas tablas y cada fila
 * lleva su `portal_id`: los artículos, los anuncios y los ajustes de un portal nunca se mezclan con los de otro. Solo servidor,
 * con la service role key.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;

function db() {
  const c = getSupabaseServerClient();
  if (!c) throw new ErrorPortales("sin_db", "Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  return c;
}

const sinTabla = (e: { code?: string; message?: string }) => e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202" || /schema cache|does not exist/i.test(e.message ?? "");
function fallo(e: { code?: string; message?: string }) {
  if (sinTabla(e)) return new ErrorPortales("sin_tabla", "Faltan las tablas del centro de operaciones: ejecuta supabase/portales.sql en Supabase.");
  if (e.code === "23505") return new ErrorPortales("duplicado", "Ya existe un artículo con ese enlace.");
  if (e.code === "23514") return new ErrorPortales("invalido", "Algún dato no cumple las reglas de la base (revisa los largos y los enlaces).");
  console.error("[portales/cms]", e);
  return new ErrorPortales("invalido", "No fue posible completar la acción.");
}

const TABLAS_CMS = ["portal_ajustes", "portal_articulos", "portal_anuncios", "portal_metricas", "portal_adeptos"] as const;

/** ¿Están todas las piezas del centro de operaciones (tablas y función de resumen)? */
export async function hayCms(): Promise<boolean> {
  const c = db();
  for (const t of TABLAS_CMS) {
    // Con GET (no HEAD): una petición HEAD a una tabla inexistente no devuelve error y no deja distinguir los dos casos.
    const { error } = await c.from(t).select("portal_id").limit(1);
    if (error && sinTabla(error)) return false;
    if (error && error.code !== "42703") throw fallo(error);
  }
  const { error } = await c.rpc("portal_resumen");
  if (error && sinTabla(error)) return false;
  if (error) throw fallo(error);
  return true;
}

// ------------------------------------------------------------- artículos ---

const COLS_LISTA = "id,portal_id,slug,titulo,resumen,categoria,tipo,etiquetas,estado,destacado,generado_con_ia,revisado,autor,vistas,publicado_en,creado_en,actualizado_en";

const aLista = (f: Fila): ArticuloLista => ({
  id: f.id,
  portalId: f.portal_id,
  slug: f.slug,
  titulo: f.titulo,
  resumen: f.resumen ?? "",
  categoria: f.categoria ?? "",
  tipo: f.tipo ?? "",
  etiquetas: Array.isArray(f.etiquetas) ? f.etiquetas : [],
  estado: f.estado,
  destacado: !!f.destacado,
  generadoConIa: !!f.generado_con_ia,
  revisado: !!f.revisado,
  autor: f.autor ?? "",
  vistas: f.vistas ?? 0,
  publicadoEn: f.publicado_en ?? null,
  creadoEn: f.creado_en,
  actualizadoEn: f.actualizado_en,
});
const aArticulo = (f: Fila): Articulo => ({ ...aLista(f), cuerpo: f.cuerpo ?? "", seoDescripcion: f.seo_descripcion ?? "" });

/** Los artículos de un portal para el panel, del más reciente al más antiguo (sin el cuerpo). */
export async function listarArticulos(portalId: string): Promise<ArticuloLista[]> {
  const { data, error } = await db().from("portal_articulos").select(COLS_LISTA).eq("portal_id", portalId).order("actualizado_en", { ascending: false }).limit(300);
  if (error) throw fallo(error);
  return (data ?? []).map(aLista);
}

export async function obtenerArticulo(portalId: string, id: string): Promise<Articulo> {
  const { data, error } = await db().from("portal_articulos").select("*").eq("portal_id", portalId).eq("id", id).maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "No existe ese artículo.");
  return aArticulo(data);
}

async function enlacesUsados(portalId: string, base: string, excluirId?: string): Promise<Set<string>> {
  const { data, error } = await db().from("portal_articulos").select("id,slug").eq("portal_id", portalId).like("slug", `${base.slice(0, 80)}%`);
  if (error) throw fallo(error);
  return new Set((data ?? []).filter((f: Fila) => f.id !== excluirId).map((f: Fila) => f.slug));
}

function cuerpoFila(d: DatosArticulo) {
  return {
    titulo: d.titulo,
    resumen: d.resumen,
    cuerpo: d.cuerpo,
    categoria: d.categoria,
    tipo: d.tipo,
    etiquetas: d.etiquetas,
    estado: d.estado,
    destacado: d.destacado,
    generado_con_ia: d.generadoConIa,
    revisado: d.revisado,
    autor: d.autor,
    seo_descripcion: d.seoDescripcion,
  };
}

function validarPublicacion(d: DatosArticulo) {
  if (d.estado !== "publicado") return;
  const problema = problemaParaPublicar(d);
  if (problema) throw new ErrorPortales("invalido", problema);
}

export async function crearArticulo(portalId: string, d: DatosArticulo): Promise<Articulo> {
  validarPublicacion(d);
  const base = d.slug ?? slugDeTitulo(d.titulo);
  const slug = d.slug ?? slugUnico(base, await enlacesUsados(portalId, base));
  const { data, error } = await db()
    .from("portal_articulos")
    .insert({ portal_id: portalId, slug, ...cuerpoFila(d), publicado_en: d.estado === "publicado" ? new Date().toISOString() : null })
    .select("*")
    .single();
  if (error) throw fallo(error);
  return aArticulo(data);
}

export async function actualizarArticulo(portalId: string, id: string, d: DatosArticulo): Promise<Articulo> {
  const actual = await obtenerArticulo(portalId, id);
  validarPublicacion(d);
  const ahora = new Date().toISOString();
  // La fecha de publicación es la de la primera vez que se publicó: editar o volver a publicar no la cambia.
  const publicadoEn = d.estado === "publicado" ? (actual.publicadoEn ?? ahora) : actual.publicadoEn;
  const slug = d.slug && d.slug !== actual.slug ? slugUnico(d.slug, await enlacesUsados(portalId, d.slug, id)) : actual.slug;
  const { data, error } = await db()
    .from("portal_articulos")
    .update({ slug, ...cuerpoFila(d), publicado_en: publicadoEn, actualizado_en: ahora })
    .eq("portal_id", portalId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw fallo(error);
  return aArticulo(data);
}

export async function eliminarArticulo(portalId: string, id: string) {
  const { error } = await db().from("portal_articulos").delete().eq("portal_id", portalId).eq("id", id);
  if (error) throw fallo(error);
}

/** Artículos publicados para el sitio público, destacados primero y luego los más recientes. */
export async function articulosPublicados(portalId: string, o: { categoria?: string; limite?: number; excluirId?: string } = {}): Promise<ArticuloLista[]> {
  let q = db().from("portal_articulos").select(COLS_LISTA).eq("portal_id", portalId).eq("estado", "publicado");
  if (o.categoria) q = q.eq("categoria", o.categoria);
  const limite = Math.min(o.limite ?? 60, 120);
  const { data, error } = await q.order("destacado", { ascending: false }).order("publicado_en", { ascending: false }).limit(limite + (o.excluirId ? 1 : 0));
  if (error) throw fallo(error);
  return (data ?? []).map(aLista).filter((a: ArticuloLista) => a.id !== o.excluirId).slice(0, limite);
}

export async function articuloPublicado(portalId: string, slug: string): Promise<Articulo | null> {
  const { data, error } = await db().from("portal_articulos").select("*").eq("portal_id", portalId).eq("slug", slug).eq("estado", "publicado").maybeSingle();
  if (error || !data) return null;
  return aArticulo(data);
}

// -------------------------------------------------------------- anuncios ---

const aAnuncio = (f: Fila): Anuncio => ({
  id: f.id,
  portalId: f.portal_id,
  espacio: f.espacio,
  nombre: f.nombre,
  anunciante: f.anunciante ?? "",
  formato: f.formato,
  titulo: f.titulo ?? "",
  texto: f.texto ?? "",
  boton: f.boton ?? "",
  imagenUrl: f.imagen_url ?? "",
  destinoUrl: f.destino_url,
  desde: f.desde ?? null,
  hasta: f.hasta ?? null,
  estado: f.estado,
  prioridad: f.prioridad ?? 1,
  impresiones: f.impresiones ?? 0,
  clics: f.clics ?? 0,
  creadoEn: f.creado_en,
});

function filaAnuncio(d: DatosAnuncio) {
  return {
    espacio: d.espacio,
    nombre: d.nombre,
    anunciante: d.anunciante,
    formato: d.formato,
    titulo: d.titulo,
    texto: d.texto,
    boton: d.boton,
    imagen_url: d.formato === "imagen" ? d.imagenUrl : "",
    destino_url: d.destinoUrl,
    desde: d.desde,
    hasta: d.hasta,
    estado: d.estado,
    prioridad: d.prioridad,
  };
}

export async function listarAnuncios(portalId: string): Promise<Anuncio[]> {
  const { data, error } = await db().from("portal_anuncios").select("*").eq("portal_id", portalId).order("creado_en", { ascending: false }).limit(300);
  if (error) throw fallo(error);
  return (data ?? []).map(aAnuncio);
}

export async function crearAnuncio(portalId: string, d: DatosAnuncio): Promise<Anuncio> {
  const { data, error } = await db().from("portal_anuncios").insert({ portal_id: portalId, ...filaAnuncio(d) }).select("*").single();
  if (error) throw fallo(error);
  return aAnuncio(data);
}

export async function actualizarAnuncio(portalId: string, id: string, d: DatosAnuncio): Promise<Anuncio> {
  const { data, error } = await db()
    .from("portal_anuncios")
    .update({ ...filaAnuncio(d), actualizado_en: new Date().toISOString() })
    .eq("portal_id", portalId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "No existe ese anuncio.");
  return aAnuncio(data);
}

export async function eliminarAnuncio(portalId: string, id: string) {
  const { error } = await db().from("portal_anuncios").delete().eq("portal_id", portalId).eq("id", id);
  if (error) throw fallo(error);
}

/** Los anuncios que se pueden mostrar hoy en el sitio público (activos y dentro de sus fechas). */
export async function anunciosVigentes(portalId: string): Promise<Anuncio[]> {
  const { data, error } = await db().from("portal_anuncios").select("*").eq("portal_id", portalId).eq("estado", "activo").limit(200);
  if (error) return [];
  return (data ?? []).map(aAnuncio).filter((a: Anuncio) => anuncioVigente(a));
}

export async function anuncioPorId(portalId: string, id: string): Promise<Anuncio | null> {
  const { data, error } = await db().from("portal_anuncios").select("*").eq("portal_id", portalId).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return aAnuncio(data);
}

// --------------------------------------------------------------- ajustes ---

/** Los ajustes del portal: lo guardado encima de lo que trae por defecto (así un ajuste nuevo nunca deja un portal viejo sin valor). */
export async function leerAjustes(portalId: string): Promise<AjustesPortal> {
  const base = ajustesPorDefecto();
  const c = getSupabaseServerClient();
  if (!c) return base;
  const { data, error } = await c.from("portal_ajustes").select("ajustes").eq("portal_id", portalId).maybeSingle();
  if (error || !data) return base;
  const a = (data.ajustes ?? {}) as Partial<AjustesPortal>;
  return {
    ...base,
    ...a,
    union: { ...base.union, ...(a.union ?? {}) },
    ia: { ...base.ia, ...(a.ia ?? {}) },
  };
}

export async function guardarAjustes(portalId: string, ajustes: AjustesPortal): Promise<AjustesPortal> {
  const { error } = await db().from("portal_ajustes").upsert({ portal_id: portalId, ajustes, actualizado_en: new Date().toISOString() }, { onConflict: "portal_id" });
  if (error) throw fallo(error);
  return ajustes;
}

// -------------------------------------------------------------- métricas ---

/** Los bots de buscadores y de vista previa no cuentan como visitas. */
export const esBot = (userAgent: string | null) => !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|headless|lighthouse/i.test(userAgent);

/**
 * Cuenta una visita ('vista': suma la del portal, la del artículo y una impresión a cada anuncio mostrado), un clic en
 * «Súmate» ('cta') o un clic en un anuncio ('anuncio'). No espera ni rompe la respuesta: si falla, solo se pierde un conteo.
 */
export function registrarEvento(portalId: string, evento: "vista" | "cta" | "anuncio", o: { articuloId?: string; anuncioIds?: string[] } = {}) {
  const c = getSupabaseServerClient();
  if (!c) return;
  const tarea = Promise.resolve(
    c.rpc("portal_registrar", { p_portal: portalId, p_evento: evento, p_articulo: o.articuloId ?? null, p_anuncios: o.anuncioIds ?? [] })
  )
    .then(({ error }) => {
      if (error && !sinTabla(error)) console.error("[portales/cms] métrica:", error.message);
    })
    .catch(() => undefined);
  try {
    after(tarea);
  } catch {
    /* fuera de una petición: la promesa sigue sola */
  }
}

/** Las cifras de cada portal, por id (los portales sin movimiento no aparecen: usar `resumenVacio`). */
export async function resumenPortales(): Promise<Record<string, ResumenPortal>> {
  const { data, error } = await db().rpc("portal_resumen");
  if (error) throw fallo(error);
  const salida: Record<string, ResumenPortal> = {};
  for (const f of (data ?? []) as Fila[]) {
    salida[f.portal_id] = {
      ...resumenVacio,
      publicados: Number(f.publicados) || 0,
      borradores: Number(f.borradores) || 0,
      lecturas: Number(f.lecturas) || 0,
      vistas30d: Number(f.vistas_30d) || 0,
      cta30d: Number(f.cta_30d) || 0,
      anuncioClics30d: Number(f.anuncio_clics_30d) || 0,
      anunciosActivos: Number(f.anuncios_activos) || 0,
      adeptos: Number(f.adeptos) || 0,
      adeptos30d: Number(f.adeptos_30d) || 0,
    };
  }
  return salida;
}

/**
 * Anota que un afiliado nuevo llegó desde un portal. Es lo último que ocurre al afiliarse y nunca debe estorbarlo: si el
 * portal no existe, o el centro de operaciones no está creado todavía, simplemente no se anota.
 */
export async function atribuirAdepto(miembroId: string, slugPortal: string): Promise<void> {
  const c = getSupabaseServerClient();
  if (!c || !/^[a-z0-9-]{3,40}$/.test(slugPortal)) return;
  try {
    const { data: portal } = await c.from("portales").select("id").eq("slug", slugPortal).maybeSingle();
    if (!portal) return;
    await c.from("portal_adeptos").upsert({ miembro_id: miembroId, portal_id: portal.id }, { onConflict: "miembro_id" });
  } catch {
    /* sin atribución, la afiliación sigue igual */
  }
}
