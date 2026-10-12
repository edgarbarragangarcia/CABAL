import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ErrorPortales } from "../store";
import { SLUGS_RESERVADOS, type DatosPagina, type Pagina } from "./paginas-tipos";
import { slugDeTitulo, slugUnico } from "./puro";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;

function db() {
  const c = getSupabaseServerClient();
  if (!c) throw new ErrorPortales("sin_db", "Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  return c;
}
const sinTabla = (e: { code?: string; message?: string }) => e.code === "42P01" || e.code === "PGRST205" || /schema cache|does not exist/i.test(e.message ?? "");
const fallo = (e: { code?: string; message?: string }) =>
  sinTabla(e)
    ? new ErrorPortales("sin_tabla", "Falta el CMS avanzado: ejecuta supabase/portales-cms-pro.sql en Supabase.")
    : e.code === "23505" ? new ErrorPortales("duplicado", "Ya existe una página con ese enlace.")
    : (console.error("[portales/paginas]", e), new ErrorPortales("invalido", "No fue posible completar la acción."));

const aPagina = (f: Fila): Pagina => ({
  id: f.id,
  portalId: f.portal_id,
  slug: f.slug,
  titulo: f.titulo,
  resumen: f.resumen ?? "",
  cuerpo: f.cuerpo ?? "",
  estado: f.estado,
  enMenu: !!f.en_menu,
  orden: f.orden ?? 0,
  portadaUrl: f.portada_url ?? "",
  creadoEn: f.creado_en,
  actualizadoEn: f.actualizado_en,
});

export async function listarPaginas(portalId: string): Promise<Pagina[]> {
  const { data, error } = await db().from("portal_paginas").select("*").eq("portal_id", portalId).order("orden", { ascending: true }).order("titulo", { ascending: true }).limit(200);
  if (error) throw fallo(error);
  return ((data ?? []) as Fila[]).map(aPagina);
}

export async function obtenerPagina(portalId: string, id: string): Promise<Pagina> {
  const { data, error } = await db().from("portal_paginas").select("*").eq("portal_id", portalId).eq("id", id).maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "No existe esa página.");
  return aPagina(data);
}

function fila(d: DatosPagina) {
  return { titulo: d.titulo, resumen: d.resumen, cuerpo: d.cuerpo, estado: d.estado, en_menu: d.enMenu, orden: d.orden, portada_url: d.portadaUrl };
}

function validar(d: DatosPagina) {
  if (d.estado === "publicado" && d.cuerpo.trim().length < 20) throw new ErrorPortales("invalido", "La página está casi vacía: escribe su contenido antes de publicarla.");
}

async function enlacesUsados(portalId: string, base: string, excluirId?: string): Promise<Set<string>> {
  const { data, error } = await db().from("portal_paginas").select("id,slug").eq("portal_id", portalId).like("slug", `${base.slice(0, 50)}%`);
  if (error) throw fallo(error);
  const usados = new Set<string>((data ?? []).filter((f: Fila) => f.id !== excluirId).map((f: Fila) => f.slug));
  for (const r of SLUGS_RESERVADOS) usados.add(r);
  return usados;
}

export async function crearPagina(portalId: string, d: DatosPagina): Promise<Pagina> {
  validar(d);
  const base = d.slug ?? slugDeTitulo(d.titulo, 60);
  const slug = slugUnico(base || "pagina", await enlacesUsados(portalId, base), 60);
  const { data, error } = await db().from("portal_paginas").insert({ portal_id: portalId, slug, ...fila(d) }).select("*").single();
  if (error) throw fallo(error);
  return aPagina(data);
}

export async function actualizarPagina(portalId: string, id: string, d: DatosPagina): Promise<Pagina> {
  const actual = await obtenerPagina(portalId, id);
  validar(d);
  const slug = d.slug && d.slug !== actual.slug ? slugUnico(d.slug, await enlacesUsados(portalId, d.slug, id), 60) : actual.slug;
  const { data, error } = await db().from("portal_paginas").update({ slug, ...fila(d), actualizado_en: new Date().toISOString() }).eq("portal_id", portalId).eq("id", id).select("*").single();
  if (error) throw fallo(error);
  return aPagina(data);
}

export async function eliminarPagina(portalId: string, id: string) {
  const { error } = await db().from("portal_paginas").delete().eq("portal_id", portalId).eq("id", id);
  if (error) throw fallo(error);
}

/** Las páginas publicadas (para el menú y el pie). Sin las tablas del CMS avanzado, no hay páginas y nada se rompe. */
export async function paginasPublicadas(portalId: string): Promise<Pagina[]> {
  const { data, error } = await db().from("portal_paginas").select("*").eq("portal_id", portalId).eq("estado", "publicado").order("orden", { ascending: true }).limit(60);
  if (error) return [];
  return ((data ?? []) as Fila[]).map(aPagina);
}

export async function paginaPublicada(portalId: string, slug: string): Promise<Pagina | null> {
  const { data, error } = await db().from("portal_paginas").select("*").eq("portal_id", portalId).eq("slug", slug).eq("estado", "publicado").maybeSingle();
  if (error || !data) return null;
  return aPagina(data);
}
