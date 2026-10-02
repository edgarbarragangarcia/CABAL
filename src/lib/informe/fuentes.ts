import "server-only";

/**
 * Fuentes públicas del informe semanal (sin claves): Google Noticias (RSS),
 * el canal oficial de YouTube y las visitas diarias de Wikipedia.
 */

export type Noticia = { titulo: string; medio: string; fecha: string; enlace: string };
/** `likes` es null y `aproximado` es true cuando los datos vienen de las páginas públicas del canal (cifras redondeadas por YouTube). */
export type Video = { titulo: string; fecha: string; vistas: number; likes: number | null; enlace: string; aproximado?: boolean };

const QUERY = '"María Fernanda Cabal"';
/** Canal oficial (SoyCabalTV); el @MariaFernandaCabal es otro, sin relación. */
const CANAL_YOUTUBE = "UCNwhLgzH-XFeI_2RX424saQ";
const WIKI_ARTICULO = "Mar%C3%ADa_Fernanda_Cabal";
const USER_AGENT = "EscudoCabal/1.0 (informe semanal)";

const entidades = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

const etiqueta = (bloque: string, nombre: string) => bloque.match(new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`))?.[1];
const dia = (d: Date) => d.toISOString().slice(0, 10);

async function pedir(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...init?.headers }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} respondió ${res.status}`);
  return res;
}

