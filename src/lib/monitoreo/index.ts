import "server-only";

import { noticias, videos, visitasWikipedia, type Noticia, type Video } from "@/lib/informe/fuentes";
import { enVivo, type EnVivo } from "./en-vivo";

/**
 * Monitoreo con datos reales y públicos (sin claves): directo de YouTube, noticias
 * de Google Noticias, videos del canal oficial y visitas a Wikipedia. X, Facebook e
 * Instagram NO están: no se pueden leer sin las credenciales de la cuenta.
 */

export type Monitoreo = {
  generadoEn: string;
  enVivo: EnVivo | null;
  /** Noticias por día de los últimos 30 días (fecha YYYY-MM-DD en hora de Colombia). */
  mencionesPorDia: { fecha: string; noticias: number }[];
  noticias30d: number;
  noticiasPrevias30d: number | null;
  /** Las más recientes, para listar. */
  ultimasNoticias: Noticia[];
  /** Medios que más publicaron en 30 días. */
  medios: { medio: string; noticias: number }[];
  videos: Video[];
  wikipedia: { ultimos: number; previos: number } | null;
  /** Fuentes que no respondieron. */
  errores: string[];
};

const DIA = 86_400_000;
const fechaCO = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

/** Google Noticias devuelve ~100 por consulta: se pide semana a semana. */
async function noticiasDe(dias: number, hasta: Date): Promise<Noticia[]> {
  const tramos = Math.ceil(dias / 7);
  const bloques = await Promise.all(
    Array.from({ length: tramos }, (_, i) => {
      const fin = new Date(hasta.getTime() - i * 7 * DIA);
      const ini = new Date(fin.getTime() - 7 * DIA);
      return noticias(ini, i === 0 ? new Date(hasta.getTime() + DIA) : fin);
    })
  );
  const vistas = new Set<string>();
  return bloques
    .flat()
    .filter((n) => (vistas.has(n.enlace) ? false : (vistas.add(n.enlace), true)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function agruparPorDia(lista: Noticia[], dias: number, hoy: Date): { fecha: string; noticias: number }[] {
  const cuenta = new Map<string, number>();
  for (const n of lista) cuenta.set(fechaCO(n.fecha), (cuenta.get(fechaCO(n.fecha)) ?? 0) + 1);
  return Array.from({ length: dias }, (_, i) => {
    const fecha = fechaCO(new Date(hoy.getTime() - (dias - 1 - i) * DIA));
    return { fecha, noticias: cuenta.get(fecha) ?? 0 };
  });
}

export function topMedios(lista: Noticia[], n = 6) {
  const m = new Map<string, number>();
  for (const x of lista) m.set(x.medio, (m.get(x.medio) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([medio, noticias]) => ({ medio, noticias }));
}

let cache: { en: number; datos: Monitoreo } | null = null;
const VIGENCIA_MS = 2 * 60 * 1000;

export async function monitoreo(hoy = new Date(), { forzar = false } = {}): Promise<Monitoreo> {
  // Dos minutos en memoria: el directo cambia rápido, pero no hace falta consultar a Google en cada clic.
  if (!forzar && cache && Date.now() - cache.en < VIGENCIA_MS) return cache.datos;
  const errores: string[] = [];
  const [vivo, n30, n60, vids, wiki] = await Promise.allSettled([
    enVivo(),
    noticiasDe(30, hoy),
    noticiasDe(30, new Date(hoy.getTime() - 30 * DIA)),
    videos(),
    visitasWikipedia(hoy),
  ]);
  const valor = <T,>(r: PromiseSettledResult<T>, fuente: string): T | null => {
    if (r.status === "fulfilled") return r.value;
    errores.push(`${fuente}: ${r.reason instanceof Error ? r.reason.message : "no respondió"}`);
    return null;
  };
  const lista = valor(n30, "Noticias") ?? [];
  const datos: Monitoreo = {
    generadoEn: hoy.toISOString(),
    enVivo: valor(vivo, "YouTube en vivo"),
    mencionesPorDia: agruparPorDia(lista, 30, hoy),
    noticias30d: lista.length,
    noticiasPrevias30d: valor(n60, "Noticias previas")?.length ?? null,
    ultimasNoticias: lista.slice(0, 12),
    medios: topMedios(lista),
    videos: valor(vids, "YouTube") ?? [],
    wikipedia: valor(wiki, "Wikipedia"),
    errores,
  };
  cache = { en: Date.now(), datos };
  return datos;
}

export type { EnVivo } from "./en-vivo";
