import "server-only";

import { entidades } from "@/lib/informe/fuentes";
import { guardarItems, leerItems, type ItemMonitoreo } from "./historial";
import { nombraAMariaFernanda } from "./menciones";

/**
 * Dónde nombran a María Fernanda Cabal, sin claves de pago: Google Noticias (y con él, lo público de Facebook, Instagram, TikTok, X,
 * YouTube, Reddit o LinkedIn que Google indexa), Bing Noticias y la búsqueda pública de YouTube (todos los canales).
 *
 * Límites que se dicen en pantalla: solo aparece lo público que un buscador indexa; los grupos privados, las historias, los
 * comentarios y lo que no está indexado no se ven (ni Meta ni TikTok dan acceso sin ser una institución de investigación o pagar
 * una herramienta de escucha).
 */

export type PlataformaId = "prensa" | "facebook" | "instagram" | "tiktok" | "x" | "youtube" | "reddit" | "threads" | "linkedin" | "telegram" | "web";
export type MencionWeb = { plataforma: PlataformaId; fuente: string; titulo: string; fecha: string; enlace: string; extracto: string | null };
export type ResumenPlataforma = { id: PlataformaId; nombre: string; total: number; consultada: boolean };
export type RespuestaMenciones = { generadoEn: string; guardado: boolean; plataformas: ResumenPlataforma[]; menciones: MencionWeb[] };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
export const PLATAFORMAS: { id: PlataformaId; nombre: string; sitio?: string }[] = [
  { id: "prensa", nombre: "Prensa y medios" },
  { id: "facebook", nombre: "Facebook", sitio: "facebook.com" },
  { id: "instagram", nombre: "Instagram", sitio: "instagram.com" },
  { id: "tiktok", nombre: "TikTok", sitio: "tiktok.com" },
  { id: "x", nombre: "X", sitio: "x.com" },
  { id: "youtube", nombre: "YouTube", sitio: "youtube.com" },
  { id: "threads", nombre: "Threads", sitio: "threads.net" },
  { id: "reddit", nombre: "Reddit", sitio: "reddit.com" },
  { id: "linkedin", nombre: "LinkedIn", sitio: "linkedin.com" },
  { id: "telegram", nombre: "Telegram", sitio: "t.me" },
];

const NOMBRE = '("María Fernanda Cabal" OR "MaFe Cabal" OR "@MariaFdaCabal")';
const etiqueta = (b: string, n: string) => b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`))?.[1] ?? "";
/** Texto plano: sin etiquetas y con las entidades (también las numéricas, a veces codificadas dos veces) ya convertidas. */
const entidadesNumericas = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
const texto = (s: string) => entidadesNumericas(entidades(entidadesNumericas(entidades(s)))).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** «hace 11 m», «hace 2 sem.», «Transmitido hace 3 días»… → fecha aproximada (null si no se entiende). */
function fechaDeYouTube(t: string, ahora: Date): string | null {
  const m = t.toLowerCase().match(/hace\s+(\d+)\s*([a-zñáéíóú]+)/);
  if (!m) return null;
  const u = m[2];
  const ms =
    /^(s|seg)/.test(u) ? 1_000
    : /^(m|min)/.test(u) && !/^mes/.test(u) ? 60_000
    : /^h/.test(u) ? 3_600_000
    : /^d/.test(u) ? 86_400_000
    : /^sem/.test(u) ? 7 * 86_400_000
    : /^mes/.test(u) ? 30 * 86_400_000
    : /^a/.test(u) ? 365 * 86_400_000
    : 0;
  return ms ? new Date(ahora.getTime() - Number(m[1]) * ms).toISOString() : null;
}

async function pedir(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { ...init, headers: { "User-Agent": UA, "Accept-Language": "es-CO,es;q=0.9", ...init?.headers }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} respondió ${res.status}`);
  return res.text();
}