/** Google Noticias para cualquier consulta, hasta `limite` titulares sin duplicar (el feed trae como máximo unos 100). */
export async function buscarNoticias(q: string, limite = 100): Promise<Noticia[]> {
  const url = `https://news.google.com/rss/search?${new URLSearchParams({ q, hl: "es-419", gl: "CO", ceid: "CO:es-419" })}`;
  const xml = await (await pedir(url)).text();
  const vistas = new Set<string>();
  const lista: Noticia[] = [];
  for (const it of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    if (lista.length >= limite) break;
    const medio = entidades(etiqueta(it, "source") ?? "");
    // El título termina con " - Medio": se separa para no repetirlo.
    let titulo = entidades(etiqueta(it, "title") ?? "");
    if (medio && titulo.endsWith(` - ${medio}`)) titulo = titulo.slice(0, -(medio.length + 3));
    const clave = titulo.toLowerCase().replace(/\W+/g, " ");
    const fecha = etiqueta(it, "pubDate");
    if (!titulo || !fecha || vistas.has(clave)) continue;
    vistas.add(clave);
    lista.push({ titulo, medio: medio || "Medio sin nombre", fecha: new Date(fecha).toISOString(), enlace: entidades(etiqueta(it, "link") ?? "") });
  }
  return lista.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Noticias de María Fernanda Cabal entre dos fechas (una semana son unas 30). */
export async function noticias(desde: Date, hasta: Date): Promise<Noticia[]> {
  return buscarNoticias(`${QUERY} after:${dia(desde)} before:${dia(hasta)}`);
}

const UA_NAVEGADOR = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const UNIDADES: [RegExp, number][] = [
  [/^segundo/, 1_000],
  [/^minuto/, 60_000],
  [/^hora/, 3_600_000],
  [/^d[ií]a/, 86_400_000],
  [/^semana/, 7 * 86_400_000],
  [/^mes/, 30 * 86_400_000],
  [/^a[nñ]o/, 365 * 86_400_000],
];

/** "Transmitido hace 3 meses" → fecha aproximada; null si no se reconoce. */
export function fechaRelativa(texto: string, ahora: Date): string | null {
  const m = texto.toLowerCase().match(/hace\s+(\d+)\s+([a-zñáéíóú]+)/);
  const unidad = m && UNIDADES.find(([re]) => re.test(m[2]));
  return m && unidad ? new Date(ahora.getTime() - Number(m[1]) * unidad[1]).toISOString() : null;
}

/** "2.3 mil vistas", "1 millón de vistas", "529 vistas" → número aproximado. */
export function vistasDe(texto: string): number | null {
  const t = texto.toLowerCase();
  const num = t.match(/(\d[\d.,]*)/)?.[1];
  if (!num) return /sin\s+vistas/.test(t) ? 0 : null;
  const factor = /mill[oó]n|millones/.test(t) ? 1_000_000 : /\bmil\b/.test(t) ? 1_000 : 1;
  return Math.round(factor === 1 ? Number(num.replace(/[.,]/g, "")) : Number.parseFloat(num.replace(",", ".")) * factor);
}

type Nodo = Record<string, unknown>;
const nodo = (x: unknown): Nodo => (x && typeof x === "object" ? (x as Nodo) : {});

/** Videos de una página pública del canal (pestañas Videos o En vivo), leídos de los datos que YouTube incrusta en el HTML. */
export function leerVideosDePagina(html: string, ahora: Date): Video[] {
  const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (!m) return [];
  let datos: unknown;
  try {
    datos = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const lista: Video[] = [];
  const visitar = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(visitar);
    if (!x || typeof x !== "object") return;
    const l = nodo((x as Nodo).lockupViewModel);
    if (typeof l.contentId === "string" && l.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
      const meta = nodo(nodo(l.metadata).lockupMetadataViewModel);
      const partes = (nodo(nodo(meta.metadata).contentMetadataViewModel).metadataRows as unknown[] | undefined)?.flatMap(
        (r) => (nodo(r).metadataParts as unknown[] | undefined) ?? []
      ) ?? [];
      const etiquetas = partes.map((p) => String(nodo(p).accessibilityLabel ?? nodo(nodo(p).text).content ?? ""));
      const titulo = String(nodo(meta.title).content ?? "");
      const vistas = etiquetas.filter((e) => /vista/i.test(e)).map(vistasDe).find((v) => v !== null);
      const fecha = etiquetas.map((e) => fechaRelativa(e, ahora)).find(Boolean);
      if (titulo && fecha) {
        lista.push({ titulo, fecha, vistas: vistas ?? 0, likes: null, enlace: `https://www.youtube.com/watch?v=${l.contentId}`, aproximado: true });
      }
    }
    Object.values(x as Nodo).forEach(visitar);
  };
  visitar(datos);
  return lista;
}

async function videosDePaginas(): Promise<Video[]> {
  const ahora = new Date();
  const paginas = await Promise.allSettled(
    ["videos", "streams"].map(async (pestaña) => {
      const res = await pedir(`https://www.youtube.com/channel/${CANAL_YOUTUBE}/${pestaña}`, {
        headers: { "User-Agent": UA_NAVEGADOR, "Accept-Language": "es-CO,es;q=0.9" },
      });
      return leerVideosDePagina(await res.text(), ahora);
    })
  );
  const vistos = new Set<string>();
  return paginas
    .flatMap((p) => (p.status === "fulfilled" ? p.value : []))
    .filter((v) => (vistos.has(v.enlace) ? false : (vistos.add(v.enlace), true)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 15);
}

/**
 * Los 15 últimos videos del canal. El feed RSS da vistas y me gusta exactos pero
 * YouTube lo deja caer (404) de vez en cuando: entonces se leen las páginas
 * públicas del canal, con cifras aproximadas y sin me gusta.
 */
export async function videos(): Promise<Video[]> {
  try {
    const xml = await (await pedir(`https://www.youtube.com/feeds/videos.xml?channel_id=${CANAL_YOUTUBE}`)).text();
    return (xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []).map((e) => ({
      titulo: entidades(etiqueta(e, "title") ?? ""),
      fecha: etiqueta(e, "published") ?? "",
      vistas: Number(e.match(/<media:statistics views="(\d+)"/)?.[1] ?? 0),
      likes: Number(e.match(/<media:starRating count="(\d+)"/)?.[1] ?? 0),
      enlace: e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? "",
    }));
  } catch (errorRss) {
    const lista = await videosDePaginas().catch(() => []);
    if (lista.length === 0) throw errorRss;
    return lista;
  }
}

/** Visitas diarias a su artículo de Wikipedia en español, de las últimas dos semanas. */
export async function visitasWikipedia(hoy: Date): Promise<{ ultimos: number; previos: number }> {
  const fin = new Date(hoy.getTime() - 86_400_000);
  const ini = new Date(hoy.getTime() - 14 * 86_400_000);
  const c = (d: Date) => dia(d).replace(/-/g, "");
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/all-access/user/${WIKI_ARTICULO}/daily/${c(ini)}/${c(fin)}`;
  const items = ((await (await pedir(url)).json()) as { items: { views: number }[] }).items.map((i) => i.views);
  return { ultimos: items.slice(-7).reduce((s, v) => s + v, 0), previos: items.slice(-14, -7).reduce((s, v) => s + v, 0) };
}
