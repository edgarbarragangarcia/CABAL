import "server-only";

import { createPurposeToken } from "@/lib/admin-auth";
import { abrirCarga, anotarCarga, asegurarCatalogo, avisarPorBaseDeDatos, avisoAutomaticoDisponible, cerrarCarga, leerCarga, type DetalleCarga, type FilaCarga } from "./almacen";
import { esErrorTransitorio } from "./almacen-puro";
import { sincronizarLote } from "./sincronizar";

/**
 * Carga de los resultados en Supabase en segundo plano, sin tener abierta la pantalla Análisis > Datos.
 *
 * Una función de Vercel dura como mucho un minuto, así que la carga va por tramos: cada tramo guarda lo que alcanza (como un lote
 * de la sincronización) y, al terminar, llama al siguiente (`/api/carga-electoral`). La fila `carga_electoral` dice cuál es la
 * carga vigente (`cadena`): quien no es la vigente se corta sola, y «Detener» o iniciar otra la cambia. Lo ya guardado se salta,
 * así que una carga interrumpida (un corte, la fuente limitando el ritmo) se retoma donde iba con «Continuar».
 *
 * Solo corre bien en producción: ahí la Registraduría responde y la función puede llamarse a sí misma.
 */

export const PROPOSITO_CARGA = "carga-electoral";
export const RUTA_TRAMO = "/api/carga-electoral";

/** Tiempo para pedir territorios en cada tramo: lo que sobra de los 60 s de Vercel alcanza para preparar, subir lo último y llamar al siguiente. */
const PRESUPUESTO_TRAMO_MS = Math.max(1_000, Number(process.env.CARGA_ELECTORAL_PRESUPUESTO_MS) || 32_000);
/** Cuánto esperar antes de volver a intentarlo cuando la fuente corta las conexiones. */
const ENFRIAR_MS = Math.max(0, Number(process.env.CARGA_ELECTORAL_ENFRIAR_MS) || 45_000);
/** Cuánto esperar a que el aviso de Postgres arranque el tramo siguiente antes de seguir por el camino directo. */
const ESPERA_AVISO_MS = Math.max(300, Number(process.env.CARGA_ELECTORAL_ESPERA_AVISO_MS) || 9_000);
const MAX_LIMITADAS = 5;
const MAX_ESTANCADOS = 3;
/**
 * Tramos seguidos que pueden fallar por algo pasajero de Supabase (tiempo agotado, conexión cortada) antes de darse por vencida:
 * en cada uno se espera la pausa de enfriamiento, así que son unos 15 minutos de reintentos sin que nadie pulse nada.
 */
const MAX_TRANSITORIOS = 20;
const MENSAJE_TRANSITORIO = "Supabase tardó demasiado en responder (límite de tiempo de la base). Se espera un momento y la carga sigue sola.";
const MAX_TRAMOS = 3_000;
/** Un tramo dura menos de un minuto: si pasa bastante más sin noticias, la cadena se cortó. */
const VIVA_MS = 150_000;
/** Tope de una función de Vercel (`maxDuration`), con margen. */
const LIMITE_FUNCION_MS = 55_000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ahora = () => new Date().toISOString();

/**
 * Vercel corta con HTTP 508 (bucle infinito) las cadenas de funciones que se llaman unas a otras más de cinco veces seguidas: así
 * sale cada ~5 tramos. No es un fallo: la carga hace una pausa y se retoma con «Continuar» (o sola, si la pantalla Datos está abierta).
 */
class LimiteDeCadena extends Error {}
const MENSAJE_PAUSA = "Vercel no deja encadenar más de cinco tramos seguidos, así que la carga hizo una pausa. Se retoma sola si dejas abierta la pantalla Datos; si no, pulsa «Continuar la carga».";

const estaViva = (c: FilaCarga) => c.activa && !!c.ultimoLoteEn && Date.now() - Date.parse(c.ultimoLoteEn) < VIVA_MS;

export type VistaCarga = DetalleCarga & { activa: boolean; enMarcha: boolean; ultimoLoteEn: string | null };
export type EstadoCarga = {
  /** `false`: falta crear la tabla `carga_electoral` (ejecutar de nuevo supabase/elecciones.sql). */
  disponible: boolean;
  /** El aviso automático entre tramos (pg_net) está instalado: la carga sigue sola sin el límite de cinco tramos de Vercel. */
  aviso: boolean;
  carga: VistaCarga | null;
};

