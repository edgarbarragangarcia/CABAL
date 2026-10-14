import "server-only";

import { coberturaGuardada } from "@/lib/gov-data/elecciones/almacen";
import { ELECCIONES } from "@/lib/gov-data/elecciones/catalogo";
import { PERSONAJES } from "@/lib/monitoreo/personajes";
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
  { id: "usuarios", nombre: "Usuarios del panel", archivo: "usuarios.sql", archivos: ["usuarios"], ancla: "admin_usuarios", tablas: [{ tabla: "admin_usuarios", sirve: "Personas con acceso al panel (correo y clave con hash)" }] },
  { id: "piloto", nombre: "Piloto de IA", archivo: "piloto.sql", archivos: ["piloto"], ancla: "piloto_registros", tablas: [{ tabla: "piloto_registros", sirve: "Tareas hechas con IA: tiempo, costo y precisión" }] },
  { id: "camaras", nombre: "Cámaras de comercio", archivo: "camaras.sql", archivos: ["camaras"], ancla: "camaras_comercio", tablas: [{ tabla: "camaras_comercio", sirve: "Matrículas y establecimientos de cada una de las 58 cámaras (RUES)" }] },
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
export type ModuloMapa = { id: string; nombre: string; archivo: string; archivos: string[]; ancla: string; tablas: TablaMapa[]; /** Lo que hay dentro, en palabras de la gente (documentos, portales, elecciones…), no tablas. */ entidades: Entidad[]; /** SQL (en orden) que crea lo que falta; solo si falta alguna tabla. */ sql?: string };
/** Algo que existe dentro de un módulo: un documento, un portal, una elección, un político… `hijos` es lo que tiene dentro. */
export type Entidad = {
  id: string;
  nombre: string;
  /** Una línea para leerla: «PDF · Listo», «Publicado»… */
  resumen: string;
  /** Cuánto contiene (sirve para el tamaño del nodo y el número que se ve). */
  cantidad: number;
  /** Qué cuenta `cantidad`: «trozos», «territorios», «contenidos»… */
  unidad: string;
  hijos: { nombre: string; cantidad: number }[];
};

export type RespuestaMapa = {
  conectado: boolean;
  generadoEn: string;
  modulos: ModuloMapa[];
  /** Todo el SQL de lo que falta, en el orden correcto, para ejecutarlo de una vez. */
  sqlFaltante?: string;
  editorSql?: string;
};

const unirSql = (archivos: Iterable<string>) => {
  const piden = new Set(archivos);
  return ORDEN_SQL.filter((n) => piden.has(n)).map((n) => `-- ===== ${n}.sql =====\n${SQL_POR_ARCHIVO[n]}`).join("\n\n");
};

export const editorSql = () => {
  try {
    const ref = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : "";
    return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : undefined;
  } catch {
    return undefined;
  }
};

type Cliente = NonNullable<ReturnType<typeof getSupabaseServerClient>>;
type Fila = Record<string, unknown>;
const MAX_POR_MODULO = 14;
const num = (v: unknown) => Number(v) || 0;
/** Una consulta que nunca rompe el mapa: si falla, devuelve `valor`. */
async function seguro<T>(f: () => Promise<T>, valor: T): Promise<T> {
  try {
    return await f();
  } catch {
    return valor;
  }
}

async function documentos(c: Cliente): Promise<Entidad[]> {
  const campos = "id, titulo, tipo, fragmentos, vectorizados, estado, paginas";
  let r = await c.from("documentos").select(`${campos}, eliminado_en`).is("eliminado_en", null).order("creado_en", { ascending: false }).limit(60);
  // Sin el SQL del gestor no existe la columna de papelera: se lee sin ese filtro.
  if (r.error) r = (await c.from("documentos").select(campos).order("creado_en", { ascending: false }).limit(60)) as typeof r;
  return ((r.data ?? []) as unknown as Fila[]).map((d) => {
    const trozos = num(d.fragmentos);
    const listos = num(d.vectorizados);
    const estado = d.estado === "listo" ? "Listo" : d.estado === "error" ? "Con error" : "Procesando";
    return {
      id: String(d.id),
      nombre: String(d.titulo ?? "Documento"),
      // Los trozos son cómo se parte el documento para buscar en él: se cuentan dentro del documento, no son otra cosa.
      resumen: `${String(d.tipo ?? "").toUpperCase() || "Archivo"} · ${estado}${d.paginas ? ` · ${num(d.paginas)} páginas` : ""} · ${trozos} trozos${listos < trozos ? ` (${listos} vectorizados)` : ""}`,
      cantidad: trozos,
      unidad: "trozos",
      hijos: [],
    };
  });
}

