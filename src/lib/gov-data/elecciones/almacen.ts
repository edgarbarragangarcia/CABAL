import "server-only";

import { after } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ELECCIONES, type EleccionInfo } from "./catalogo";
import { enLotes, esErrorTransitorio, sigueVigente, type FilaResultado } from "./almacen-puro";
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

/**
 * Por qué no se puede leer de Supabase ahora mismo (o `null` si se puede). Sirve para decir la verdad cuando algo no aparece:
 * no es lo mismo «todavía no está guardado» que «Supabase no respondió».
 */
export function motivoSinLectura(): string | null {
  if (!getSupabaseServerClient()) return "Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).";
  if (Date.now() < apagadoHasta) return "Supabase no respondió hace un momento; intenta de nuevo en unos segundos.";
  return null;
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

/**
 * Lo guardado de varios territorios de una vez (una sola consulta): código → resultado, o `null` si se guardó que la fuente no lo
 * publica. Los que no están guardados (o no se pudo consultar) simplemente no aparecen en el resultado.
 */
export async function leerGuardados(eleccion: EleccionInfo, corporacion: string, ambitos: string[], conMapa: boolean): Promise<Map<string, Resultado | null>> {
  const guardados = new Map<string, Resultado | null>();
  const c = clienteOpcional();
  if (!c || ambitos.length === 0) return guardados;
  try {
    const { data, error } = await c
      .from(TABLA)
      .select("ambito, vacio, con_mapa, datos, mesas_total, mesas_informadas, actualizado_en")
      .eq("eleccion", eleccion.id)
      .eq("corporacion", corporacion)
      .in("ambito", ambitos)
      .abortSignal(AbortSignal.timeout(10_000));
    if (error) {
      registrarFallo(error);
      return guardados;
    }
    for (const f of (data ?? []) as Fila[]) {
      if (!sigueVigente(eleccion, { mesas_total: f.mesas_total, mesas_informadas: f.mesas_informadas, actualizado_en: f.actualizado_en })) continue;
      if (f.vacio) guardados.set(f.ambito, null);
      else if (f.datos && !(conMapa && !f.con_mapa)) guardados.set(f.ambito, f.datos as Resultado);
    }
  } catch (e) {
    registrarFallo({ message: e instanceof Error ? e.message : String(e) });
  }
  return guardados;
}

// ---------------------------------------------------------- escritura ---

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Repite una operación contra Supabase cuando falla por algo pasajero (tiempo agotado, conexión cortada): la base de un plan
 * pequeño se pone lenta cuando se le piden muchas escrituras seguidas, y casi siempre el segundo intento pasa.
 */
async function conReintento<T>(operacion: () => Promise<T>, intentos = 3): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await operacion();
    } catch (e) {
      if (n >= intentos || !esErrorTransitorio(e)) throw e;
      await pausa(1_200 * n);
    }
  }
}

/** Sube un lote; si la base agota el tiempo, lo parte a la mitad y reintenta (un lote más chico siempre cabe). */
async function subirLote(c: NonNullable<ReturnType<typeof getSupabaseServerClient>>, lote: FilaResultado[], reemplazar: boolean, ahora: string, intento = 0): Promise<void> {
  let error: ErrorSb | null = null;
  try {
    const r = await c.from(TABLA).upsert(
      lote.map((f) => ({ ...f, actualizado_en: ahora })),
      { onConflict: CONFLICTO, ignoreDuplicates: !reemplazar }
    );
    error = r.error;
  } catch (e) {
    error = { message: e instanceof Error ? e.message : String(e) };
  }
  if (!error) return;
  if (esErrorTransitorio(error) && intento < 3) {
    await pausa(1_000 * (intento + 1));
    if (lote.length > 3) {
      const mitad = Math.ceil(lote.length / 2);
      await subirLote(c, lote.slice(0, mitad), reemplazar, ahora, intento + 1);
      await subirLote(c, lote.slice(mitad), reemplazar, ahora, intento + 1);
    } else {
      await subirLote(c, lote, reemplazar, ahora, intento + 1);
    }
    return;
  }
  throw errorDeTablas(error);
}

/** Sube las filas, en lotes. Con `reemplazar` pisa lo que hubiera; si no, deja intacto lo que ya está guardado. Lanza si Supabase falla. */
export async function guardarFilas(filas: FilaResultado[], reemplazar: boolean): Promise<void> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  // Que el catálogo (los nombres de cada elección y cargo, que usan las vistas) nunca quede vacío cuando ya hay resultados.
  void asegurarCatalogo();
  const ahora = new Date().toISOString();
  for (const lote of enLotes(filas)) await subirLote(c, lote, reemplazar, ahora);
}

