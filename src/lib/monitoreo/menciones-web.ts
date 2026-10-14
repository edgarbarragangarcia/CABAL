import "server-only";

import { entidades } from "@/lib/informe/fuentes";
import type { FichaVideo } from "./ficha-video";
import { guardarItems, leerItems, type ItemMonitoreo } from "./historial";
import { nombraAMariaFernanda } from "./menciones";
import { CIUDADES_BARRIDO, infoDepartamento, lugarDelTexto, lugarPredominante, lugaresDeDepartamentos } from "./lugares";
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
export type MencionWeb = { plataforma: PlataformaId; fuente: string; titulo: string; fecha: string; enlace: string; extracto: string | null; /** Miniatura (YouTube, Bing Noticias). */ imagen?: string; /** «38:12» en los videos. */ duracion?: string; /** El canal tiene la insignia de verificado. */ verificado?: boolean; /** Fragmento de la descripción del video. */ descripcion?: string; /** La fecha es aproximada (YouTube solo dice «hace 2 meses»): no mostrar hora. */ fechaAprox?: boolean; /** El «hace 2 meses» tal como lo da YouTube, ya en palabras. */ cuando?: string; /** La ficha completa del video, ya guardada en el archivo (fecha exacta, me gusta, suscriptores…). */ ficha?: FichaVideo; /** El tono lo midió la IA y quedó guardado (no se vuelve a medir). */ tonoIa?: boolean; dominio?: string; geo?: GeoMencion; /** El nombre de María Fernanda está en el titular (si no, la nombra el texto de la nota). */ enTitular?: boolean; /** Estimado por palabras; el panel lo reemplaza si el usuario mide el tono con IA. */ tono?: Tono; metricas?: Metricas; comentariosMuestra?: ComentarioMuestra[]; /** Prensa nacional o internacional: no se ubica en una ciudad. */ nacional?: boolean };
export type ResumenPlataforma = { id: PlataformaId; nombre: string; total: number; consultada: boolean };

export type RespuestaMenciones = { generadoEn: string; guardado: boolean; /** Vino solo del archivo de Supabase (no se salió a buscar). */ delArchivo?: boolean; plataformas: ResumenPlataforma[]; menciones: MencionWeb[]; /** Hay clave de YouTube: las menciones de YouTube traen vistas, likes y comentarios. */ youtubeConClave?: boolean; /** Qué portales y páginas de Facebook del directorio respondieron esta vez (para no leer un fallo como «sin menciones»). */ consultados: { portales: string[]; paginas: string[] } };

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

/**
 * «hace 11 min», «hace 3 h», «hace 2 días», «hace 2 sem.», «hace 2 m» (¡meses!), «hace 1 a» (año)… → fecha aproximada y el mismo
 * texto en palabras. En el español abreviado de YouTube, «m» son MESES y los minutos son «min».
 */
const MESES: Record<string, number> = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11, jan: 0, apr: 3, aug: 7, dec: 11 };
const LARGO = (d: Date) => d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