export async function estadoDeCarga(): Promise<EstadoCarga> {
  const { tabla, carga } = await leerCarga();
  if (!tabla) return { disponible: false, aviso: false, carga: null };
  const aviso = await avisoAutomaticoDisponible().catch(() => false);
  if (!carga) return { disponible: true, aviso, carga: null };
  return { disponible: true, aviso, carga: { ...carga.estado, activa: carga.activa, enMarcha: estaViva(carga), ultimoLoteEn: carga.ultimoLoteEn } };
}

export type ResultadoInicio = { ok: true; cadena: string } | { ok: false; motivo: "sin-tabla" | "en-marcha" };

/** Abre una carga nueva; quien llama debe lanzar el primer tramo (`ejecutarTramo`). Si ya hay una viva, no abre otra. */
export async function iniciarCarga(p: { nivelMax: number; eleccion?: string; corporacion?: string }): Promise<ResultadoInicio> {
  const { tabla, carga } = await leerCarga();
  if (!tabla) return { ok: false, motivo: "sin-tabla" };
  if (carga && estaViva(carga)) return { ok: false, motivo: "en-marcha" };
  await asegurarCatalogo();
  const cadena = crypto.randomUUID();
  // Si se retoma una carga que solo hizo una pausa (el límite de cinco tramos de Vercel) con el mismo alcance, el conteo sigue
  // acumulándose: así la velocidad y el tiempo que falta no se reinician cada cinco tramos.
  const previo = carga?.estado;
  const sigue =
    !!previo &&
    previo.fin === "pausa" &&
    previo.nivelMax === p.nivelMax &&
    previo.eleccion === p.eleccion &&
    previo.corporacion === p.corporacion &&
    Date.now() - Date.parse(previo.terminadaEn ?? "") < 10 * 60_000;
  await abrirCarga(cadena, {
    nivelMax: p.nivelMax,
    ...(p.eleccion ? { eleccion: p.eleccion } : {}),
    ...(p.corporacion ? { corporacion: p.corporacion } : {}),
    iniciadaEn: sigue ? (previo.iniciadaEn ?? ahora()) : ahora(),
    lotes: sigue ? (previo.lotes ?? 0) : 0,
    guardados: sigue ? (previo.guardados ?? 0) : 0,
    vacios: sigue ? (previo.vacios ?? 0) : 0,
    errores: sigue ? (previo.errores ?? 0) : 0,
    limitadasSeguidas: 0,
    estancados: 0,
    actual: sigue ? (previo.actual ?? null) : null,
    mensaje: null,
  });
  return { ok: true, cadena };
}

const MENSAJE_DETENIDA = "Detenida a pedido. Lo guardado hasta ahora queda en Supabase.";

export async function detenerCarga(): Promise<void> {
  const { tabla, carga } = await leerCarga();
  if (!tabla || !carga || !carga.activa) return;
  await cerrarCarga({ ...carga.estado, fin: "detenida", terminadaEn: ahora(), mensaje: MENSAJE_DETENIDA });
}

/** ¿Sigue siendo `cadena` la carga vigente (no la detuvieron ni empezó otra)? */
async function esVigente(cadena: string): Promise<boolean> {
  const { carga } = await leerCarga();
  return !!carga && carga.activa && carga.cadena === cadena;
}

/**
 * Un tramo de la carga: guarda lo que alcance en el tiempo y llama al siguiente. Nunca lanza (corre en segundo plano, después de
 * responder): cualquier problema queda anotado en la fila para que el panel lo muestre. Con `enfriar` no pide nada: espera a que
 * la fuente deje de limitar las consultas y sigue.
 */
