import "server-only";

import { entidades } from "@/lib/informe/fuentes";
import { guardarItems, leerItems, type ItemMonitoreo } from "./historial";
import { nombraAMariaFernanda } from "./menciones";
import { lugarDelTexto } from "./lugares";
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
  medio?: { id: string; nombre: string; ciudad: string; dane: string; departamento: string; lat: number; lon: number };
  texto?: { nivel: "municipio" | "departamento"; dane: string; nombre: string; departamento: string; lat: number; lon: number };
};
export type MencionWeb = { plataforma: PlataformaId; fuente: string; titulo: string; fecha: string; enlace: string; extracto: string | null; dominio?: string; geo?: GeoMencion; /** El nombre de María Fernanda está en el titular (si no, la nombra el texto de la nota). */ enTitular?: boolean };
export type ResumenPlataforma = { id: PlataformaId; nombre: string; total: number; consultada: boolean };

export type RespuestaMenciones = { generadoEn: string; guardado: boolean; plataformas: ResumenPlataforma[]; menciones: MencionWeb[]; /** Qué portales y páginas de Facebook del directorio respondieron esta vez (para no leer un fallo como «sin menciones»). */ consultados: { portales: string[]; paginas: string[] } };

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

/** Pone a una mención su ubicación: el portal que la publica y el lugar que nombra el titular. */
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
  if (lugar) geo.texto = lugar;
  const enTitular = nombraAMariaFernanda(m.titulo);
  return geo.medio || geo.texto ? { ...m, geo, enTitular } : { ...m, enTitular };
}

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
  let todas = nuevas;
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
    .slice(0, 600);

  const plataformas = PLATAFORMAS.map((p) => ({ id: p.id, nombre: p.nombre, total: menciones.filter((m) => m.plataforma === p.id).length, consultada: consultada.has(p.id) }));
  const respuesta = { generadoEn: new Date().toISOString(), guardado, plataformas, menciones, consultados: { portales: [...consultados.portales], paginas: [...consultados.paginas] } };
  memoria = { en: Date.now(), datos: respuesta };
  return respuesta;
}
