import "server-only";

import { claveRed } from "@/lib/ia-config";
import { buscarNoticias, entidades, type Noticia } from "@/lib/informe/fuentes";
import { contextoDeMencion, nombraAMariaFernanda } from "./menciones";
import type { PublicacionRed } from "./redes";

/**
 * Lo que dicen otros personajes políticos y si nombran a María Fernanda Cabal, sin API de pago:
 *  - sus videos: el canal oficial de YouTube publica un feed público (título, descripción, fecha y vistas);
 *  - lo que dicen en X y en entrevistas, según la prensa: Google Noticias (titulares que reportan trinos y declaraciones);
 *  - los cruces con ella: noticias donde aparecen los dos nombres.
 * X no se puede leer sin su API (bloquea el acceso público): solo si hay token en Configuración se agregan sus publicaciones.
 * Nunca se inventa nada: cada dato lleva su enlace.
 */
export type Personaje = {
  id: string;
  nombre: string;
  /** Palabras que debe traer un titular para ser «sobre» el personaje (la búsqueda de Google Noticias también trae textos que lo nombran de pasada). */
  claves: string[];
  x: string;
  bando: "oposicion" | "derecha" | "centro";
  canal: { id: string; nombre: string };
};

export const PERSONAJES: Personaje[] = [
  { id: "petro", nombre: "Gustavo Petro", claves: ["petro"], x: "petrogustavo", bando: "oposicion", canal: { id: "UCHAnpr1IrQjhDpe7_oj97Ww", nombre: "Gustavo Petro" } },
  { id: "cepeda", nombre: "Iván Cepeda", claves: ["cepeda"], x: "IvanCepedaCast", bando: "oposicion", canal: { id: "UC9QwHvkEn4ooZbjiLp0k11w", nombre: "Iván Cepeda Castro" } },
  { id: "uribe", nombre: "Álvaro Uribe", claves: ["uribe"], x: "AlvaroUribeVel", bando: "derecha", canal: { id: "UCkLDuCs-KDAeYurtj4H2G2A", nombre: "Álvaro Uribe Vélez" } },
  { id: "espriella", nombre: "Abelardo de la Espriella", claves: ["espriella", "abelardo"], x: "ABDELAESPRIELLA", bando: "derecha", canal: { id: "UCZZLf7AbWRJd9OpISiVFtfw", nombre: "De la Espriella Style" } },
  { id: "paloma", nombre: "Paloma Valencia", claves: ["paloma", "valencia"], x: "PalomaValenciaL", bando: "derecha", canal: { id: "UC2d3cQi9QTF-in6AEtP2GFg", nombre: "Paloma Valencia" } },
  { id: "fajardo", nombre: "Sergio Fajardo", claves: ["fajardo"], x: "sergio_fajardo", bando: "centro", canal: { id: "UCq_bB1yFEZRyOiQiiI1hqwQ", nombre: "Sergio Fajardo" } },
];

export type VideoPersonaje = { id: string; titulo: string; fecha: string; vistas: number; enlace: string; nombra: boolean; contexto: string | null; donde: "título" | "descripción" | null };
export type NoticiaMarcada = Noticia & { nombra: boolean };
export type PublicacionMarcada = PublicacionRed & { nombra: boolean };

export type DatosPersonaje = {
  id: string;
  nombre: string;
  x: string;
  bando: Personaje["bando"];
  /** Dónde buscar en X, con su cuenta, lo que dice de María Fernanda (se abre con la sesión del propio usuario). */
  busquedaX: string;
  canal: { nombre: string; enlace: string };
  /** Videos del canal en los últimos 30 días (el feed público trae los 15 últimos). */
  videos: { estado: "ok"; items: VideoPersonaje[]; ultimo: string | null; revisados: number; nombran: number } | { estado: "error"; error: string };
  /** Titulares que reportan lo que dijo o trinó. */
  declaraciones: NoticiaMarcada[];
  /** Noticias de los últimos 30 días donde aparecen él/ella y María Fernanda. */
  cruces: NoticiaMarcada[];
  /** Prensa de la semana sobre el personaje (sin repetir las anteriores). */
  prensa: NoticiaMarcada[];
  /** false si Google Noticias no respondió: la lista vacía no significa que no haya noticias. */
  prensaConsultada: boolean;
  /** Solo con token de X en Configuración. */
  publicaciones: { estado: "sin_clave" } | { estado: "error"; error: string } | { estado: "ok"; items: PublicacionMarcada[] };
  resumen: { videosQueLaNombran: number; declaracionesQueLaNombran: number; cruces: number; publicacionesQueLaNombran: number };
};
export type RespuestaPersonajes = { generadoEn: string; personajes: DatosPersonaje[] };