function fechaDeYouTube(t: string, ahora: Date): { iso: string; texto: string } | null {
  const bajo = t.toLowerCase();
  // En directo ahora mismo: es de este instante.
  if (/en directo|transmitiendo|viendo ahora|watching now|live now/.test(bajo) && !/transmitido|streamed/.test(bajo)) return { iso: ahora.toISOString(), texto: "en directo ahora" };
  // «3 days ago» (cuando YouTube responde en inglés).
  const en = bajo.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago/);
  if (en) {
    const ms = { second: 1_000, minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000, year: 365 * 86_400_000 }[en[2] as "day"];
    const d = new Date(ahora.getTime() - Number(en[1]) * ms);
    return { iso: d.toISOString(), texto: `hace ${en[1]} ${({ second: "segundos", minute: "minutos", hour: "horas", day: "días", week: "semanas", month: "meses", year: "años" } as Record<string, string>)[en[2]]}` };
  }
  // Fecha completa: «14 oct 2025», «14 de octubre de 2025», «oct 14, 2025».
  const abs = bajo.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóú]{3,})\.?,?\s+(?:de\s+)?(\d{4})/) ?? null;
  const absEn = bajo.match(/([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  const parte = abs ? { d: Number(abs[1]), mes: MESES[abs[2].slice(0, 3)], a: Number(abs[3]) } : absEn ? { d: Number(absEn[2]), mes: MESES[absEn[1].slice(0, 3)], a: Number(absEn[3]) } : null;
  if (parte && parte.mes !== undefined) {
    const d = new Date(Date.UTC(parte.a, parte.mes, parte.d, 12));
    if (!Number.isNaN(d.getTime())) return { iso: d.toISOString(), texto: LARGO(d) };
  }
  const m = bajo.match(/hace\s+(\d+)\s*([a-zñáéíóú]+)\.?/);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2];
  const un = (singular: string, plural: string) => `hace ${n} ${n === 1 ? singular : plural}`;
  const caso: [number, string] | null =
    /^seg|^s$/.test(u) ? [1_000, un("segundo", "segundos")]
    : /^min/.test(u) ? [60_000, un("minuto", "minutos")]
    : /^h/.test(u) ? [3_600_000, un("hora", "horas")]
    : /^d/.test(u) ? [86_400_000, un("día", "días")]
    : /^sem/.test(u) ? [7 * 86_400_000, un("semana", "semanas")]
    : /^m(es)?(es)?$/.test(u) ? [30 * 86_400_000, un("mes", "meses")]
    : /^a/.test(u) ? [365 * 86_400_000, un("año", "años")]
    : null;
  return caso ? { iso: new Date(ahora.getTime() - n * caso[0]).toISOString(), texto: caso[1] } : null;
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
    // Las publicaciones de redes llegan con la fecha en que Google las indexó, no la de la publicación: se marca como aproximada.
    lista.push({ plataforma, fuente, titulo, fecha: new Date(fecha).toISOString(), enlace: texto(etiqueta(it, "link")), extracto: null, dominio, ...(plataforma !== "prensa" && plataforma !== "web" ? { fechaAprox: true } : {}) });
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
    const img = texto(etiqueta(it, "News:Image"));
    lista.push({ plataforma: "prensa", fuente: texto(etiqueta(it, "News:Source")) || "Bing Noticias", titulo, fecha: new Date(fecha).toISOString(), enlace, extracto: texto(etiqueta(it, "description")).slice(0, 220) || null, ...(/^https:\/\//.test(img) ? { imagen: img } : {}) });
  }
  return lista;
}

type Nodo = Record<string, unknown>;
const nodo = (x: unknown): Nodo => (x && typeof x === "object" ? (x as Nodo) : {});

/** La búsqueda pública de YouTube, por fecha: videos de cualquier canal que la nombran. */
async function youtubeBusqueda(consulta = '"María Fernanda Cabal"'): Promise<MencionWeb[]> {
  const html = await pedir(`https://www.youtube.com/results?${new URLSearchParams({ search_query: consulta, sp: "CAI%3D" })}`);
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
      const rel = fechaDeYouTube(cuando, ahora);
      // Sin una fecha que se pueda leer no se inventa «hoy»: ese video no entra (la fecha tiene que ser precisa).
      if (!rel) return void Object.values(x as Nodo).forEach(ver);
      const duracion = String(nodo(v.lengthText).simpleText ?? "");
      const verificado = JSON.stringify(v.ownerBadges ?? "").includes("VERIFIED");
      const snippet = ((nodo((v.detailedMetadataSnippets as unknown[] | undefined)?.[0]).snippetText as { runs?: { text?: string }[] } | undefined)?.runs ?? []).map((r) => r.text ?? "").join("");
      if (titulo) {
        lista.push({
          plataforma: "youtube", fuente: canal || "YouTube", titulo, fecha: rel.iso, enlace: `https://www.youtube.com/watch?v=${v.videoId}`, extracto: vistas || null,
          imagen: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
          ...(duracion ? { duracion } : {}), ...(verificado ? { verificado: true } : {}), ...(snippet ? { descripcion: texto(snippet).slice(0, 240) } : {}),
          cuando: rel.texto, fechaAprox: true,
        });
      }
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
/** Busca «Cabal» en el propio buscador de un portal (WordPress: /?s=…&feed=rss2): enlaces directos, sin pasar por Google. */
async function buscarEnPortal(m: MedioRegional): Promise<MencionWeb[]> {
  let xml = "";
  for (const host of [m.dominio, `www.${m.dominio}`]) {
    try {
      const res = await fetch(`https://${host}/?${new URLSearchParams({ s: "Cabal", feed: "rss2" })}`, { headers: { "User-Agent": UA, "Accept-Language": "es-CO,es;q=0.9" }, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(9_000) });
      const t = await res.text();
      if (res.ok && /<rss|<feed/.test(t.slice(0, 600))) {
        xml = t;
        break;
      }
    } catch {
      /* se prueba la otra forma */
    }
  }
  if (!xml) throw new Error(`${m.dominio} no respondió`);
  const lista: MencionWeb[] = [];
  for (const it of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const titulo = texto(etiqueta(it, "title"));
    const extracto = texto(etiqueta(it, "description")).slice(0, 240);
    const fecha = etiqueta(it, "pubDate");
    const enlace = texto(etiqueta(it, "link"));
    // La búsqueda del portal también trae notas que dicen «Cabal» en otro sentido (Santa Rosa de Cabal): solo cuentan las que la nombran.
    if (!titulo || !fecha || !enlace || !nombraAMariaFernanda(`${titulo} ${extracto}`)) continue;
    lista.push({ plataforma: "prensa", fuente: m.nombre, titulo, fecha: new Date(fecha).toISOString(), enlace, extracto: extracto || null, dominio: m.dominio });
  }
  return lista;
}

function tareasRegionales(): Tarea[] {
  const tareas: Tarea[] = MEDIOS_REGIONALES.filter((m) => m.rss).map((m) => ({ plataforma: "prensa" as PlataformaId, cubre: { portales: [m.id] }, ejecutar: () => buscarEnPortal(m) }));
  const web = MEDIOS_REGIONALES.filter((m) => m.web);
  for (let i = 0; i < web.length; i += GRUPO) {
    const grupo = web.slice(i, i + GRUPO);
    tareas.push({
      plataforma: "prensa",
      cubre: { portales: grupo.map((m) => m.id) },
      ejecutar: async () => (await googleNoticias(`${NOMBRE} (${grupo.map((m) => `site:${m.dominio}`).join(" OR ")}) when:30d`, "prensa", 100)).filter((m) => !!m.dominio && !!medioPorDominio(m.dominio)),
    });
  }
  // Páginas de Facebook sin sitio web propio (se conocen por el nombre con que empiezan sus publicaciones).
  for (const m of MEDIOS_REGIONALES.filter((x) => !x.dominio && !x.fb)) {
    tareas.push({
      plataforma: "facebook",
      cubre: { paginas: [m.id] },
      ejecutar: async () => (await googleNoticias(`${NOMBRE} "${m.nombre}" site:facebook.com when:30d`, "facebook", 60)).filter((x) => nombraAMariaFernanda(x.titulo) && medioPorInicio(x.titulo)?.id === m.id).map((x) => ({ ...x, fuente: m.nombre })),
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

/**
 * «12.345 visualizaciones», «10,200 vistas», «1,2 M de visualizaciones», «3,4 mil vistas», «45 k vistas» → número.
 * Un grupo de tres cifras tras la coma o el punto, sin «mil»/«M»/«k», son miles (10,200 = 10 200); con «mil», «M» o «k», es decimal.
 */
export function vistasDeTexto(t: string | null): number | undefined {
  const m = t?.toLowerCase().match(/([\d.,]+)\s*(mil millones|millones|millón|mil|m|k)?\s*(?:de\s+)?(?:visualizaciones|vistas|views)/);
  if (!m) return undefined;
  const crudo = m[1];
  const f = m[2] === "mil millones" ? 1e9 : m[2] === "millones" || m[2] === "millón" || m[2] === "m" ? 1e6 : m[2] === "mil" || m[2] === "k" ? 1e3 : 1;
  const miles = f === 1 || /^\d{1,3}([.,]\d{3})+$/.test(crudo);
  const num = miles && /^\d{1,3}([.,]\d{3})+$/.test(crudo) ? Number(crudo.replace(/[.,]/g, "")) : Number(crudo.replace(",", "."));
  if (!Number.isFinite(num)) return undefined;
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
    tono: m.tonoIa && m.tono ? m.tono : tonoDeTexto(m.titulo).tono,
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
    { plataforma: "youtube" as PlataformaId, ejecutar: () => youtubeBusqueda() },
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
  const historial = guardado ? await desdeHistorial() : null;
  const respuesta = await armar(historial ?? [...nuevas], { guardado, consultada, consultados: { portales: [...consultados.portales], paginas: [...consultados.paginas] }, vivo: true });
  memoria = { en: Date.now(), datos: respuesta };
  return respuesta;
}

/** Lo guardado en el archivo (último mes) como menciones, con lo ya analizado: ficha del video y tono medido por la IA. */
async function desdeHistorial(): Promise<MencionWeb[] | null> {
  const previas = await leerItems(new Date(Date.now() - 31 * 86_400_000).toISOString(), { personaje: PERSONAJE, limite: 5000 });
  if (!previas) return null;
  return previas
    .filter((p) => p.tipo === "web")
    .map((p): MencionWeb => {
      const [plataforma, fuente, dominio] = (p.medio ?? "web||").split("|");
      const ficha = (p.datos as { ficha?: FichaVideo } | null | undefined)?.ficha;
      return {
        plataforma: (plataforma as PlataformaId) || "web", fuente: fuente || "Web", titulo: p.titulo, fecha: ficha?.publicado ?? p.fecha, enlace: p.enlace, extracto: p.contexto, dominio: dominio || undefined,
        // Lo ya analizado queda guardado: la ficha del video y el tono medido por la IA no se piden otra vez.
        ...(plataforma === "youtube" && idDeVideo(p.enlace) ? { imagen: `https://i.ytimg.com/vi/${idDeVideo(p.enlace)}/mqdefault.jpg` } : {}),
        ...(ficha?.comentarios?.length ? { comentariosMuestra: ficha.comentarios.map((c) => ({ texto: c.texto, autor: c.autor, likes: c.likes, fecha: ficha.publicado ?? p.fecha, tono: c.tono })) } : {}),
        ...(ficha ? { ficha, metricas: { vistas: ficha.vistas ?? p.vistas ?? undefined, likes: ficha.likes ?? undefined } } : p.vistas ? { metricas: { vistas: p.vistas } } : {}),
        ...(p.tono_ia && p.tono ? { tono: p.tono, tonoIa: true } : {}),
      };
    });
}

type ContextoArmado = { guardado: boolean; consultada: Set<PlataformaId>; consultados: { portales: string[]; paginas: string[] }; /** Se acaba de consultar en vivo: se completan las ubicaciones y las cifras de YouTube. */ vivo: boolean };

/** De la lista de menciones (en vivo y/o del archivo) a la respuesta del panel: ubicadas, sin repetir y con sus totales. */
async function armar(todas: MencionWeb[], ctx: ContextoArmado): Promise<RespuestaMenciones> {
  for (const e of extras.values()) todas.push(e);
  if (ctx.vivo) await resolverDesconocidos(todas);
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
    .slice(0, 4000);

  const youtubeConClave = ctx.vivo ? await enriquecerYouTube(menciones).catch(() => false) : false;
  const enriquecidas = menciones.map(aplicarYouTube);
  const plataformas = PLATAFORMAS.map((p) => ({ id: p.id, nombre: p.nombre, total: menciones.filter((m) => m.plataforma === p.id).length, consultada: ctx.consultada.has(p.id) }));
  return { generadoEn: new Date().toISOString(), guardado: ctx.guardado, plataformas, menciones: enriquecidas, youtubeConClave, consultados: ctx.consultados };
}

/** Sin salir a buscar: solo lo que ya está en el archivo de Supabase (rápido y sin gastar consultas). null si el archivo está vacío. */
export async function mencionesDelArchivo(): Promise<RespuestaMenciones | null> {
  const previas = await desdeHistorial();
  if (!previas || previas.length === 0) return null;
  const consultada = new Set(PLATAFORMAS.map((p) => p.id));
  const consultados = { portales: MEDIOS_REGIONALES.filter((m) => m.dominio).map((m) => m.id), paginas: MEDIOS_REGIONALES.filter((m) => m.fb).map((m) => m.id) };
  return armar(previas, { guardado: true, consultada, consultados, vivo: false });
}

/* ------------------------------------------------------------------ Búsqueda a fondo ---- */

/** Lugares por tanda: cada uno son dos consultas (prensa y Facebook) a un ritmo que Google tolera. */
const CIUDADES_POR_TANDA = 24;
/** Departamentos con menos de cuatro portales en el directorio: ahí se buscan todos los municipios, no solo las ciudades grandes. */
const POCO_CUBIERTOS = (() => {
  const por = new Map<string, number>();
  for (const m of MEDIOS_REGIONALES) por.set(m.dane.slice(0, 2), (por.get(m.dane.slice(0, 2)) ?? 0) + (m.dominio ? 1 : 0));
  return new Set(["05", "08", "13", "15", "17", "18", "19", "20", "23", "25", "27", "41", "44", "47", "50", "52", "54", "63", "66", "68", "70", "73", "76", "81", "85", "86", "88", "91", "94", "95", "97", "99"].filter((d) => (por.get(d) ?? 0) < 4));
})();
export const LUGARES_BARRIDO: string[] = [...new Set([...CIUDADES_BARRIDO.map((c) => `"${c}"`), ...lugaresDeDepartamentos(POCO_CUBIERTOS)])];
export const TANDAS_BARRIDO = Math.ceil(LUGARES_BARRIDO.length / CIUDADES_POR_TANDA);

/**
 * Recorre las ciudades principales del país y todos los municipios de los departamentos con pocos portales buscando «María Fernanda
 * Cabal» + el lugar en prensa y en Facebook: así salen los medios y las páginas que no están en el directorio (el micrositio, la
 * emisora más pequeña). Se llama por tandas desde el panel.
 */
export async function barridoCiudades(tanda: number): Promise<{ menciones: MencionWeb[]; tanda: number; tandas: number; ciudades: string[]; total: number; /** Google pidió bajar el ritmo: hay que esperar unos minutos y repetir esta tanda. */ limitado: boolean }> {
  const ciudades = LUGARES_BARRIDO.slice(tanda * CIUDADES_POR_TANDA, (tanda + 1) * CIUDADES_POR_TANDA);
  const hasta = Date.now() + PRESUPUESTO_MS;
  const pausa = () => new Promise((ok) => setTimeout(ok, 350));
  const tareas = ciudades.flatMap((c) => [
    async () => { const r = await googleNoticias(`${NOMBRE} ${c} when:30d`, "prensa", 40); await pausa(); return r; },
    // «Cabal» o «MaFe» a secas: así hablan muchas páginas locales de Facebook.
    async () => { const r = (await googleNoticias(`(Cabal OR MaFe) ${c} site:facebook.com when:60d`, "facebook", 40)).filter((m) => nombraAMariaFernanda(m.titulo)); await pausa(); return r; },
  ]);
  const resultados = await conLimite(tareas, 3, hasta);
  const hechas = resultados.filter(Boolean).length;
  const bloqueadas = resultados.filter((r) => r?.status === "rejected" && /respondió (429|503)/.test(String((r as PromiseRejectedResult).reason?.message))).length;
  const nuevas = resultados.flatMap((r) => (r?.status === "fulfilled" ? r.value : []));
  for (const m of nuevas) extras.set(`${m.plataforma}|${m.enlace}`, m);
  await guardarItems(nuevas.map((m): ItemMonitoreo => ({ personaje: PERSONAJE, tipo: "web", enlace: m.enlace, titulo: m.titulo, medio: `${m.plataforma}|${m.fuente}|${m.dominio ?? ""}`, fecha: m.fecha, vistas: null, nombra: true, donde: m.plataforma, contexto: m.extracto })));
  await resolverDesconocidos(nuevas);
  return { menciones: nuevas.map(ubicar).map(aplicarYouTube), tanda, tandas: TANDAS_BARRIDO, ciudades, total: LUGARES_BARRIDO.length, limitado: hechas > 0 && bloqueadas / hechas > 0.3 };
}


/* ------------------------------------------------------------ Investigación por departamento ---- */

export type InformeDepartamento = { dep: string; nombre: string; consultas: number; fallidas: number; limitado: boolean; menciones: MencionWeb[]; portales: { directorio: number; consultados: number } };

/**
 * Investiga un departamento a fondo: su nombre, su ciudad principal y sus municipios más grandes, en prensa, Facebook, Instagram, TikTok,
 * X y YouTube, más el buscador propio de cada portal del directorio que está allí. Se llama una vez por departamento desde el panel.
 */
export async function investigarDepartamento(dep: string): Promise<InformeDepartamento | null> {
  const info = infoDepartamento(dep);
  if (!info) return null;
  const { nombre, capital, principales } = info;
  const hasta = Date.now() + PRESUPUESTO_MS;
  const pausa = () => new Promise((ok) => setTimeout(ok, 350));
  const g = (q: string, p: PlataformaId, limite = 40, filtrar = false) => async () => {
    const r = await googleNoticias(q, p, limite);
    await pausa();
    return filtrar ? r.filter((m) => nombraAMariaFernanda(m.titulo)) : r;
  };
  const portales = MEDIOS_REGIONALES.filter((m) => m.dane.startsWith(dep));
  const sitios = ["instagram.com", "tiktok.com", "x.com"] as const;
  const tareas: (() => Promise<MencionWeb[]>)[] = [
    g(`${NOMBRE} "${nombre}" when:30d`, "prensa"),
    g(`${NOMBRE} "${capital}" when:30d`, "prensa"),
    g(`${NOMBRE} (emisora OR radio OR noticiero OR periódico) "${nombre}" when:60d`, "prensa"),
    g(`${NOMBRE} (alcalde OR gobernador OR concejo OR asamblea OR diputado) "${nombre}" when:60d`, "prensa"),
    g(`${NOMBRE} "${nombre}" site:facebook.com when:60d`, "facebook", 60, true),
    g(`(Cabal OR MaFe) "${nombre}" site:facebook.com when:60d`, "facebook", 60, true),
    g(`(Cabal OR MaFe) "${capital}" site:facebook.com when:60d`, "facebook", 60, true),
    g(`(Cabal OR MaFe) (${principales.map((c) => `"${c}"`).join(" OR ")}) site:facebook.com when:60d`, "facebook", 60, true),
    ...sitios.map((s) => g(`${NOMBRE} "${nombre}" site:${s} when:60d`, s === "instagram.com" ? "instagram" : s === "tiktok.com" ? "tiktok" : "x", 40, true)),
    async () => { const r = await youtubeBusqueda(`"María Fernanda Cabal" ${nombre}`); await pausa(); return r; },
    ...portales.filter((m) => m.rss).map((m) => () => buscarEnPortal(m)),
  ];
  const resultados = await conLimite(tareas, 3, hasta);
  const hechas = resultados.filter(Boolean);
  const bloqueadas = hechas.filter((r) => r?.status === "rejected" && /respondió (429|503)/.test(String((r as PromiseRejectedResult).reason?.message))).length;
  const nuevas = resultados.flatMap((r) => (r?.status === "fulfilled" ? r.value : []));
  for (const m of nuevas) extras.set(`${m.plataforma}|${m.enlace}`, m);
  await guardarItems(nuevas.map((m): ItemMonitoreo => ({ personaje: PERSONAJE, tipo: "web", enlace: m.enlace, titulo: m.titulo, medio: `${m.plataforma}|${m.fuente}|${m.dominio ?? ""}`, fecha: m.fecha, vistas: null, nombra: true, donde: m.plataforma, contexto: m.extracto })));
  await resolverDesconocidos(nuevas);
  return {
    dep,
    nombre,
    consultas: tareas.length,
    fallidas: hechas.filter((r) => r?.status === "rejected").length + (tareas.length - hechas.length),
    limitado: hechas.length > 0 && bloqueadas / hechas.length > 0.3,
    menciones: nuevas.map(ubicar).map(aplicarYouTube),
    portales: { directorio: portales.length, consultados: portales.filter((m) => m.rss).length },
  };
}
