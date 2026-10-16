import "server-only";

import { SQL_POR_ARCHIVO } from "@/lib/gestor/sql";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const TABLA = "redactor_notas";

export type NotaGuardada = {
  id: string; titulo: string; resumen: string; cuerpo: string; claves: string[]; palabraClave: string; portadaUrl: string; portadaAlt: string;
  seccion: string; region: string; seoTitulo: string; seoDescripcion: string; grafica: unknown; material: string; fuentes: { titulo: string; url: string }[];
  modo: "manual" | "ia"; formato: string; tono: string; estado: "borrador" | "revision" | "enviada"; generadaConIa: boolean; revisada: boolean; portalId: string | null;
  autor: string | null; creadoEn: string; actualizadoEn: string;
};

type Fila = Record<string, unknown>;
const aNota = (f: Fila): NotaGuardada => ({
  id: String(f.id), titulo: String(f.titulo ?? ""), resumen: String(f.resumen ?? ""), cuerpo: String(f.cuerpo ?? ""), claves: (f.claves as string[]) ?? [],
  palabraClave: String(f.palabra_clave ?? ""), portadaUrl: String(f.portada_url ?? ""), portadaAlt: String(f.portada_alt ?? ""), seccion: String(f.seccion ?? ""),
  region: String(f.region ?? ""), seoTitulo: String(f.seo_titulo ?? ""), seoDescripcion: String(f.seo_descripcion ?? ""), grafica: f.grafica ?? null,
  material: String(f.material ?? ""), fuentes: (f.fuentes as { titulo: string; url: string }[]) ?? [], modo: f.modo === "ia" ? "ia" : "manual", formato: String(f.formato ?? "nota"),
  tono: String(f.tono ?? "institucional"), estado: (f.estado as NotaGuardada["estado"]) ?? "borrador", generadaConIa: !!f.generada_con_ia, revisada: !!f.revisada,
  portalId: (f.portal_id as string | null) ?? null, autor: (f.autor as string | null) ?? null, creadoEn: String(f.creado_en), actualizadoEn: String(f.actualizado_en),
});

const aFila = (n: Partial<NotaGuardada>) => ({
  ...(n.titulo !== undefined && { titulo: n.titulo }), ...(n.resumen !== undefined && { resumen: n.resumen }), ...(n.cuerpo !== undefined && { cuerpo: n.cuerpo }),
  ...(n.claves !== undefined && { claves: n.claves }), ...(n.palabraClave !== undefined && { palabra_clave: n.palabraClave }),
  ...(n.portadaUrl !== undefined && { portada_url: n.portadaUrl }), ...(n.portadaAlt !== undefined && { portada_alt: n.portadaAlt }),
  ...(n.seccion !== undefined && { seccion: n.seccion }), ...(n.region !== undefined && { region: n.region }),
  ...(n.seoTitulo !== undefined && { seo_titulo: n.seoTitulo }), ...(n.seoDescripcion !== undefined && { seo_descripcion: n.seoDescripcion }),
  ...(n.grafica !== undefined && { grafica: n.grafica }), ...(n.material !== undefined && { material: n.material }), ...(n.fuentes !== undefined && { fuentes: n.fuentes }),
  ...(n.modo !== undefined && { modo: n.modo }), ...(n.formato !== undefined && { formato: n.formato }), ...(n.tono !== undefined && { tono: n.tono }), ...(n.estado !== undefined && { estado: n.estado }),
  ...(n.generadaConIa !== undefined && { generada_con_ia: n.generadaConIa }), ...(n.revisada !== undefined && { revisada: n.revisada }),
  ...(n.portalId !== undefined && { portal_id: n.portalId }),
});

export async function listarNotas(): Promise<{ disponible: boolean; sql?: string; notas: NotaGuardada[] }> {
  const c = getSupabaseServerClient();
  if (!c) return { disponible: false, notas: [] };
  const { data, error } = await c.from(TABLA).select("*").order("actualizado_en", { ascending: false }).limit(200);
  if (error) return { disponible: false, sql: SQL_POR_ARCHIVO.redactor, notas: [] };
  return { disponible: true, notas: (data ?? []).map((f) => aNota(f as Fila)) };
}

export async function leerNota(id: string): Promise<NotaGuardada | null> {
  const c = getSupabaseServerClient();
  if (!c) return null;
  const { data } = await c.from(TABLA).select("*").eq("id", id).maybeSingle();
  return data ? aNota(data as Fila) : null;
}

export async function guardarNota(id: string | null, n: Partial<NotaGuardada>, autor: string | null): Promise<NotaGuardada> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase.");
  const fila = { ...aFila(n), actualizado_en: new Date().toISOString() };
  const guardar = (f: Record<string, unknown>) =>
    id ? c.from(TABLA).update(f).eq("id", id).select("*").single() : c.from(TABLA).insert({ ...f, autor }).select("*").single();
  let r = await guardar(fila);
  // Si la tabla se creó con la primera versión del SQL (sin la columna «formato»), se guarda igual hasta que se vuelva a ejecutar.
  if (r.error && /formato/i.test(r.error.message)) {
    const { formato: _omitido, ...sinFormato } = fila as Record<string, unknown>;
    void _omitido;
    r = await guardar(sinFormato);
  }
  if (r.error) throw new Error(/redactor_notas|schema cache|does not exist/i.test(r.error.message) ? "Falta crear la tabla del redactor en Supabase." : r.error.message);
  return aNota(r.data as Fila);
}

export async function borrarNota(id: string): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c) return false;
  return !(await c.from(TABLA).delete().eq("id", id)).error;
}
