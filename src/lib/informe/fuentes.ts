import "server-only";

/**
 * Fuentes públicas del informe semanal (sin claves): Google Noticias (RSS),
 * el canal oficial de YouTube y las visitas diarias de Wikipedia.
 */

export type Noticia = { titulo: string; medio: string; fecha: string; enlace: string };
export type Video = { titulo: string; fecha: string; vistas: number; likes: number; enlace: string };

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

/** Los 15 últimos videos del canal, con vistas y me gusta. */
export async function videos(): Promise<Video[]> {
  const xml = await (await pedir(`https://www.youtube.com/feeds/videos.xml?channel_id=${CANAL_YOUTUBE}`)).text();
  return (xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []).map((e) => ({
    titulo: entidades(etiqueta(e, "title") ?? ""),
    fecha: etiqueta(e, "published") ?? "",
    vistas: Number(e.match(/<media:statistics views="(\d+)"/)?.[1] ?? 0),
    likes: Number(e.match(/<media:starRating count="(\d+)"/)?.[1] ?? 0),
    enlace: e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? "",
  }));
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
