import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";

import { ORDEN_SQL, SQL_POR_ARCHIVO } from "./sql";

/**
 * El mapa de lo que hay en Supabase: módulos del panel y sus tablas, con cuántas filas tiene cada una. Las tablas que aún no se
 * han creado (falta ejecutar su SQL) salen con `filas: null` para que se vea qué falta.
 */
export type Modulo = { id: string; nombre: string; archivo: string; /** Archivos de supabase/ que lo crean, en el orden en que deben ejecutarse (incluye los que necesita antes). */ archivos: string[]; ancla: string; tablas: { tabla: string; sirve: string }[] };

export const MODULOS: Modulo[] = [
  {
    id: "electoral", nombre: "Datos electorales", archivo: "elecciones.sql", archivos: ["elecciones"], ancla: "resultados_electorales",
    tablas: [
      { tabla: "resultados_electorales", sirve: "Resultados por elección, cargo y territorio" },
      { tabla: "catalogo_electoral", sirve: "Nombres de elecciones y cargos" },
      { tabla: "carga_electoral", sirve: "Estado de la carga en segundo plano" },
    ],
  },
  {
    id: "documentos", nombre: "Documentos", archivo: "documentos.sql y gestor-documental.sql", archivos: ["documentos", "gestor-documental"], ancla: "documentos",
    tablas: [
      { tabla: "documentos", sirve: "Un registro por archivo subido" },
      { tabla: "documento_fragmentos", sirve: "Trozos de texto con su vector para buscar por significado" },
      { tabla: "documento_carpetas", sirve: "Carpetas para ordenar" },
      { tabla: "documento_eventos", sirve: "Historial: quién hizo qué" },
    ],
  },
  { id: "monitoreo", nombre: "Monitoreo", archivo: "monitoreo.sql", archivos: ["monitoreo"], ancla: "monitoreo_items", tablas: [{ tabla: "monitoreo_items", sirve: "Videos y titulares de cada político, con la marca «nombra a María Fernanda»" }] },
  { id: "territorio", nombre: "Territorio", archivo: "territorio.sql", archivos: ["territorio"], ancla: "indicadores_territoriales", tablas: [{ tabla: "indicadores_territoriales", sirve: "Indicadores oficiales por municipio (DANE, víctimas, homicidios…)" }] },
  {
    id: "comunidad", nombre: "Comunidad", archivo: "comunidad.sql", archivos: ["comunidad"], ancla: "miembros",
    tablas: [
      { tabla: "miembros", sirve: "Afiliados de la comunidad" },
      { tabla: "seguidores", sirve: "Quién sigue a quién" },
      { tabla: "grupos", sirve: "Grupos por municipio y barrio" },
      { tabla: "grupo_miembros", sirve: "Pertenencia a grupos" },
      { tabla: "publicaciones", sirve: "Publicaciones de la comunidad" },
      { tabla: "comentarios", sirve: "Comentarios" },
      { tabla: "me_gusta", sirve: "Reacciones" },
    ],
  },
  {
    id: "portales", nombre: "Portales", archivo: "comunidad.sql, portales.sql, portales-crm.sql y portales-cms-pro.sql (en ese orden)", archivos: ["comunidad", "portales", "portales-crm", "portales-cms-pro"], ancla: "portales",
    tablas: [
      { tabla: "portales", sirve: "Cada portal temático" },
      { tabla: "portal_articulos", sirve: "Artículos" },
      { tabla: "portal_articulo_versiones", sirve: "Historial de versiones de artículos" },
      { tabla: "portal_paginas", sirve: "Páginas del portal" },
      { tabla: "portal_medios", sirve: "Biblioteca de medios" },
      { tabla: "portal_eventos", sirve: "Eventos" },
      { tabla: "portal_inscripciones", sirve: "Inscripciones a eventos" },
      { tabla: "portal_contactos", sirve: "Personas del CRM" },
      { tabla: "portal_adeptos", sirve: "Quienes se suman a la comunidad" },
      { tabla: "portal_interacciones", sirve: "Historial de contacto" },
      { tabla: "portal_campanas", sirve: "Boletines y campañas" },
      { tabla: "portal_anuncios", sirve: "Publicidad" },
      { tabla: "portal_metricas", sirve: "Visitas y clics" },
      { tabla: "portal_ajustes", sirve: "Ajustes del portal" },
    ],
  },
];