function errorDeTablas(e: ErrorSb) {
  // El disco del plan Free (500 MB) se llenó: Supabase deja la base en solo lectura y toda escritura falla con este error.
  if (e.code === "25006" || /read-only transaction|read-only mode/i.test(e.message ?? "")) {
    return Object.assign(new Error("Supabase está en modo solo lectura porque el disco del plan se llenó (el plan Free tiene 500 MB). Libera espacio o pasa a Pro en Supabase › Settings › Manage disk; mientras tanto no se puede guardar nada."), { falta: false });
  }
  const falta = faltaTabla(e);
  return Object.assign(new Error(falta ? "Faltan las tablas de resultados: ejecuta supabase/elecciones.sql en Supabase." : (e.message || "Supabase no respondió (error temporal); se vuelve a intentar.")), { falta });
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

let catalogoAsegurado = false;

/**
 * Deja el catálogo escrito (una vez por instancia): no depende de que alguien haya lanzado una sincronización. Nunca lanza: es un
 * complemento de lo que se guarda, no puede estorbarlo.
 */
export async function asegurarCatalogo(): Promise<void> {
  if (catalogoAsegurado) return;
  try {
    await guardarCatalogo();
    catalogoAsegurado = true;
  } catch {
    /* sin tablas o sin conexión: ya lo dirán las demás consultas */
  }
}

// ------------------------------------------------ carga en segundo plano ---

const CARGA = "carga_electoral";
const ID_CARGA = "principal";

/** Lo que se va anotando de la carga en segundo plano (columna `estado` de `carga_electoral`). */
export type DetalleCarga = {
  nivelMax?: number;
  /** Solo un cargo: si faltan, se cargan todos. */
  eleccion?: string;
  corporacion?: string;
  iniciadaEn?: string;
  terminadaEn?: string;
  /** Cómo terminó: listo, detenida a pedido, en pausa (límite de la plataforma: se retoma) o por un problema (ver `mensaje`). */
  fin?: "listo" | "detenida" | "pausa" | "error";
  /** Número del último tramo empezado: un aviso repetido o atrasado (que trae un número ya usado) se descarta. */
  turno?: number;
  lotes?: number;
  guardados?: number;
  vacios?: number;
  errores?: number;
  /** Tramos seguidos en los que la fuente cortó las conexiones. */
  limitadasSeguidas?: number;
  /** Tramos seguidos sin guardar nada. */
  estancados?: number;
  /** Tramos seguidos en los que Supabase agotó el tiempo o cortó la conexión (se espera y se sigue sola). */
  transitorios?: number;
  actual?: string | null;
  mensaje?: string | null;
  pendientes?: number | null;
  total?: number | null;
};

export type FilaCarga = { activa: boolean; cadena: string | null; ultimoLoteEn: string | null; estado: DetalleCarga };

/** La fila de la carga en segundo plano. `tabla: false` = falta crear la tabla (ejecutar de nuevo supabase/elecciones.sql); `carga: null` = nunca se ha lanzado. */
export async function leerCarga(): Promise<{ tabla: boolean; carga: FilaCarga | null }> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const { data, error } = await c.from(CARGA).select("activa, cadena, ultimo_lote_en, estado").eq("id", ID_CARGA).maybeSingle();
  if (error) {
    if (faltaTabla(error)) return { tabla: false, carga: null };
    throw new Error(error.message);
  }
  if (!data) return { tabla: true, carga: null };
  const f = data as Fila;
  return { tabla: true, carga: { activa: !!f.activa, cadena: f.cadena ?? null, ultimoLoteEn: f.ultimo_lote_en ?? null, estado: (f.estado ?? {}) as DetalleCarga } };
}

let sinAvisoHasta = 0;

/** ¿Está instalado el aviso automático entre tramos (pg_net y la función `carga_siguiente`)? */
export async function avisoAutomaticoDisponible(): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c) return false;
  const { data, error } = await c.rpc("carga_aviso_disponible");
  return !error && data === true;
}

/**
 * Pide a Postgres (extensión pg_net, función `carga_siguiente` de supabase/elecciones.sql) que llame desde fuera a la aplicación para
 * el siguiente tramo. Esa llamada no viene de otra función de Vercel, así que no cuenta para el límite de cinco funciones
 * encadenadas (HTTP 508) y la carga puede seguir sola todo el tiempo que haga falta. `false` = no está instalada (o falló): se sigue
 * por el camino directo.
 */
