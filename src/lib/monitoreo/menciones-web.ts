import "server-only";

import { entidades } from "@/lib/informe/fuentes";
import { guardarItems, leerItems, type ItemMonitoreo } from "./historial";
import { nombraAMariaFernanda } from "./menciones";
import { CIUDADES_BARRIDO, lugarDelTexto, lugarPredominante } from "./lugares";
import { tonoDeTexto, type Tono } from "./tono";
import { claveRed } from "@/lib/ia-config";
import { MEDIOS_REGIONALES, medioPorDominio, medioPorFb, medioPorInicio, type MedioRegional } from "./medios-regionales";

/**
 * Dónde nombran a María Fernanda Cabal, sin claves de pago: Google Noticias (y con él, lo público de Facebook, Instagram, TikTok, X,
 * YouTube, Reddit o LinkedIn que Google indexa), Bing Noticias y la búsqueda pública de YouTube (todos los canales).
 *
 * Límites que se dicen en pantalla: solo aparece lo público que un buscador indexa; los grupos privados, las historias, los
 * comentarios y lo que no está indexado no se ven (ni Meta ni TikTok dan acceso sin ser una institución de investigación o pagar
 * una herramienta de escucha).
 */

export type PlataformaId = "prensa" | "facebook" | "instagram" | "tiktok" | "x" | "youtube" | "reddit" | "threads" | "linkedin" | "telegram" | "web";
/** Dónde se ubica una mención: el portal que la publica (y su ciudad) y el lugar que nombra el titular. */
export type GeoMencion = {
  /** `estimado`: el medio no está en el directorio y su ciudad se dedujo de lo que dice su página de inicio. */
  medio?: { id: string; nombre: string; ciudad: string; dane: string; departamento: string; lat: number; lon: number; estimado?: boolean };
  texto?: { nivel: "municipio" | "departamento"; dane: string; nombre: string; departamento: string; lat: number; lon: number };
};
/** Cifras públicas de una publicación (solo las que la fuente entrega: YouTube y X; Facebook, Instagram y TikTok no las dan sin su API). */
export type Metricas = { vistas?: number; likes?: number; comentarios?: number };
export type ComentarioMuestra = { texto: string; autor: string; likes: number; fecha: string; tono: Tono };
export type MencionWeb = { plataforma: PlataformaId; fuente: string; titulo: string; fecha: string; enlace: string; extracto: string | null; dominio?: string; geo?: GeoMencion; /** El nombre de María Fernanda está en el titular (si no, la nombra el texto de la nota). */ enTitular?: boolean; /** Estimado por palabras; el panel lo reemplaza si el usuario mide el tono con IA. */ tono?: Tono; metricas?: Metricas; comentariosMuestra?: ComentarioMuestra[]; /** Prensa nacional o internacional: no se ubica en una ciudad. */ nacional?: boolean };
export type ResumenPlataforma = { id: PlataformaId; nombre: string; total: number; consultada: boolean };