export type TablaMapa = { tabla: string; sirve: string; filas: number | null };
export type ModuloMapa = { id: string; nombre: string; archivo: string; archivos: string[]; ancla: string; tablas: TablaMapa[]; /** SQL (en orden) que crea lo que falta; solo si falta alguna tabla. */ sql?: string };
export type DetalleMapa = {
  carpetas: { nombre: string; documentos: number }[];
  sinCarpeta: number;
  elecciones: { eleccion: string; corporacion: string; guardados: number; vacios: number }[];
  personajes: { personaje: string; items: number; nombran: number }[];
};
export type RespuestaMapa = {
  conectado: boolean;
  generadoEn: string;
  modulos: ModuloMapa[];
  detalle: DetalleMapa;
  /** Todo el SQL de lo que falta, en el orden correcto, para ejecutarlo de una vez. */
  sqlFaltante?: string;
  editorSql?: string;
};

const unirSql = (archivos: Iterable<string>) => {
  const piden = new Set(archivos);
  return ORDEN_SQL.filter((n) => piden.has(n)).map((n) => `-- ===== ${n}.sql =====\n${SQL_POR_ARCHIVO[n]}`).join("\n\n");
};

const editorSql = () => {
  try {
    const ref = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : "";
    return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : undefined;
  } catch {
    return undefined;
  }
};

export async function mapaDeDatos(): Promise<RespuestaMapa> {
  const c = getSupabaseServerClient();
  const vacio: DetalleMapa = { carpetas: [], sinCarpeta: 0, elecciones: [], personajes: [] };
  if (!c) return { conectado: false, generadoEn: new Date().toISOString(), modulos: MODULOS.map((m) => ({ ...m, tablas: m.tablas.map((t) => ({ ...t, filas: null })) })), detalle: vacio };

  const contar = async (tabla: string): Promise<number | null> => {
    try {
      const { count, error } = await c.from(tabla).select("*", { count: "estimated", head: true });
      return error ? null : (count ?? 0);
    } catch {
      return null;
    }
  };
  const modulos = await Promise.all(MODULOS.map(async (m) => ({ ...m, tablas: await Promise.all(m.tablas.map(async (t) => ({ ...t, filas: await contar(t.tabla) }))) })));

  const detalle: DetalleMapa = { ...vacio };
  try {
    const [carp, docs] = await Promise.all([
      c.from("documento_carpetas").select("id, nombre").limit(100),
      c.from("documentos").select("carpeta_id").is("eliminado_en", null).limit(5000),
    ]);
    const porCarpeta = new Map<string, number>();
    for (const d of (docs.data ?? []) as { carpeta_id: string | null }[]) {
      if (!d.carpeta_id) detalle.sinCarpeta++;
      else porCarpeta.set(d.carpeta_id, (porCarpeta.get(d.carpeta_id) ?? 0) + 1);
    }
    detalle.carpetas = ((carp.data ?? []) as { id: string; nombre: string }[]).map((k) => ({ nombre: k.nombre, documentos: porCarpeta.get(k.id) ?? 0 }));
  } catch {}
  try {
    const { data } = await c.rpc("cobertura_electoral");
    const por = new Map<string, { eleccion: string; corporacion: string; guardados: number; vacios: number }>();
    for (const f of (data ?? []) as { eleccion: string; corporacion: string; guardados: number | string; vacios: number | string }[]) {
      const k = `${f.eleccion}|${f.corporacion}`;
      const e = por.get(k) ?? { eleccion: f.eleccion, corporacion: f.corporacion, guardados: 0, vacios: 0 };
      e.guardados += Number(f.guardados) || 0;
      e.vacios += Number(f.vacios) || 0;
      por.set(k, e);
    }
    detalle.elecciones = [...por.values()].sort((a, b) => b.guardados - a.guardados);
  } catch {}
  try {
    const { data } = await c.from("monitoreo_items").select("personaje, nombra").limit(5000);
    const por = new Map<string, { items: number; nombran: number }>();
    for (const f of (data ?? []) as { personaje: string; nombra: boolean }[]) {
      const e = por.get(f.personaje) ?? { items: 0, nombran: 0 };
      e.items++;
      if (f.nombra) e.nombran++;
      por.set(f.personaje, e);
    }
    detalle.personajes = [...por.entries()].map(([personaje, v]) => ({ personaje, ...v }));
  } catch {}
  // Lo que falta: el SQL de cada módulo con tablas sin crear (con lo que necesita antes) y todo junto, en orden.
  const conFaltantes = modulos.map((m) => ({ ...m, sql: m.tablas.some((t) => t.filas === null) ? unirSql(m.archivos) : undefined }));
  const archivos = new Set(conFaltantes.filter((m) => m.sql).flatMap((m) => m.archivos));
  return { conectado: true, generadoEn: new Date().toISOString(), modulos: conFaltantes, detalle, ...(archivos.size ? { sqlFaltante: unirSql(archivos) } : {}), editorSql: editorSql() };
}