export async function avisarPorBaseDeDatos(url: string, cadena: string, enfriar: boolean, turno: number): Promise<boolean> {
  if (Date.now() < sinAvisoHasta) return false;
  const c = getSupabaseServerClient();
  if (!c) return false;
  const { error } = await c.rpc("carga_siguiente", { p_url: url, p_cadena: cadena, p_enfriar: enfriar, p_turno: turno });
  if (!error) return true;
  sinAvisoHasta = Date.now() + 10 * 60_000;
  return false;
}

/** Empieza una carga nueva: reemplaza la fila (y con ella cualquier carga anterior, que al no ser ya la vigente se corta sola). */
export async function abrirCarga(cadena: string, estado: DetalleCarga): Promise<void> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const ahora = new Date().toISOString();
  const { error } = await c.from(CARGA).upsert({ id: ID_CARGA, activa: true, cadena, ultimo_lote_en: ahora, estado, actualizado_en: ahora }, { onConflict: "id" });
  if (error) throw errorDeTablas(error);
}

/**
 * Anota el avance de la carga `cadena` (y que sigue viva). No toca `activa`: solo se enciende al abrirla y se apaga al cerrarla o
 * detenerla, así un tramo que termina justo cuando alguien pulsa «Detener» no puede volver a encenderla. Devuelve `false` si esa
 * carga ya no es la vigente.
 */
export async function anotarCarga(cadena: string, estado: DetalleCarga): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const ahora = new Date().toISOString();
  const { data, error } = await c.from(CARGA).update({ ultimo_lote_en: ahora, estado, actualizado_en: ahora }).eq("id", ID_CARGA).eq("cadena", cadena).select("id");
  if (error) throw errorDeTablas(error);
  return (data ?? []).length > 0;
}

/** Cierra la carga `cadena` (o la vigente, si no se dice cuál): ya no sigue. */
export async function cerrarCarga(estado: DetalleCarga, cadena?: string): Promise<void> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const ahora = new Date().toISOString();
  let consulta = c.from(CARGA).update({ activa: false, estado, actualizado_en: ahora }).eq("id", ID_CARGA);
  if (cadena) consulta = consulta.eq("cadena", cadena);
  const { error } = await consulta;
  if (error) throw errorDeTablas(error);
}

export type CoberturaNivel = { eleccion: string; corporacion: string; nivel: number | null; guardados: number; vacios: number; ultima: string | null };

/** Cuenta filas sin traerlas ni recorrer la tabla: cada conteo se resuelve con el índice del cargo. Lanza si Supabase falla. */
async function contar(eleccion: string, corporacion: string, filtro: { nivel?: number; nivelMax?: number; vacio?: boolean }): Promise<number> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  let q = c.from(TABLA).select("ambito", { count: "exact", head: true }).eq("eleccion", eleccion).eq("corporacion", corporacion);
  if (filtro.nivel !== undefined) q = q.eq("nivel", filtro.nivel);
  if (filtro.nivelMax !== undefined) q = q.lte("nivel", filtro.nivelMax);
  if (filtro.vacio !== undefined) q = q.eq("vacio", filtro.vacio);
  return conReintento(async () => {
    const { count, error } = await q;
    if (error) throw errorDeTablas(error);
    return count ?? 0;
  });
}

/** Territorios ya guardados de un cargo hasta cierto nivel (con resultado o marcados como no publicados). */
export const guardadosHasta = (eleccion: string, corporacion: string, nivelMax: number) => contar(eleccion, corporacion, { nivelMax });

/** Territorios de un cargo guardados con resultado real. */
export const conResultado = (eleccion: string, corporacion: string) => contar(eleccion, corporacion, { vacio: false });

const NIVELES = [1, 2, 3, 4, 5, 6, 7];
let coberturaEnMemoria: { en: number; datos: Promise<CoberturaNivel[]> } | null = null;

/**
 * Cuántos territorios hay guardados por elección, cargo y nivel. Se arma con conteos pequeños, uno por cargo y nivel, que usan el
 * índice: agrupar la tabla entera de una vez (como hacía la función SQL `cobertura_electoral`) supera el límite de tiempo de
 * Supabase cuando ya hay cientos de miles de resultados, y eso detenía la carga. Veinte segundos en memoria.
 */