export async function ejecutarTramo(cadena: string, origen: string, enfriar = false, turno?: number): Promise<void> {
  const inicio = Date.now();
  let detalle: DetalleCarga = {};
  try {
    const { tabla, carga } = await leerCarga();
    if (!tabla || !carga || !carga.activa || carga.cadena !== cadena) return;
    detalle = carga.estado;
    // Un aviso repetido o atrasado (por ejemplo el de Postgres que llega después de que ya se siguió por el camino directo) trae
    // un turno que ya se usó: se descarta, para que nunca corran dos tramos a la vez y se duplique el ritmo de peticiones.
    if (turno !== undefined && turno <= (detalle.turno ?? 0)) return;
    detalle = { ...detalle, turno: turno ?? (detalle.turno ?? 0) + 1 };
    await anotarCarga(cadena, detalle); // «sigo viva» y turno tomado

    if (enfriar) {
      await esperar(ENFRIAR_MS);
      return await seguir(cadena, origen, detalle, false, inicio);
    }

    const lote = await sincronizarLote({ eleccion: detalle.eleccion, corporacion: detalle.corporacion, nivelMax: detalle.nivelMax ?? 3, presupuestoMs: PRESUPUESTO_TRAMO_MS });
    const transitorio = !!lote.errorBase && esErrorTransitorio(lote.errorBase);
    detalle = {
      ...detalle,
      lotes: (detalle.lotes ?? 0) + 1,
      guardados: (detalle.guardados ?? 0) + lote.guardados,
      vacios: (detalle.vacios ?? 0) + lote.vacios,
      errores: (detalle.errores ?? 0) + lote.errores,
      actual: lote.actual ?? detalle.actual ?? null,
      pendientes: lote.pendientes,
      total: lote.total,
      limitadasSeguidas: lote.limitada ? (detalle.limitadasSeguidas ?? 0) + 1 : 0,
      estancados: !lote.limitada && !lote.terminado && !transitorio && lote.guardados + lote.vacios === 0 ? (detalle.estancados ?? 0) + 1 : 0,
      transitorios: transitorio ? (detalle.transitorios ?? 0) + 1 : 0,
      mensaje: transitorio ? MENSAJE_TRANSITORIO : (lote.mensaje ?? null),
    };

    // Un fallo pasajero de la base no detiene la carga: se anota, se espera la pausa de enfriamiento y el tramo siguiente sigue.
    if (transitorio && (detalle.transitorios ?? 0) <= MAX_TRANSITORIOS) {
      await anotarCarga(cadena, detalle);
      return await seguir(cadena, origen, detalle, true, inicio);
    }

    const cierre = motivoDeCierre(detalle, lote);
    if (cierre) {
      await cerrarCarga({ ...detalle, ...cierre, terminadaEn: ahora() }, cadena);
      return;
    }
    await anotarCarga(cadena, detalle);
    await seguir(cadena, origen, detalle, lote.limitada, inicio);
  } catch (err) {
    console.error("[carga electoral]", err);
    const mensaje = err instanceof Error ? err.message : "Error inesperado en la carga.";
    // Un fallo pasajero de la base (tiempo agotado, conexión cortada) no debe detener la carga: se espera y se sigue.
    if (esErrorTransitorio(err) && Object.keys(detalle).length > 0 && (detalle.transitorios ?? 0) < MAX_TRANSITORIOS) {
      try {
        const d: DetalleCarga = { ...detalle, transitorios: (detalle.transitorios ?? 0) + 1, mensaje: MENSAJE_TRANSITORIO };
        await anotarCarga(cadena, d);
        return await seguir(cadena, origen, d, true, inicio);
      } catch {
        /* ni siquiera se pudo anotar: se cierra como error, abajo */
      }
    }
    await cerrarCarga({ ...detalle, fin: "error", terminadaEn: ahora(), mensaje: `${mensaje} Lo guardado queda; pulsa «Continuar» para seguir.` }, cadena).catch(() => {});
  }
}

function motivoDeCierre(d: DetalleCarga, lote: Awaited<ReturnType<typeof sincronizarLote>>): Pick<DetalleCarga, "fin" | "mensaje"> | null {
  if (lote.terminado) return { fin: "listo", mensaje: "Listo: todo lo pedido quedó guardado en Supabase." };
  if (lote.errorBase) {
    const pista = esErrorTransitorio(lote.errorBase) ? " Supabase sigue agotando el tiempo: ejecuta el SQL «Para que no se detenga» de esta pantalla (crea índices que aceleran los conteos) y pulsa «Continuar»." : "";
    return { fin: "error", mensaje: `${lote.errorBase}${pista}` };
  }
  if ((d.limitadasSeguidas ?? 0) >= MAX_LIMITADAS) {
    return { fin: "error", mensaje: `${lote.mensaje ?? "La fuente está limitando las consultas."} Se esperó varios minutos sin que cediera; lo guardado queda. Pulsa «Continuar» más tarde.` };
  }
  if ((d.estancados ?? 0) >= MAX_ESTANCADOS) {
    const partes = [`En varios tramos seguidos no se pudo guardar nada (${lote.errores} errores en el último).`, lote.mensaje, "Lo guardado queda; vuelve a intentarlo más tarde."];
    return { fin: "error", mensaje: partes.filter(Boolean).join(" ") };
  }
  if ((d.lotes ?? 0) >= MAX_TRAMOS) return { fin: "error", mensaje: "Se alcanzó el máximo de tramos de una sola carga. Pulsa «Continuar» para seguir." };
  return null;
}