/** Google Noticias para una consulta; `plataforma` rotula lo que vuelva. */
async function googleNoticias(q: string, plataforma: PlataformaId, limite: number): Promise<MencionWeb[]> {
  const xml = await pedir(`https://news.google.com/rss/search?${new URLSearchParams({ q, hl: "es-419", gl: "CO", ceid: "CO:es-419" })}`);
  const vistos = new Set<string>();
  const lista: MencionWeb[] = [];
  for (const it of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    if (lista.length >= limite) break;
    const fuente = texto(etiqueta(it, "source")) || "Sin nombre";
    let titulo = texto(etiqueta(it, "title"));
    if (fuente && titulo.endsWith(` - ${fuente}`)) titulo = titulo.slice(0, -(fuente.length + 3));
    const fecha = etiqueta(it, "pubDate");
    const clave = titulo.toLowerCase().replace(/\W+/g, " ").slice(0, 120);
    if (!titulo || !fecha || vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push({ plataforma, fuente, titulo, fecha: new Date(fecha).toISOString(), enlace: texto(etiqueta(it, "link")), extracto: null });
  }
  return lista;
}

async function bingNoticias(): Promise<MencionWeb[]> {
  const xml = await pedir(`https://www.bing.com/news/search?${new URLSearchParams({ q: '"María Fernanda Cabal"', format: "rss", setlang: "es" })}`);
  const lista: MencionWeb[] = [];
  for (const it of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const titulo = texto(etiqueta(it, "title"));
    const fecha = etiqueta(it, "pubDate");
    const enlace = texto(etiqueta(it, "link"));
    if (!titulo || !fecha || !enlace) continue;
    lista.push({ plataforma: "prensa", fuente: texto(etiqueta(it, "News:Source")) || "Bing Noticias", titulo, fecha: new Date(fecha).toISOString(), enlace, extracto: texto(etiqueta(it, "description")).slice(0, 220) || null });
  }
  return lista;
}

type Nodo = Record<string, unknown>;
const nodo = (x: unknown): Nodo => (x && typeof x === "object" ? (x as Nodo) : {});

/** La búsqueda pública de YouTube, por fecha: videos de cualquier canal que la nombran. */
async function youtubeBusqueda(): Promise<MencionWeb[]> {
  const html = await pedir(`https://www.youtube.com/results?${new URLSearchParams({ search_query: '"María Fernanda Cabal"', sp: "CAI%3D" })}`);
  const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (!m) return [];
  let datos: unknown;
  try {
    datos = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const ahora = new Date();
  const lista: MencionWeb[] = [];
  const ver = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(ver);
    if (!x || typeof x !== "object") return;
    const v = nodo((x as Nodo).videoRenderer);
    if (typeof v.videoId === "string") {
      const titulo = String(nodo((v.title as { runs?: unknown[] } | undefined)?.runs?.[0]).text ?? "");
      const canal = String(nodo((v.ownerText as { runs?: unknown[] } | undefined)?.runs?.[0]).text ?? "");
      const cuando = String(nodo(v.publishedTimeText).simpleText ?? "");
      const vistas = String(nodo(v.viewCountText).simpleText ?? "");
      const fecha = fechaDeYouTube(cuando, ahora) ?? ahora.toISOString();
      if (titulo) lista.push({ plataforma: "youtube", fuente: canal || "YouTube", titulo, fecha, enlace: `https://www.youtube.com/watch?v=${v.videoId}`, extracto: vistas || null });
    }
    Object.values(x as Nodo).forEach(ver);
  };
  ver(datos);
  return lista;
}

let memoria: { en: number; datos: RespuestaMenciones } | null = null;
const TTL = 15 * 60_000;
const PERSONAJE = "mafe";

async function conLimite<T>(tareas: (() => Promise<T>)[], limite: number): Promise<PromiseSettledResult<T>[]> {
  const salida: PromiseSettledResult<T>[] = new Array(tareas.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, tareas.length) }, async () => {
      while (i < tareas.length) {
        const k = i++;
        try {
          salida[k] = { status: "fulfilled", value: await tareas[k]() };
        } catch (reason) {
          salida[k] = { status: "rejected", reason };
        }
      }
    })
  );
  return salida;
}

export async function mencionesWeb(forzar = false): Promise<RespuestaMenciones> {
  if (!forzar && memoria && Date.now() - memoria.en < TTL) return memoria.datos;

  const trabajos: { plataforma: PlataformaId; ejecutar: () => Promise<MencionWeb[]> }[] = [
    { plataforma: "prensa", ejecutar: () => googleNoticias(`${NOMBRE} when:14d`, "prensa", 60) },
    { plataforma: "prensa", ejecutar: bingNoticias },
    // En las redes, Google a veces devuelve publicaciones que la nombran solo en el texto completo o en una respuesta: se dejan las que
    // la nombran en lo que se ve (así cada fila es una mención que se puede leer y comprobar).
    ...PLATAFORMAS.filter((p) => p.sitio).map((p) => ({
      plataforma: p.id,
      ejecutar: async () => (await googleNoticias(`${NOMBRE} site:${p.sitio} when:30d`, p.id, 100)).filter((m) => nombraAMariaFernanda(m.titulo)).slice(0, 60),
    })),
    { plataforma: "youtube", ejecutar: youtubeBusqueda },
  ];
  const resultados = await conLimite(trabajos.map((t) => t.ejecutar), 4);

  const consultada = new Set<PlataformaId>();
  const nuevas: MencionWeb[] = [];
  resultados.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    consultada.add(trabajos[i].plataforma);
    nuevas.push(...r.value);
  });

  // Se guarda en Supabase: así el panel acumula lo que va apareciendo aunque la fuente deje de mostrarlo.
  const guardado = await guardarItems(
    nuevas.map((m): ItemMonitoreo => ({ personaje: PERSONAJE, tipo: "web", enlace: m.enlace, titulo: m.titulo, medio: `${m.plataforma}|${m.fuente}`, fecha: m.fecha, vistas: null, nombra: true, donde: m.plataforma, contexto: m.extracto }))
  );
  let todas = nuevas;
  if (guardado) {
    const previas = await leerItems(new Date(Date.now() - 30 * 86_400_000).toISOString());
    if (previas) {
      todas = previas
        .filter((p) => p.personaje === PERSONAJE && p.tipo === "web")
        .map((p): MencionWeb => {
          const [plataforma, ...resto] = (p.medio ?? "web|").split("|");
          return { plataforma: (plataforma as PlataformaId) || "web", fuente: resto.join("|") || "Web", titulo: p.titulo, fecha: p.fecha, enlace: p.enlace, extracto: p.contexto };
        });
    }
  }
  // Sin repetir (mismo enlace o mismo titular en la misma plataforma) y lo más reciente primero.
  const vistos = new Set<string>();
  const menciones = todas
    .filter((m) => {
      const k = `${m.plataforma}|${m.enlace}`;
      const t = `${m.plataforma}|${m.titulo.toLowerCase().replace(/\W+/g, " ").slice(0, 100)}`;
      if (vistos.has(k) || vistos.has(t)) return false;
      vistos.add(k);
      vistos.add(t);
      return true;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 400);

  const plataformas = PLATAFORMAS.map((p) => ({ id: p.id, nombre: p.nombre, total: menciones.filter((m) => m.plataforma === p.id).length, consultada: consultada.has(p.id) }));
  const respuesta = { generadoEn: new Date().toISOString(), guardado, plataformas, menciones };
  memoria = { en: Date.now(), datos: respuesta };
  return respuesta;
}