export function coberturaGuardada(): Promise<CoberturaNivel[]> {
  if (coberturaEnMemoria && Date.now() - coberturaEnMemoria.en < 20_000) return coberturaEnMemoria.datos;
  const pares = ELECCIONES.flatMap((e) => e.corporaciones.map((k) => ({ eleccion: e.id, corporacion: k.sigla })));
  const tareas = pares.flatMap((par) => NIVELES.map((nivel) => ({ ...par, nivel })));
  const datos = (async () => {
    const salida: CoberturaNivel[] = [];
    let i = 0;
    const obrero = async () => {
      while (i < tareas.length) {
        const t = tareas[i++];
        const total = await contar(t.eleccion, t.corporacion, { nivel: t.nivel });
        if (total === 0) continue;
        const vacios = await contar(t.eleccion, t.corporacion, { nivel: t.nivel, vacio: true });
        salida.push({ ...t, guardados: total - vacios, vacios, ultima: null });
      }
    };
    await Promise.all(Array.from({ length: 8 }, obrero));
    // La fecha de la última actualización de cada cargo, anotada en una de sus filas.
    await Promise.all(
      pares.map(async (par) => {
        const propias = salida.filter((s) => s.eleccion === par.eleccion && s.corporacion === par.corporacion);
        if (propias.length === 0) return;
        const c = getSupabaseServerClient()!;
        const { data } = await c.from(TABLA).select("actualizado_en").eq("eleccion", par.eleccion).eq("corporacion", par.corporacion).order("actualizado_en", { ascending: false }).limit(1);
        propias[0].ultima = ((data ?? []) as Fila[])[0]?.actualizado_en ?? null;
      })
    );
    return salida;
  })();
  coberturaEnMemoria = { en: Date.now(), datos };
  datos.catch(() => (coberturaEnMemoria = null));
  return datos;
}

/**
 * Borra las marcas de «la fuente no publica este territorio» (filas sin datos): al volver a cargar se piden de nuevo y solo quedan
 * así las que la fuente confirma. Es el arreglo para marcas puestas por un fallo pasajero. Devuelve cuántas quitó.
 */
export async function olvidarNoPublicados(): Promise<number> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const { data, error } = await c.from(TABLA).delete().eq("vacio", true).select("ambito");
  if (error) throw errorDeTablas(error);
  return (data ?? []).length;
}

/**
 * Códigos de territorio ya guardados (incluidos los que la fuente no publica) hasta cierto nivel. Se lee por páginas con
 * «desde el último código» y no con desplazamiento: con decenas de miles de filas, saltar filas en cada página se volvía lentísimo.
 */
export async function codigosGuardados(eleccion: string, corporacion: string, nivelMax: number): Promise<Set<string>> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const codigos = new Set<string>();
  const pagina = 1000;
  let ultimo = "";
  for (;;) {
    const filas = await conReintento(async () => {
      let consulta = c.from(TABLA).select("ambito").eq("eleccion", eleccion).eq("corporacion", corporacion).lte("nivel", nivelMax).order("ambito").limit(pagina);
      if (ultimo) consulta = consulta.gt("ambito", ultimo);
      const { data, error } = await consulta;
      if (error) throw errorDeTablas(error);
      return (data ?? []) as Fila[];
    });
    for (const f of filas) codigos.add(f.ambito);
    if (filas.length < pagina) return codigos;
    ultimo = filas[filas.length - 1].ambito;
  }
}

export type EstadoAlmacen = { configurada: boolean; tabla: boolean; error?: string };

/** ¿Está Supabase conectado y tiene las tablas y el catálogo? Se prueba cada pieza: un SQL a medias no cuenta. */
export async function estadoAlmacen(): Promise<EstadoAlmacen> {
  const c = getSupabaseServerClient();
  if (!c) return { configurada: false, tabla: false };
  // Con GET (no HEAD): una petición HEAD a una tabla inexistente no devuelve error y no deja distinguir los dos casos.
  for (const tabla of [TABLA, CATALOGO]) {
    // Supabase tarda unos segundos en reconocer una tabla tras un cambio (o cuando recarga su caché): se vuelve a preguntar un par
    // de veces antes de decir que faltan, para no mostrar «crea las tablas» cuando en realidad solo fue un tropiezo pasajero.
    let error: ErrorSb | null = null;
    for (let intento = 1; intento <= 3; intento++) {
      const r = await c.from(tabla).select("eleccion").limit(1);
      error = r.error;
      if (!error) break;
      if (intento < 3) await pausa(1_500);
    }
    if (error) return faltaTabla(error) ? { configurada: true, tabla: false } : { configurada: true, tabla: false, error: error.message || "Supabase no respondió (error temporal). Vuelve a intentar en un momento." };
  }
  return { configurada: true, tabla: true };
}