export type RespuestaMenciones = { generadoEn: string; guardado: boolean; plataformas: ResumenPlataforma[]; menciones: MencionWeb[]; /** Hay clave de YouTube: las menciones de YouTube traen vistas, likes y comentarios. */ youtubeConClave?: boolean; /** Qué portales y páginas de Facebook del directorio respondieron esta vez (para no leer un fallo como «sin menciones»). */ consultados: { portales: string[]; paginas: string[] } };

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
    const url = it.match(/<source url="([^"]+)"/)?.[1];
    let dominio: string | undefined;
    try {
      dominio = url ? new URL(url).hostname.replace(/^www\./, "") : undefined;
    } catch {
      dominio = undefined;
    }
    let titulo = texto(etiqueta(it, "title"));
    if (fuente && titulo.endsWith(` - ${fuente}`)) titulo = titulo.slice(0, -(fuente.length + 3));
    const fecha = etiqueta(it, "pubDate");
    const clave = titulo.toLowerCase().replace(/\W+/g, " ").slice(0, 120);
    if (!titulo || !fecha || vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push({ plataforma, fuente, titulo, fecha: new Date(fecha).toISOString(), enlace: texto(etiqueta(it, "link")), extracto: null, dominio });
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
/** Pasado este tiempo ya no se lanzan más consultas: lo que falte queda como «no consultado» y no como «sin menciones». */
const PRESUPUESTO_MS = 48_000;
const GRUPO = 5;

type Tarea = { plataforma: PlataformaId; ejecutar: () => Promise<MencionWeb[]>; /** Portales o páginas que cubre esta consulta. */ cubre?: { portales?: string[]; paginas?: string[] } };

async function conLimite<T>(tareas: (() => Promise<T>)[], limite: number, hasta: number): Promise<(PromiseSettledResult<T> | undefined)[]> {
  const salida: (PromiseSettledResult<T> | undefined)[] = new Array(tareas.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, tareas.length) }, async () => {
      while (i < tareas.length) {
        const k = i++;
        if (Date.now() > hasta) return; // se acabó el tiempo: las que faltan quedan sin resultado (undefined)
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

/**
 * Las consultas a los portales y a las páginas de Facebook regionales (directorio en medios-regionales.ts):
 *  - los portales se buscan de a cinco con `site:` (Google Noticias dice de qué dominio es cada noticia);
 *  - cada página de Facebook se busca sola con `site:facebook.com/<página>`, así se sabe de qué portal, y de qué ciudad, es cada publicación.
 */
function tareasRegionales(): Tarea[] {
  const tareas: Tarea[] = [];
  const web = MEDIOS_REGIONALES.filter((m) => m.web);
  for (let i = 0; i < web.length; i += GRUPO) {
    const grupo = web.slice(i, i + GRUPO);
    tareas.push({
      plataforma: "prensa",
      cubre: { portales: grupo.map((m) => m.id) },
      ejecutar: async () => (await googleNoticias(`${NOMBRE} (${grupo.map((m) => `site:${m.dominio}`).join(" OR ")}) when:30d`, "prensa", 100)).filter((m) => !!m.dominio && !!medioPorDominio(m.dominio)),
    });
  }
  for (const m of MEDIOS_REGIONALES.filter((x) => x.fb && x.fbIndexado)) {
    tareas.push({
      plataforma: "facebook",
      cubre: { paginas: [m.id] },
      ejecutar: async () =>
        (await googleNoticias(`${NOMBRE} site:facebook.com/${m.fb} when:30d`, "facebook", 60))
          .filter((x) => nombraAMariaFernanda(x.titulo))
          .map((x) => ({ ...x, fuente: m.nombre, dominio: `facebook.com/${m.fb}` })),
    });
  }
  return tareas;
}

const claveDe = (t: string) => t.toLowerCase().replace(/\W+/g, " ").slice(0, 100);

/** Prensa nacional e internacional y sitios de plataformas: no se ubican en una ciudad (su sede no dice de dónde es la nota). */
const NACIONALES = new Set(
  ("eltiempo.com elespectador.com semana.com infobae.com noticiascaracol.com caracol.com.co noticiasrcn.com rcnradio.com lafm.com.co wradio.com.co bluradio.com pulzo.com kienyke.com las2orillas.co cambiocolombia.com lasillavacia.com larepublica.co portafolio.co ntn24.com cnnespanol.cnn.com cnn.com bbc.com dw.com france24.com rfi.fr europapress.es elpais.com elmundo.es abc.es lavanguardia.com elconfidencial.com okdiario.com libertaddigital.com eldiario.es 20minutos.es yahoo.com es-us.noticias.yahoo.com msn.com rtvcnoticias.com radionacional.co canalrcn.com publimetro.co colombia.com elnuevosiglo.com.co valoraanalitik.com forbes.co asuntoslegales.com.co agronegocios.co enter.co soho.co colombiacheck.com razonpublica.com elnacional.com elnuevodia.com nytimes.com washingtonpost.com reuters.com efe.com youtube.com facebook.com instagram.com tiktok.com x.com twitter.com t.co linkedin.com reddit.com threads.net t.me news.google.com").split(" ")
);
const esNacional = (d: string) => NACIONALES.has(d) || d.endsWith(".gov.co") || d.endsWith(".mil.co") || d.endsWith(".edu.co");

type MedioAuto = { id: string; nombre: string; ciudad: string; dane: string; departamento: string; lat: number; lon: number };
/** Medios que no están en el directorio y cuya ciudad se dedujo de su página de inicio (null: se intentó y no se pudo). */
const autoMedios = new Map<string, MedioAuto | null>();

async function ubicarDominio(dominio: string, nombre: string): Promise<void> {
  if (autoMedios.has(dominio)) return;
  autoMedios.set(dominio, null);
  try {
    const res = await fetch(`https://${dominio}`, { headers: { "User-Agent": UA, "Accept-Language": "es-CO,es;q=0.9" }, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return;
    const html = (await res.text()).slice(0, 400_000);
    const lugar = lugarPredominante(texto(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")));
    if (lugar?.nivel === "municipio") autoMedios.set(dominio, { id: `auto-${dominio}`, nombre, ciudad: lugar.nombre.replace(/, D\.C\./, ""), dane: lugar.dane, departamento: lugar.departamento, lat: lugar.lat, lon: lugar.lon });
  } catch {
    /* se queda sin ubicar */
  }
}

/** Deduce la ciudad de los medios que aparecen y no están en el directorio ni son nacionales (hasta `max` por consulta). */
async function resolverDesconocidos(lista: MencionWeb[], max = 24): Promise<void> {
  const pendientes = new Map<string, string>();
  for (const m of lista) {
    const d = m.dominio;
    if (!d || d.startsWith("facebook.com") || esNacional(d) || medioPorDominio(d) || autoMedios.has(d) || pendientes.has(d)) continue;
    pendientes.set(d, m.fuente);
    if (pendientes.size >= max) break;
  }
  const cola = [...pendientes];
  await Promise.all(Array.from({ length: 6 }, async () => { while (cola.length) { const [d, n] = cola.shift()!; await ubicarDominio(d, n); } }));
}

/** «12.345 visualizaciones», «1,2 M de visualizaciones», «3,4 mil vistas» → número. */
export function vistasDeTexto(t: string | null): number | undefined {
  const m = t?.toLowerCase().match(/([\d.,]+)\s*(mil millones|millones|millón|mil|m|k)?\s*(?:de\s+)?(?:visualizaciones|vistas|views)/);
  if (!m) return undefined;
  const num = Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(num)) return undefined;
  const f = m[2] === "mil millones" ? 1e9 : m[2] === "millones" || m[2] === "millón" || m[2] === "m" ? 1e6 : m[2] === "mil" || m[2] === "k" ? 1e3 : 1;
  return Math.round(num * f);
}

/** Pone a una mención su ubicación (el portal que la publica y el lugar que nombra el titular), su tono y sus cifras. */
function ubicar(m: MencionWeb): MencionWeb {
  let portal: MedioRegional | null = null;
  const d = m.dominio ?? "";
  if (d.startsWith("facebook.com/")) portal = medioPorFb(d.slice("facebook.com/".length));
  else if (d && d !== "facebook.com") portal = medioPorDominio(d);
  // Las publicaciones de Facebook que llegan por la búsqueda general empiezan, muchas veces, por el nombre de la página.
  if (!portal && m.plataforma === "facebook") portal = medioPorInicio(m.titulo);
  const lugar = lugarDelTexto(`${m.titulo} ${m.extracto ?? ""}`);
  const geo: GeoMencion = {};
  if (portal) geo.medio = { id: portal.id, nombre: portal.nombre, ciudad: portal.ciudad, dane: portal.dane, departamento: portal.departamento, lat: portal.lat, lon: portal.lon };
  else if (d && autoMedios.get(d)) geo.medio = { ...autoMedios.get(d)!, estimado: true };
  if (lugar) geo.texto = lugar;
  const vistas = m.plataforma === "youtube" ? vistasDeTexto(m.extracto) : undefined;
  return {
    ...m,
    ...(geo.medio || geo.texto ? { geo } : {}),
    enTitular: nombraAMariaFernanda(m.titulo),
    tono: tonoDeTexto(m.titulo).tono,
    ...(vistas !== undefined ? { metricas: { vistas } } : {}),
    ...(d && esNacional(d) && !portal ? { nacional: true } : {}),
  };
}

/* ---- Cifras y comentarios de YouTube (con la clave de YouTube de Configuración; sin ella, solo las vistas de la búsqueda pública) ---- */
type DatosVideo = { metricas: Metricas; comentarios: ComentarioMuestra[] };
const videos = new Map<string, { en: number; datos: DatosVideo }>();
const VIGENCIA_VIDEO_MS = 6 * 3_600_000;
const idDeVideo = (enlace: string) => enlace.match(/[?&]v=([\w-]{6,})/)?.[1];

async function enriquecerYouTube(lista: MencionWeb[]): Promise<boolean> {
  const clave = await claveRed("youtube").catch(() => undefined);
  if (!clave) return false;
  const api = async <T,>(ruta: string, q: Record<string, string>): Promise<T> => {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${ruta}?${new URLSearchParams({ ...q, key: clave })}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`YouTube respondió ${r.status}`);
    return (await r.json()) as T;
  };
  const ahora = Date.now();
  const ids = [...new Set(lista.filter((m) => m.plataforma === "youtube").map((m) => idDeVideo(m.enlace)).filter((x): x is string => !!x))].filter((id) => !videos.has(id) || ahora - videos.get(id)!.en > VIGENCIA_VIDEO_MS).slice(0, 150);
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const r = await api<{ items?: { id: string; statistics?: Record<string, string> }[] }>("videos", { part: "statistics", id: ids.slice(i, i + 50).join(",") });
      for (const v of r.items ?? []) {
        const n = (x?: string) => (x === undefined ? undefined : Number(x));
        videos.set(v.id, { en: ahora, datos: { metricas: { vistas: n(v.statistics?.viewCount), likes: n(v.statistics?.likeCount), comentarios: n(v.statistics?.commentCount) }, comentarios: [] } });
      }
    } catch {
      /* sin cifras de ese tramo */
    }
  }
  // Comentarios de los videos con más conversación: lo que dice la gente, no solo el titular.
  const conComentarios = [...videos].filter(([, v]) => (v.datos.metricas.comentarios ?? 0) > 0 && v.datos.comentarios.length === 0 && ahora - v.en <= VIGENCIA_VIDEO_MS).sort((a, b) => (b[1].datos.metricas.comentarios ?? 0) - (a[1].datos.metricas.comentarios ?? 0)).slice(0, 8);
  await Promise.all(
    conComentarios.map(async ([id, v]) => {
      try {
        const r = await api<{ items?: { snippet: { topLevelComment: { snippet: { textDisplay: string; authorDisplayName: string; likeCount: number; publishedAt: string } } } }[] }>("commentThreads", { part: "snippet", videoId: id, order: "relevance", maxResults: "10", textFormat: "plainText" });
        v.datos.comentarios = (r.items ?? []).map((it) => {
          const c = it.snippet.topLevelComment.snippet;
          return { texto: c.textDisplay.slice(0, 280), autor: c.authorDisplayName, likes: Number(c.likeCount) || 0, fecha: c.publishedAt, tono: tonoDeTexto(c.textDisplay).tono };
        });
      } catch {
        /* los comentarios pueden estar desactivados */
      }
    })
  );
  return true;
}

function aplicarYouTube(m: MencionWeb): MencionWeb {
  const id = m.plataforma === "youtube" ? idDeVideo(m.enlace) : undefined;
  const v = id ? videos.get(id)?.datos : undefined;
  return v ? { ...m, metricas: { ...m.metricas, ...Object.fromEntries(Object.entries(v.metricas).filter(([, x]) => x !== undefined)) }, ...(v.comentarios.length ? { comentariosMuestra: v.comentarios } : {}) } : m;
}

/** Lo que dejó la búsqueda a fondo (se suma a cada consulta mientras el servidor siga encendido; además se guarda en Supabase). */
const extras = new Map<string, MencionWeb>();

export async function mencionesWeb(forzar = false): Promise<RespuestaMenciones> {
  if (!forzar && memoria && Date.now() - memoria.en < TTL) return memoria.datos;
  const hasta = Date.now() + PRESUPUESTO_MS;

  const generales: Tarea[] = [
    { plataforma: "prensa", ejecutar: () => googleNoticias(`${NOMBRE} when:14d`, "prensa", 60) },
    { plataforma: "prensa", ejecutar: bingNoticias },
    // En las redes, Google a veces devuelve publicaciones que la nombran solo en el texto completo o en una respuesta: se dejan las que
    // la nombran en lo que se ve (así cada fila es una mención que se puede leer y comprobar).
    ...PLATAFORMAS.filter((p) => p.sitio).map((p) => ({
      plataforma: p.id,
      ejecutar: async () => (await googleNoticias(`${NOMBRE} site:${p.sitio} when:30d`, p.id, 100)).filter((m) => nombraAMariaFernanda(m.titulo)).slice(0, 60),
    })),
    { plataforma: "youtube" as PlataformaId, ejecutar: youtubeBusqueda },
  ];
  const regionales = tareasRegionales();
  const trabajos = [...generales, ...regionales];
  const resultados = await conLimite(trabajos.map((t) => t.ejecutar), 5, hasta);

  const consultada = new Set<PlataformaId>();
  const consultados = { portales: new Set<string>(), paginas: new Set<string>() };
  const nuevas: MencionWeb[] = [];
  resultados.forEach((r, i) => {
    if (r?.status !== "fulfilled") return;
    const t = trabajos[i];
    consultada.add(t.plataforma);
    t.cubre?.portales?.forEach((id) => consultados.portales.add(id));
    t.cubre?.paginas?.forEach((id) => consultados.paginas.add(id));
    nuevas.push(...r.value);
  });

  // Se guarda en Supabase: así el panel acumula lo que va apareciendo aunque la fuente deje de mostrarlo.
  // `medio` guarda «plataforma|fuente|dominio»: con el dominio (o la página de Facebook) se vuelve a ubicar al leer el historial.
  const guardado = await guardarItems(
    nuevas.map((m): ItemMonitoreo => ({ personaje: PERSONAJE, tipo: "web", enlace: m.enlace, titulo: m.titulo, medio: `${m.plataforma}|${m.fuente}|${m.dominio ?? ""}`, fecha: m.fecha, vistas: null, nombra: true, donde: m.plataforma, contexto: m.extracto }))
  );
  let todas = [...nuevas];
  if (guardado) {
    const previas = await leerItems(new Date(Date.now() - 30 * 86_400_000).toISOString());
    if (previas) {
      todas = previas
        .filter((p) => p.personaje === PERSONAJE && p.tipo === "web")
        .map((p): MencionWeb => {
          const [plataforma, fuente, dominio] = (p.medio ?? "web||").split("|");
          return { plataforma: (plataforma as PlataformaId) || "web", fuente: fuente || "Web", titulo: p.titulo, fecha: p.fecha, enlace: p.enlace, extracto: p.contexto, dominio: dominio || undefined };
        });
    }
  }
  for (const e of extras.values()) todas.push(e);
  await resolverDesconocidos(todas);
  // Se ubica cada mención; al quitar repetidas (mismo enlace o mismo titular en la misma plataforma) gana la que tiene ubicación del portal.
  const ubicadas = todas.map(ubicar).sort((a, b) => Number(!!b.geo?.medio) - Number(!!a.geo?.medio) || b.fecha.localeCompare(a.fecha));
  const vistos = new Set<string>();
  const menciones = ubicadas
    .filter((m) => {
      const k = `${m.plataforma}|${m.enlace}`;
      const t = `${m.plataforma}|${claveDe(m.titulo)}`;
      if (vistos.has(k) || vistos.has(t)) return false;
      vistos.add(k);
      vistos.add(t);
      return true;
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 800);

  const youtubeConClave = await enriquecerYouTube(menciones).catch(() => false);
  const enriquecidas = menciones.map(aplicarYouTube);
  const plataformas = PLATAFORMAS.map((p) => ({ id: p.id, nombre: p.nombre, total: menciones.filter((m) => m.plataforma === p.id).length, consultada: consultada.has(p.id) }));
  const respuesta = { generadoEn: new Date().toISOString(), guardado, plataformas, menciones: enriquecidas, youtubeConClave, consultados: { portales: [...consultados.portales], paginas: [...consultados.paginas] } };
  memoria = { en: Date.now(), datos: respuesta };
  return respuesta;
}

/* ------------------------------------------------------------------ Búsqueda a fondo ---- */

/** Ciudades por tanda: cada una son dos consultas (prensa y Facebook) y una función de 60 s las despacha con holgura. */
const CIUDADES_POR_TANDA = 28;
export const TANDAS_BARRIDO = Math.ceil(CIUDADES_BARRIDO.length / CIUDADES_POR_TANDA);

/**
 * Recorre las ciudades principales del país buscando «María Fernanda Cabal» + la ciudad en prensa y en Facebook: así salen los medios
 * y las páginas que no están en el directorio (el micrositio, la emisora más pequeña). Se llama por tandas desde el panel.
 */
export async function barridoCiudades(tanda: number): Promise<{ menciones: MencionWeb[]; tanda: number; tandas: number; ciudades: string[]; total: number }> {
  const ciudades = CIUDADES_BARRIDO.slice(tanda * CIUDADES_POR_TANDA, (tanda + 1) * CIUDADES_POR_TANDA);
  const hasta = Date.now() + PRESUPUESTO_MS;
  const tareas = ciudades.flatMap((c) => [
    () => googleNoticias(`${NOMBRE} "${c}" when:30d`, "prensa", 40),
    async () => (await googleNoticias(`${NOMBRE} "${c}" site:facebook.com when:30d`, "facebook", 40)).filter((m) => nombraAMariaFernanda(m.titulo)),
  ]);
  const resultados = await conLimite(tareas, 5, hasta);
  const nuevas = resultados.flatMap((r) => (r?.status === "fulfilled" ? r.value : []));
  for (const m of nuevas) extras.set(`${m.plataforma}|${m.enlace}`, m);
  await guardarItems(nuevas.map((m): ItemMonitoreo => ({ personaje: PERSONAJE, tipo: "web", enlace: m.enlace, titulo: m.titulo, medio: `${m.plataforma}|${m.fuente}|${m.dominio ?? ""}`, fecha: m.fecha, vistas: null, nombra: true, donde: m.plataforma, contexto: m.extracto })));
  await resolverDesconocidos(nuevas);
  return { menciones: nuevas.map(ubicar).map(aplicarYouTube), tanda, tandas: TANDAS_BARRIDO, ciudades, total: CIUDADES_BARRIDO.length };
}
