import "server-only";

import { claveRed } from "@/lib/ia-config";
import { CANAL_YOUTUBE } from "./en-vivo";

/**
 * Redes sociales con credenciales oficiales (configuradas en /admin/configuracion):
 * YouTube Data API v3 (gratis) y X API v2 (de pago). Sin credencial, la red
 * queda "sin conectar": nunca se inventan ni se simulan cifras.
 */

export type PublicacionRed = { id: string; texto: string; autor: string; fecha: string; me_gusta: number; respuestas: number; compartidos: number; enlace: string };

export type VideoYT = { id: string; titulo: string; fecha: string; vistas: number; likes: number; comentarios: number };
export type YouTubeDatos = {
  canal: { nombre: string; suscriptores: number | null; vistas: number; videos: number };
  /** Hasta 50 videos recientes (varias semanas). */
  videos: VideoYT[];
  /** Vistas acumuladas hoy de los videos publicados cada semana. */
  porSemana: { semana: string; videos: number; vistas: number }[];
  comentarios: PublicacionRed[];
  enVivo: { videoId: string; titulo: string; espectadores: number | null } | null;
};

export type XDatos = {
  /** Publicaciones por día en los últimos 7 días (límite de la búsqueda reciente). */
  porDia: { fecha: string; publicaciones: number }[];
  total7d: number;
  recientes: PublicacionRed[];
  populares: PublicacionRed[];
};