const CONTENIDO_PORTAL: [string, string][] = [
  ["portal_articulos", "Artículos"],
  ["portal_contactos", "Contactos"],
  ["portal_eventos", "Eventos"],
  ["portal_paginas", "Páginas"],
  ["portal_medios", "Medios"],
  ["portal_campanas", "Boletines"],
  ["portal_anuncios", "Anuncios"],
];

async function portales(c: Cliente): Promise<Entidad[]> {
  const { data } = await c.from("portales").select("id, nombre, estado, plantilla").order("creado_en", { ascending: true }).limit(20);
  const lista = (data ?? []) as unknown as Fila[];
  return Promise.all(
    lista.map(async (p): Promise<Entidad> => {
      const hijos = (
        await Promise.all(
          CONTENIDO_PORTAL.map(async ([tabla, nombre]) => {
            const cantidad = await seguro(async () => {
              const { count, error } = await c.from(tabla).select("portal_id", { count: "exact", head: true }).eq("portal_id", String(p.id));
              return error ? 0 : (count ?? 0);
            }, 0);
            return { nombre, cantidad };
          })
        )
      ).filter((h) => h.cantidad > 0);
      const total = hijos.reduce((s, h) => s + h.cantidad, 0);
      const estado = p.estado === "publicado" ? "Publicado" : p.estado === "pausado" ? "Pausado" : "Borrador";
      return { id: String(p.id), nombre: String(p.nombre ?? "Portal"), resumen: `${estado}${total === 0 ? " · todavía sin contenido" : ` · ${hijos.map((h) => `${h.cantidad} ${h.nombre.toLowerCase()}`).join(", ")}`}`, cantidad: total, unidad: "contenidos", hijos };
    })
  );
}

async function elecciones(): Promise<Entidad[]> {
  const cobertura = await Promise.race([coberturaGuardada(), new Promise<never>((_, no) => setTimeout(() => no(new Error("tarda")), 25_000))]);
  return ELECCIONES.map((e) => {
    const hijos = e.corporaciones
      .map((k) => ({ nombre: k.nombre, cantidad: cobertura.filter((f) => f.eleccion === e.id && f.corporacion === k.sigla).reduce((s, f) => s + f.guardados, 0) }))
      .filter((h) => h.cantidad > 0);
    const total = hijos.reduce((s, h) => s + h.cantidad, 0);
    return { id: e.id, nombre: e.nombre, resumen: total === 0 ? "Todavía sin cargar" : `${total.toLocaleString("es-CO")} territorios guardados · ${hijos.length} de ${e.corporaciones.length} cargos`, cantidad: total, unidad: "territorios", hijos };
  });
}

async function politicos(c: Cliente): Promise<Entidad[]> {
  // María Fernanda: sus menciones (prensa, redes, YouTube) con el desglose por red.
  const { data: mf } = await c.from("monitoreo_items").select("medio").eq("personaje", "mafe").limit(10000);
  const porRed = new Map<string, number>();
  for (const f of (mf ?? []) as unknown as { medio: string | null }[]) {
    const red = (f.medio ?? "web").split("|")[0] || "web";
    porRed.set(red, (porRed.get(red) ?? 0) + 1);
  }
  const mencionesMafe: Entidad = {
    id: "mafe",
    nombre: "María Fernanda en medios y redes",
    resumen: (mf?.length ?? 0) === 0 ? "Sin menciones guardadas" : `${(mf?.length ?? 0).toLocaleString("es-CO")} menciones del último mes`,
    cantidad: mf?.length ?? 0,
    unidad: "menciones",
    hijos: [...porRed].sort((a, b) => b[1] - a[1]).map(([nombre, cantidad]) => ({ nombre, cantidad })),
  };
  const { data } = await c.from("monitoreo_items").select("personaje, nombra").neq("personaje", "mafe").limit(5000);
  const por = new Map<string, { items: number; nombran: number }>();
  for (const f of (data ?? []) as unknown as { personaje: string; nombra: boolean }[]) {
    const e = por.get(f.personaje) ?? { items: 0, nombran: 0 };
    e.items++;
    if (f.nombra) e.nombran++;
    por.set(f.personaje, e);
  }
  return [mencionesMafe, ...PERSONAJES.map((p) => {
    const e = por.get(p.id) ?? { items: 0, nombran: 0 };
    return { id: p.id, nombre: p.nombre, resumen: e.items === 0 ? "Sin hallazgos guardados" : `${e.items} hallazgos · ${e.nombran === 0 ? "no nombra a María Fernanda" : `la nombra en ${e.nombran}`}`, cantidad: e.items, unidad: "hallazgos", hijos: [] };
  })];
}

