import "server-only";

import { after } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ELECCIONES, type EleccionInfo } from "./catalogo";
import { enLotes, sigueVigente, type FilaResultado } from "./almacen-puro";
import type { Resultado } from "./resultados";

/**
 * Copia en Supabase de los resultados electorales (tablas `resultados_electorales` y `catalogo_electoral`, ver
 * supabase/elecciones.sql). La aplicación lee de aquí primero; lo que falta se pide a la fuente (Registraduría o datos.gov.co)
 * y se guarda. Solo servidor, con la service role key.
 *
 * Lo que se lee o se guarda "de paso" nunca debe romper una consulta: si Supabase no está conectado, no tiene las tablas o no
 * responde, la lectura devuelve `undefined` y todo sigue como antes, con la fuente en vivo.
 */

export type { FilaResultado, Territorio } from "./almacen-puro";

const TABLA = "resultados_electorales";
const CATALOGO = "catalogo_electoral";
const CONFLICTO = "eleccion,corporacion,ambito";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;
type ErrorSb = { code?: string; message?: string; /** Ya se sabe que faltan las tablas (el error viene de `errorDeTablas`). */ falta?: boolean };

const faltaTabla = (e: ErrorSb) => e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202" || /schema cache|does not exist/i.test(e.message ?? "");

// -------------------------------------------------------- interruptor ---

/**
 * Tras un fallo, las lecturas y escrituras "de paso" se saltan Supabase un rato (un minuto si faltan las tablas) para no
 * añadir una espera por consulta mientras no responda. La sincronización y el panel no lo usan: siempre lo intentan.
 */
let apagadoHasta = 0;
let avisado = false;

function clienteOpcional() {
  return Date.now() < apagadoHasta ? null : getSupabaseServerClient();
}

function registrarFallo(e: ErrorSb) {
  const falta = e.falta ?? faltaTabla(e);
  apagadoHasta = Date.now() + (falta ? 60_000 : 15_000);
  if (falta) {
    if (!avisado) console.warn("[elecciones] Faltan las tablas de resultados: ejecuta supabase/elecciones.sql en Supabase.");
    avisado = true;
  } else {
    console.error("[elecciones] Supabase:", e.message ?? e);
  }
}

/** Vuelve a intentar Supabase ya (p. ej. cuando la persona dice que acaba de crear las tablas). */
export function reiniciarInterruptor() {
  apagadoHasta = 0;
  avisado = false;
}

// ------------------------------------------------------------ lectura ---

/**
 * El resultado guardado de un territorio. `undefined`: no está (o no se pudo consultar) y hay que pedirlo a la fuente;
 * `null`: se guardó que la fuente no publica ese territorio.
 */
