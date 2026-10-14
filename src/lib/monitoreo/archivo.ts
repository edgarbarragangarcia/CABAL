import "server-only";

import { SQL_POR_ARCHIVO } from "@/lib/gestor/sql";
import { fichasDeVideos, type FichaVideo } from "./ficha-video";
import { actualizarDatos, archivoDisponible, leerItems, type ItemMonitoreo, type TonoGuardado } from "./historial";
import { clasificarTonos } from "./tono-ia";
import { tonoDeTexto } from "./tono";

/**
 * El archivo de menciones en Supabase: cada mención de María Fernanda de los últimos 31 días con sus cifras (vistas, me gusta, canal y
 * suscriptores donde la fuente los da) y su tono medido por la IA. Se completa por pasos —fichas de los videos, tono— y cada paso
 * guarda lo suyo: lo ya analizado no se vuelve a analizar, que es lo que cuesta.
 */
const PERSONAJE = "mafe";
const DIAS = 31;
const FRESCURA_FICHA_MS = 20 * 3_600_000;

const desde = () => new Date(Date.now() - DIAS * 86_400_000).toISOString();
const idYouTube = (enlace: string) => enlace.match(/[?&]v=([\w-]{6,15})/)?.[1];
type FichaGuardada = FichaVideo & { leidaEn?: string };
const fichaDe = (i: ItemMonitoreo) => (i.datos as { ficha?: FichaGuardada } | null | undefined)?.ficha;
const plataformaDe = (i: ItemMonitoreo) => (i.medio ?? "web").split("|")[0] || "web";

export type ResumenPlataformaArchivo = {
  plataforma: string;
  total: number;
  vistas: number;
  likes: number;
  cuentas: number;
  /** El canal con más suscriptores (solo YouTube: las demás redes no los entregan). */
  seguidoresMax: number | null;
  positivo: number;
  neutral: number;
  negativo: number;
  conFicha: number;
  conTonoIa: number;
};

export type EstadoArchivo = {
  /** Supabase responde y tiene las columnas del archivo (falta ejecutar monitoreo.sql si no). */
  disponible: boolean;
  desde: string;
  total: number;
  ultimaActualizacion: string | null;
  porPlataforma: ResumenPlataformaArchivo[];
  /** Cuántas fichas de video faltan o están viejas y cuántas menciones no tienen tono medido por la IA. */
  pendientes: { fichas: number; tono: number };
  /** Si faltan las columnas del archivo: el SQL que las crea (se puede ejecutar más de una vez). */
  sql?: string;
};

export async function estadoArchivo(): Promise<EstadoArchivo> {
  const disponible = await archivoDisponible();
  const vacio: EstadoArchivo = { disponible, desde: desde(), total: 0, ultimaActualizacion: null, porPlataforma: [], pendientes: { fichas: 0, tono: 0 }, ...(disponible ? {} : { sql: SQL_POR_ARCHIVO.monitoreo }) };
  const items = await leerItems(desde(), { personaje: PERSONAJE, limite: 6000 });
  if (!items) return vacio;
  const web = items.filter((i) => i.tipo === "web");
  const ahora = Date.now();
  const por = new Map<string, ResumenPlataformaArchivo & { _cuentas: Set<string> }>();
  let fichasPend = 0;
  let tonoPend = 0;
  let ultima: string | null = null;
  for (const i of web) {
    const p = plataformaDe(i);
    const r = por.get(p) ?? { plataforma: p, total: 0, vistas: 0, likes: 0, cuentas: 0, seguidoresMax: null, positivo: 0, neutral: 0, negativo: 0, conFicha: 0, conTonoIa: 0, _cuentas: new Set<string>() };
    r.total++;
    const ficha = fichaDe(i);
    r.vistas += ficha?.vistas ?? i.vistas ?? 0;
    r.likes += ficha?.likes ?? 0;
    r._cuentas.add((i.medio ?? "").split("|")[1] ?? "");
    if (ficha?.suscriptores) r.seguidoresMax = Math.max(r.seguidoresMax ?? 0, ficha.suscriptores);
    if (ficha) r.conFicha++;
    const tono: TonoGuardado = i.tono_ia && i.tono ? i.tono : tonoDeTexto(i.titulo).tono;
    r[tono]++;
    if (i.tono_ia) r.conTonoIa++;
    else tonoPend++;
    if (p === "youtube" && idYouTube(i.enlace) && (!ficha || ahora - Date.parse(ficha.leidaEn ?? "") > FRESCURA_FICHA_MS)) fichasPend++;
    if (i.actualizado_en && (!ultima || i.actualizado_en > ultima)) ultima = i.actualizado_en;
    por.set(p, r);
  }
  const porPlataforma = [...por.values()].map(({ _cuentas, ...r }) => ({ ...r, cuentas: _cuentas.size })).sort((a, b) => b.total - a.total);
  return { ...vacio, total: web.length, ultimaActualizacion: ultima, porPlataforma, pendientes: { fichas: fichasPend, tono: tonoPend } };
}

/** Lee la ficha de hasta `max` videos (los sin ficha o con ficha de más de 20 horas) y la guarda junto a la mención. */
export async function enriquecerFichas(max = 12): Promise<{ hechos: number; pendientes: number }> {
  const items = (await leerItems(desde(), { personaje: PERSONAJE, limite: 6000 })) ?? [];
  const ahora = Date.now();
  const pend = items.filter((i) => i.tipo === "web" && plataformaDe(i) === "youtube" && idYouTube(i.enlace)).filter((i) => {
    const f = fichaDe(i);
    return !f || ahora - Date.parse(f.leidaEn ?? "") > FRESCURA_FICHA_MS;
  });
  const lote = pend.slice(0, max);
  const fichas = await fichasDeVideos(lote.map((i) => idYouTube(i.enlace)!));
  const filas = lote.flatMap((i) => {
    const f = fichas[idYouTube(i.enlace)!];
    if (!f) return [];
    return [{ personaje: i.personaje, tipo: i.tipo, enlace: i.enlace, titulo: i.titulo, fecha: i.fecha, vistas: f.vistas, datos: { ...(i.datos ?? {}), ficha: { ...f, leidaEn: new Date().toISOString() } } }];
  });
  const ok = await actualizarDatos(filas);
  return { hechos: ok ? filas.length : 0, pendientes: Math.max(0, pend.length - (ok ? filas.length : 0)) };
}

/** Mide con la IA el tono de hasta `max` menciones sin medir y lo guarda (una sola vez por mención). */
export async function medirTonos(max = 50): Promise<{ hechos: number; pendientes: number }> {
  const items = (await leerItems(desde(), { personaje: PERSONAJE, limite: 6000 })) ?? [];
  const pend = items.filter((i) => i.tipo === "web" && !i.tono_ia);
  const lote = pend.slice(0, max);
  if (lote.length === 0) return { hechos: 0, pendientes: 0 };
  const tonos = await clasificarTonos(lote.map((i) => i.titulo));
  const filas = lote.flatMap((i, k) => (tonos[k] ? [{ personaje: i.personaje, tipo: i.tipo, enlace: i.enlace, titulo: i.titulo, fecha: i.fecha, tono: tonos[k] as TonoGuardado, tono_ia: true }] : []));
  const ok = await actualizarDatos(filas);
  return { hechos: ok ? filas.length : 0, pendientes: Math.max(0, pend.length - (ok ? filas.length : 0)) };
}