/** Si la carga sigue vigente, llama al tramo siguiente; si no (la detuvieron), lo anota. */
async function seguir(cadena: string, origen: string, detalle: DetalleCarga, enfriar: boolean, inicio: number): Promise<void> {
  if (!(await esVigente(cadena))) {
    await anotarCarga(cadena, { ...detalle, fin: "detenida", terminadaEn: ahora(), mensaje: MENSAJE_DETENIDA }).catch(() => {});
    return;
  }
  try {
    await llamarTramo(origen, cadena, enfriar, inicio + LIMITE_FUNCION_MS, (detalle.turno ?? 0) + 1);
  } catch (err) {
    if (err instanceof LimiteDeCadena) {
      await cerrarCarga({ ...detalle, fin: "pausa", terminadaEn: ahora(), mensaje: MENSAJE_PAUSA }, cadena);
      return;
    }
    const motivo = err instanceof Error ? err.message : "sin respuesta";
    await cerrarCarga({ ...detalle, fin: "error", terminadaEn: ahora(), mensaje: `La carga no pudo seguir sola (${motivo}). Lo guardado queda; pulsa «Continuar».` }, cadena);
  }
}

/**
 * Pide el tramo siguiente. Primero por Postgres (pg_net), que llama desde fuera y no cuenta para el límite de cinco funciones
 * encadenadas de Vercel; se comprueba que el siguiente tramo arrancó y, si no, o si pg_net no está instalado, se llama directo al
 * propio servidor (que responde enseguida con 202 y trabaja en segundo plano).
 */
async function llamarTramo(origen: string, cadena: string, enfriar: boolean, limite: number, turno: number): Promise<void> {
  if (await avisarPorBaseDeDatos(`${origen}${RUTA_TRAMO}`, cadena, enfriar, turno)) {
    // El aviso de Postgres tarda uno o dos segundos en salir; se espera a ver que el tramo siguiente tomó su turno.
    const paso = Math.min(1_500, ESPERA_AVISO_MS / 3);
    for (let espera = 0; limite - Date.now() > 3_500 && espera < ESPERA_AVISO_MS; espera += paso) {
      await esperar(paso);
      const { carga } = await leerCarga();
      if (!carga || !carga.activa || carga.cadena !== cadena) return; // la detuvieron
      if ((carga.estado.turno ?? 0) >= turno) return;
    }
    // No llegó a tiempo: se sigue por el camino directo (si el aviso llega después, su turno ya estará usado y se descarta).
  }
  const ficha = await createPurposeToken(PROPOSITO_CARGA, 300);
  let ultimo: unknown = new Error("sin respuesta");
  for (let intento = 1; intento <= 3; intento++) {
    const margen = limite - Date.now();
    if (margen < 1_500) break;
    try {
      const r = await fetch(`${origen}${RUTA_TRAMO}`, {
        method: "POST",
        // El Origin hace falta: las rutas de /api que escriben (src/proxy.ts) solo aceptan peticiones del propio sitio.
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ficha}`, Origin: origen },
        body: JSON.stringify({ cadena, enfriar, turno }),
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(15_000, margen)),
      });
      // 409: ya no es la carga vigente (la detuvieron o empezó otra): no hay nada que seguir.
      if (r.ok || r.status === 409) return;
      if (r.status === 508) {
        ultimo = new LimiteDeCadena("HTTP 508");
        break;
      }
      ultimo = new Error(`HTTP ${r.status}`);
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      ultimo = e;
    }
    await esperar(2_000 * intento);
  }
  throw ultimo;
}