/** Las tablas simples del módulo, con nombre de persona: «Afiliados», «Publicaciones»… */
const DESDE_TABLAS: Record<string, Record<string, string>> = {
  comunidad: { miembros: "Afiliados", grupos: "Grupos", grupo_miembros: "Pertenencias a grupos", publicaciones: "Publicaciones", comentarios: "Comentarios", me_gusta: "Reacciones", seguidores: "Seguimientos" },
  territorio: { indicadores_territoriales: "Indicadores por municipio" },
  usuarios: { admin_usuarios: "Usuarios con acceso" },
  piloto: { piloto_registros: "Tareas anotadas" },
  camaras: { camaras_comercio: "Cámaras de comercio" },
};

export async function mapaDeDatos(): Promise<RespuestaMapa> {
  const c = getSupabaseServerClient();
  if (!c) return { conectado: false, generadoEn: new Date().toISOString(), modulos: MODULOS.map((m) => ({ ...m, entidades: [], tablas: m.tablas.map((t) => ({ ...t, filas: null })) })), editorSql: editorSql() };

  const contar = async (tabla: string): Promise<number | null> => {
    try {
      const { count, error } = await c.from(tabla).select("*", { count: "estimated", head: true });
      return error ? null : (count ?? 0);
    } catch {
      return null;
    }
  };
  const [tablas, docs, ports, elecs, pols] = await Promise.all([
    Promise.all(MODULOS.map(async (m) => ({ ...m, tablas: await Promise.all(m.tablas.map(async (t) => ({ ...t, filas: await contar(t.tabla) }))) }))),
    seguro(() => documentos(c), [] as Entidad[]),
    seguro(() => portales(c), [] as Entidad[]),
    seguro(() => elecciones(), [] as Entidad[]),
    seguro(() => politicos(c), [] as Entidad[]),
  ]);

  const entidadesDe = (m: (typeof tablas)[number]): Entidad[] => {
    if (m.id === "documentos") return docs;
    if (m.id === "portales") return ports;
    if (m.id === "electoral") return elecs;
    if (m.id === "monitoreo") return pols;
    const nombres = DESDE_TABLAS[m.id] ?? {};
    return m.tablas.filter((t) => nombres[t.tabla] && t.filas !== null).map((t) => ({ id: t.tabla, nombre: nombres[t.tabla], resumen: `${(t.filas ?? 0).toLocaleString("es-CO")} registros`, cantidad: t.filas ?? 0, unidad: "registros", hijos: [] }));
  };

  // Lo que falta: el SQL de cada módulo con tablas sin crear (con lo que necesita antes) y todo junto, en orden.
  const modulos = tablas.map((m): ModuloMapa => {
    const todas = entidadesDe(m);
    const entidades = todas.length > MAX_POR_MODULO ? [...todas.slice(0, MAX_POR_MODULO - 1), { id: "otros", nombre: `Otros ${todas.length - MAX_POR_MODULO + 1}`, resumen: "Más elementos de este módulo", cantidad: todas.slice(MAX_POR_MODULO - 1).reduce((s, e) => s + e.cantidad, 0), unidad: todas[0]?.unidad ?? "", hijos: [] }] : todas;
    return { ...m, entidades, sql: m.tablas.some((t) => t.filas === null) ? unirSql(m.archivos) : undefined };
  });
  const archivos = new Set(modulos.filter((m) => m.sql).flatMap((m) => m.archivos));
  return { conectado: true, generadoEn: new Date().toISOString(), modulos, ...(archivos.size ? { sqlFaltante: unirSql(archivos) } : {}), editorSql: editorSql() };
}

/** Lo mínimo de los datos electorales para mostrarlos como una fuente más del gestor (dos consultas livianas). */
/** Filas y última actualización de los indicadores territoriales (DANE y datos abiertos). */
export async function resumenTerritorio(): Promise<{ filas: number | null; actualizado: string | null }> {
  const c = getSupabaseServerClient();
  if (!c) return { filas: null, actualizado: null };
  try {
    const { count, error } = await c.from("indicadores_territoriales").select("*", { count: "estimated", head: true });
    if (error) return { filas: null, actualizado: null };
    const { data } = await c.from("indicadores_territoriales").select("actualizado_en").order("actualizado_en", { ascending: false }).limit(1);
    return { filas: count ?? 0, actualizado: (data?.[0] as { actualizado_en?: string } | undefined)?.actualizado_en ?? null };
  } catch {
    return { filas: null, actualizado: null };
  }
}

export async function resumenElectoral(): Promise<{ filas: number | null }> {
  const c = getSupabaseServerClient();
  if (!c) return { filas: null };
  try {
    const { count, error } = await c.from("resultados_electorales").select("*", { count: "estimated", head: true });
    return { filas: error ? null : (count ?? 0) };
  } catch {
    return { filas: null };
  }
}