const VENTANA_VIDEOS_MS = 30 * 86_400_000;

type Tweet = { id: string; text: string; created_at: string; public_metrics?: Record<string, number> };

async function publicacionesDeX(token: string, usuario: string): Promise<PublicacionMarcada[]> {
  const q = new URLSearchParams({ query: `from:${usuario} -is:retweet`, max_results: "10", "tweet.fields": "created_at,public_metrics" });
  const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const j = (await res.json().catch(() => null)) as { data?: Tweet[]; title?: string; detail?: string } | null;
  if (!res.ok) throw new Error(j?.detail ?? j?.title ?? `HTTP ${res.status}`);
  const n = (v: unknown) => Number(v) || 0;
  return (j?.data ?? []).map((t) => ({
    id: t.id,
    texto: t.text,
    autor: `@${usuario}`,
    fecha: t.created_at,
    me_gusta: n(t.public_metrics?.like_count),
    respuestas: n(t.public_metrics?.reply_count),
    compartidos: n(t.public_metrics?.retweet_count) + n(t.public_metrics?.quote_count),
    enlace: `https://x.com/${usuario}/status/${t.id}`,
    nombra: nombraAMariaFernanda(t.text),
  }));
}

const etiqueta = (bloque: string, nombre: string) => bloque.match(new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`))?.[1] ?? "";

/** El feed público de un canal de YouTube (sin clave): los 15 videos más recientes con título, descripción, fecha y vistas. */
async function videosDeCanal(canalId: string): Promise<{ autor: string; videos: VideoPersonaje[] }> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(canalId)}`, {
    headers: { "User-Agent": "EscudoCabal/1.0 (monitoreo)" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`YouTube respondió ${res.status}`);
  const xml = await res.text();
  const autor = entidades(etiqueta(xml.split("<entry>")[0], "name"));
  const videos = (xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []).flatMap((e): VideoPersonaje[] => {
    const id = etiqueta(e, "yt:videoId");
    const titulo = entidades(etiqueta(e, "title"));
    const fecha = etiqueta(e, "published");
    if (!id || !titulo || !fecha) return [];
    const descripcion = entidades(etiqueta(e, "media:description"));
    const enTitulo = nombraAMariaFernanda(titulo);
    const enDescripcion = !enTitulo && nombraAMariaFernanda(descripcion);
    return [
      {
        id,
        titulo,
        fecha: new Date(fecha).toISOString(),
        vistas: Number(e.match(/<media:statistics[^>]*views="(\d+)"/)?.[1] ?? 0),
        enlace: `https://www.youtube.com/watch?v=${id}`,
        nombra: enTitulo || enDescripcion,
        contexto: enTitulo ? contextoDeMencion(titulo) : enDescripcion ? contextoDeMencion(descripcion) : null,
        donde: enTitulo ? "título" : enDescripcion ? "descripción" : null,
      },
    ];
  });
  return { autor, videos };
}

const marcar = (n: Noticia): NoticiaMarcada => ({ ...n, nombra: nombraAMariaFernanda(n.titulo) });
const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** El titular habla del personaje (no solo lo nombra de pasada el cuerpo de la noticia). */
const esSobre = (p: Personaje) => (n: Noticia) => p.claves.some((c) => sinTildes(n.titulo).includes(c));
const TRINOS = `(trino OR trinó OR "en X" OR "en redes" OR "en su cuenta" OR dijo OR afirmó OR aseguró OR respondió OR declaró OR entrevista)`;

let memoria: { en: number; datos: RespuestaPersonajes } | null = null;
const TTL = 30 * 60_000;

async function datosDe(p: Personaje, token: string | undefined, ahora: number): Promise<DatosPersonaje> {
  const intento = async (q: string, limite: number) => {
    try {
      return { ok: true as const, lista: await buscarNoticias(q, limite) };
    } catch {
      return { ok: false as const, lista: [] as Noticia[] };
    }
  };
  const [yt, dicho, cruce, general, pub] = await Promise.all([
    videosDeCanal(p.canal.id).then((v) => ({ ok: true as const, ...v }), (e) => ({ ok: false as const, error: e instanceof Error ? e.message : "No se pudo leer YouTube." })),
    intento(`"${p.nombre}" ${TRINOS} when:7d`, 8),
    intento(`"${p.nombre}" ("María Fernanda Cabal" OR "senadora Cabal") when:30d`, 8),
    intento(`"${p.nombre}" when:7d`, 8),
    token
      ? publicacionesDeX(token, p.x).then((items) => ({ estado: "ok" as const, items }), (e) => ({ estado: "error" as const, error: e instanceof Error ? e.message : "Error de X" }))
      : Promise.resolve({ estado: "sin_clave" as const }),
  ]);

  const sobre = esSobre(p);
  const declaraciones = dicho.lista.filter(sobre).map(marcar);
  const usados = new Set(declaraciones.map((n) => n.enlace));
  const cruces = cruce.lista.filter((n) => !usados.has(n.enlace)).map(marcar);
  cruces.forEach((n) => usados.add(n.enlace));
  const prensa = general.lista.filter((n) => sobre(n) && !usados.has(n.enlace)).map(marcar);

  const videos: DatosPersonaje["videos"] = yt.ok
    ? (() => {
        const recientes = yt.videos.filter((v) => ahora - new Date(v.fecha).getTime() <= VENTANA_VIDEOS_MS);
        // Los que la nombran primero, luego los más nuevos; se muestran cinco como máximo, en orden de fecha.
        const elegidos = [...recientes.filter((v) => v.nombra), ...recientes.filter((v) => !v.nombra)].slice(0, 5).sort((a, b) => b.fecha.localeCompare(a.fecha));
        return { estado: "ok", items: elegidos, ultimo: yt.videos[0]?.fecha ?? null, revisados: recientes.length, nombran: recientes.filter((v) => v.nombra).length };
      })()
    : { estado: "error", error: yt.error };

  return {
    id: p.id,
    nombre: p.nombre,
    x: p.x,
    bando: p.bando,
    busquedaX: `https://x.com/search?${new URLSearchParams({ q: `from:${p.x} (Cabal OR MaFe OR MariaFdaCabal)`, f: "live", src: "typed_query" })}`,
    canal: { nombre: yt.ok && yt.autor ? yt.autor : p.canal.nombre, enlace: `https://www.youtube.com/channel/${p.canal.id}` },
    videos,
    declaraciones,
    cruces,
    prensa,
    prensaConsultada: dicho.ok || cruce.ok || general.ok,
    publicaciones: pub,
    resumen: {
      videosQueLaNombran: videos.estado === "ok" ? videos.nombran : 0,
      declaracionesQueLaNombran: declaraciones.filter((n) => n.nombra).length,
      cruces: cruces.length,
      publicacionesQueLaNombran: pub.estado === "ok" ? pub.items.filter((t) => t.nombra).length : 0,
    },
  };
}

/** Se guarda 30 minutos en memoria: son varias consultas por personaje. */
export async function personajes(forzar = false): Promise<RespuestaPersonajes> {
  if (!forzar && memoria && Date.now() - memoria.en < TTL) return memoria.datos;
  const token = await claveRed("x").catch(() => undefined);
  const ahora = Date.now();
  const datos = await Promise.all(PERSONAJES.map((p) => datosDe(p, token, ahora)));
  const respuesta = { generadoEn: new Date(ahora).toISOString(), personajes: datos };
  memoria = { en: ahora, datos: respuesta };
  return respuesta;
}