export type Redes = {
  generadoEn: string;
  youtube: { estado: "sin_clave" } | { estado: "error"; error: string } | { estado: "ok"; datos: YouTubeDatos };
  x: { estado: "sin_clave" } | { estado: "error"; error: string } | { estado: "ok"; datos: XDatos };
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = cuerpo?.error?.message ?? cuerpo?.detail ?? cuerpo?.title ?? `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return cuerpo as T;
}

const lunesDe = (iso: string) => {
  const d = new Date(iso);
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
};

/* ----------------------------------------------------------- YouTube ---- */

type YT = { items?: any[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
const n = (x: unknown) => (x === undefined || x === null ? 0 : Number(x) || 0);

export async function youtube(clave: string): Promise<YouTubeDatos> {
  const api = (ruta: string, q: Record<string, string>) =>
    json<YT>(`https://www.googleapis.com/youtube/v3/${ruta}?${new URLSearchParams({ ...q, key: clave })}`);

  const canalRes = await api("channels", { part: "snippet,statistics", id: CANAL_YOUTUBE });
  const c = canalRes.items?.[0];
  if (!c) throw new Error("No se encontró el canal de YouTube.");

  const subidas = await api("playlistItems", { part: "contentDetails", playlistId: `UU${CANAL_YOUTUBE.slice(2)}`, maxResults: "50" });
  const ids: string[] = (subidas.items ?? []).map((i) => i.contentDetails.videoId);
  const detalle = ids.length ? await api("videos", { part: "snippet,statistics,liveStreamingDetails", id: ids.join(",") }) : { items: [] };

  const videos: VideoYT[] = (detalle.items ?? [])
    .map((v) => ({
      id: v.id as string,
      titulo: v.snippet.title as string,
      fecha: v.snippet.publishedAt as string,
      vistas: n(v.statistics?.viewCount),
      likes: n(v.statistics?.likeCount),
      comentarios: n(v.statistics?.commentCount),
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const semanas = new Map<string, { videos: number; vistas: number }>();
  for (const v of videos) {
    const s = lunesDe(v.fecha);
    const e = semanas.get(s) ?? { videos: 0, vistas: 0 };
    e.videos++;
    e.vistas += v.vistas;
    semanas.set(s, e);
  }

  const vivo = (detalle.items ?? []).find((v) => v.snippet.liveBroadcastContent === "live");
  const enVivo = vivo
    ? { videoId: vivo.id as string, titulo: vivo.snippet.title as string, espectadores: vivo.liveStreamingDetails?.concurrentViewers ? n(vivo.liveStreamingDetails.concurrentViewers) : null }
    : null;

  // Comentarios más recientes de los últimos videos (los de más actividad de la semana).
  const comentarios: PublicacionRed[] = [];
  const hilos = await Promise.allSettled(
    videos.slice(0, 5).map((v) => api("commentThreads", { part: "snippet", videoId: v.id, order: "time", maxResults: "20", textFormat: "plainText" }).then((r) => ({ v, r })))
  );
  for (const h of hilos) {
    if (h.status !== "fulfilled") continue;
    for (const it of h.value.r.items ?? []) {
      const sn = it.snippet.topLevelComment.snippet;
      comentarios.push({
        id: it.id,
        texto: sn.textDisplay,
        autor: sn.authorDisplayName,
        fecha: sn.publishedAt,
        me_gusta: n(sn.likeCount),
        respuestas: n(it.snippet.totalReplyCount),
        compartidos: 0,
        enlace: `https://www.youtube.com/watch?v=${h.value.v.id}&lc=${it.id}`,
      });
    }
  }
  comentarios.sort((a, b) => b.fecha.localeCompare(a.fecha));

  return {
    canal: {
      nombre: c.snippet.title,
      suscriptores: c.statistics.hiddenSubscriberCount ? null : n(c.statistics.subscriberCount),
      vistas: n(c.statistics.viewCount),
      videos: n(c.statistics.videoCount),
    },
    videos,
    porSemana: [...semanas.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([semana, e]) => ({ semana, ...e })),
    comentarios: comentarios.slice(0, 30),
    enVivo,
  };
}

/* ---------------------------------------------------------------- X ----- */

export const CONSULTA_X = '("María Fernanda Cabal" OR "Fernanda Cabal" OR @MariaFdaCabal) -is:retweet';

type Tweet = { id: string; text: string; created_at: string; author_id?: string; public_metrics?: Record<string, number> };

export async function x(token: string): Promise<XDatos> {
  const h = { Authorization: `Bearer ${token}` };
  const base = "https://api.twitter.com/2/tweets";
  const [conteo, busqueda] = await Promise.all([
    json<{ data?: { start: string; tweet_count: number }[]; meta?: { total_tweet_count: number } }>(
      `${base}/counts/recent?${new URLSearchParams({ query: CONSULTA_X, granularity: "day" })}`,
      { headers: h }
    ),
    json<{ data?: Tweet[]; includes?: { users?: { id: string; username: string }[] } }>(
      `${base}/search/recent?${new URLSearchParams({
        query: CONSULTA_X,
        max_results: "100",
        "tweet.fields": "created_at,public_metrics,author_id",
        expansions: "author_id",
        "user.fields": "username",
      })}`,
      { headers: h }
    ),
  ]);

  const usuarios = new Map((busqueda.includes?.users ?? []).map((u) => [u.id, u.username]));
  const posts: PublicacionRed[] = (busqueda.data ?? []).map((t) => {
    const autor = usuarios.get(t.author_id ?? "") ?? "desconocido";
    return {
      id: t.id,
      texto: t.text,
      autor: `@${autor}`,
      fecha: t.created_at,
      me_gusta: n(t.public_metrics?.like_count),
      respuestas: n(t.public_metrics?.reply_count),
      compartidos: n(t.public_metrics?.retweet_count) + n(t.public_metrics?.quote_count),
      enlace: `https://x.com/${autor}/status/${t.id}`,
    };
  });

  return {
    porDia: (conteo.data ?? []).map((d) => ({ fecha: d.start.slice(0, 10), publicaciones: d.tweet_count })),
    total7d: conteo.meta?.total_tweet_count ?? 0,
    recientes: [...posts].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 15),
    populares: [...posts].sort((a, b) => b.me_gusta + b.compartidos - (a.me_gusta + a.compartidos)).slice(0, 8),
  };
}

/* ------------------------------------------------------------ conjunto -- */

async function conectar<T>(red: "youtube" | "x", f: (clave: string) => Promise<T>) {
  const clave = await claveRed(red);
  if (!clave) return { estado: "sin_clave" as const };
  try {
    return { estado: "ok" as const, datos: await f(clave) };
  } catch (err) {
    return { estado: "error" as const, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function redes(): Promise<Redes> {
  const [yt, tw] = await Promise.all([conectar("youtube", youtube), conectar("x", x)]);
  return { generadoEn: new Date().toISOString(), youtube: yt, x: tw };
}