export async function leerGuardado(eleccion: EleccionInfo, corporacion: string, ambito: string, conMapa: boolean): Promise<Resultado | null | undefined> {
  const c = clienteOpcional();
  if (!c) return undefined;
  try {
    const { data, error } = await c
      .from(TABLA)
      .select("vacio, con_mapa, datos, mesas_total, mesas_informadas, actualizado_en")
      .eq("eleccion", eleccion.id)
      .eq("corporacion", corporacion)
      .eq("ambito", ambito)
      .abortSignal(AbortSignal.timeout(8_000))
      .maybeSingle();
    if (error) return void registrarFallo(error);
    if (!data) return undefined;
    const f = data as Fila;
    if (!sigueVigente(eleccion, { mesas_total: f.mesas_total, mesas_informadas: f.mesas_informadas, actualizado_en: f.actualizado_en })) return undefined;
    if (f.vacio) return null;
    // Una fila sin el mapa de ganadores (Congreso 2018 consultado solo por sus totales) no sirve para la vista del territorio.
    if (conMapa && !f.con_mapa) return undefined;
    return (f.datos as Resultado | null) ?? undefined;
  } catch (e) {
    registrarFallo({ message: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}

// ---------------------------------------------------------- escritura ---

/** Sube las filas, en lotes. Con `reemplazar` pisa lo que hubiera; si no, deja intacto lo que ya está guardado. Lanza si Supabase falla. */
export async function guardarFilas(filas: FilaResultado[], reemplazar: boolean): Promise<void> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const ahora = new Date().toISOString();
  for (const lote of enLotes(filas)) {
    const { error } = await c.from(TABLA).upsert(
      lote.map((f) => ({ ...f, actualizado_en: ahora })),
      { onConflict: CONFLICTO, ignoreDuplicates: !reemplazar }
    );
    if (error) throw errorDeTablas(error);
  }
}

function errorDeTablas(e: ErrorSb) {
  const falta = faltaTabla(e);
  return Object.assign(new Error(falta ? "Faltan las tablas de resultados: ejecuta supabase/elecciones.sql en Supabase." : (e.message ?? "No se pudo guardar en Supabase.")), { falta });
}

const pendientes = new Map<string, FilaResultado>();
let vaciado: Promise<void> | null = null;

/**
 * Guarda de paso un resultado recién pedido a la fuente, sin hacer esperar la respuesta: varias filas seguidas (un puesto, sus
 * mesas...) se juntan y suben en un solo envío. Si el territorio ya estaba guardado sin el mapa de ganadores se completa; si
 * no, lo ya guardado se respeta.
 */
export function guardarEnSegundoPlano(fila: FilaResultado) {
  if (!clienteOpcional()) return;
  const clave = `${fila.eleccion}|${fila.corporacion}|${fila.ambito}`;
  const previa = pendientes.get(clave);
  if (!previa || fila.con_mapa || !previa.con_mapa) pendientes.set(clave, fila);
  vaciado ??= new Promise<void>((resolver) => {
    setTimeout(() => {
      const lote = [...pendientes.values()];
      pendientes.clear();
      vaciado = null;
      Promise.all([
        guardarFilas(lote.filter((f) => f.con_mapa), true),
        guardarFilas(lote.filter((f) => !f.con_mapa), false),
      ])
        .catch((e: Error & { falta?: boolean }) => registrarFallo({ message: e.message, falta: e.falta }))
        .finally(resolver);
    }, 600);
  });
  // En Vercel la función puede cerrarse al responder: `after` la mantiene viva hasta que termine de guardar.
  try {
    after(vaciado);
  } catch {
    /* fuera de una petición (un script): el temporizador basta */
  }
}

// -------------------------------------------------- catálogo y estado ---

export async function guardarCatalogo(): Promise<void> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const filas = ELECCIONES.flatMap((e) =>
    e.corporaciones.map((k) => ({
      eleccion: e.id,
      corporacion: k.sigla,
      eleccion_nombre: e.nombre,
      corporacion_nombre: k.nombre,
      fecha: e.fecha,
      tipo: k.tipo,
      nivel_eleccion: k.nivelEleccion,
      fuente: e.fuente === "socrata" ? "datos.gov.co" : `Registraduría (${e.host})`,
    }))
  );
  const { error } = await c.from(CATALOGO).upsert(filas, { onConflict: "eleccion,corporacion" });
  if (error) throw errorDeTablas(error);
}

export type CoberturaNivel = { eleccion: string; corporacion: string; nivel: number | null; guardados: number; vacios: number; ultima: string | null };

/** Cuántos territorios hay guardados por elección, cargo y nivel. */
export async function coberturaGuardada(): Promise<CoberturaNivel[]> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const { data, error } = await c.rpc("cobertura_electoral");
  if (error) throw errorDeTablas(error);
  return ((data ?? []) as Fila[]).map((f) => ({ eleccion: f.eleccion, corporacion: f.corporacion, nivel: f.nivel ?? null, guardados: Number(f.guardados) || 0, vacios: Number(f.vacios) || 0, ultima: f.ultima ?? null }));
}

/** Códigos de territorio ya guardados (incluidos los que la fuente no publica) hasta cierto nivel. */
export async function codigosGuardados(eleccion: string, corporacion: string, nivelMax: number): Promise<Set<string>> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const codigos = new Set<string>();
  const pagina = 1000;
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await c
      .from(TABLA)
      .select("ambito")
      .eq("eleccion", eleccion)
      .eq("corporacion", corporacion)
      .lte("nivel", nivelMax)
      .order("ambito")
      .range(desde, desde + pagina - 1);
    if (error) throw errorDeTablas(error);
    for (const f of (data ?? []) as Fila[]) codigos.add(f.ambito);
    if ((data ?? []).length < pagina) return codigos;
  }
}

export type EstadoAlmacen = { configurada: boolean; tabla: boolean; error?: string };

/** ¿Está Supabase conectado y tiene las tablas, el catálogo y la función de cobertura? Se prueba cada pieza: un SQL a medias no cuenta. */
export async function estadoAlmacen(): Promise<EstadoAlmacen> {
  const c = getSupabaseServerClient();
  if (!c) return { configurada: false, tabla: false };
  // Con GET (no HEAD): una petición HEAD a una tabla inexistente no devuelve error y no deja distinguir los dos casos.
  for (const tabla of [TABLA, CATALOGO]) {
    const { error } = await c.from(tabla).select("eleccion").limit(1);
    if (error) return faltaTabla(error) ? { configurada: true, tabla: false } : { configurada: true, tabla: false, error: error.message };
  }
  const { error } = await c.rpc("cobertura_electoral");
  if (error) return faltaTabla(error) ? { configurada: true, tabla: false } : { configurada: true, tabla: false, error: error.message };
  return { configurada: true, tabla: true };
}
