import "server-only";

/**
 * ¿Hay una transmisión en vivo ahora en el canal oficial (SoyCabalTV)? Se lee de
 * la página pública `/channel/<id>/live` de YouTube, que no pide clave: si hay
 * directo, redirige al video y su marcado trae `"isLive":true`.
 */

export const CANAL_YOUTUBE = "UCNwhLgzH-XFeI_2RX424saQ";

export type EnVivo = {
  enVivo: boolean;
  videoId?: string;
  titulo?: string;
  enlace?: string;
  /** Cuándo se consultó (ISO). */
  consultadoEn: string;
};

const entidades = (s: string) =>
  s
    .replace(/\\u0026/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

export function leerPaginaEnVivo(html: string, ahora = new Date()): EnVivo {
  const consultadoEn = ahora.toISOString();
  const videoId = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1];
  // El directo del propio canal: su videoId seguido de "isLive":true en el JSON de la página.
  const directo = videoId
    ? html.match(new RegExp(`"videoId":"${videoId}","title":"((?:[^"\\\\]|\\\\.)*)"[^}]{0,300}?"isLive":true`))
    : null;
  if (!videoId || !directo) return { enVivo: false, consultadoEn };
  return {
    enVivo: true,
    videoId,
    titulo: entidades(directo[1]),
    enlace: `https://www.youtube.com/watch?v=${videoId}`,
    consultadoEn,
  };
}

export async function enVivo(): Promise<EnVivo> {
  const res = await fetch(`https://www.youtube.com/channel/${CANAL_YOUTUBE}/live`, {
    headers: { "User-Agent": "Mozilla/5.0 (EscudoCabal monitoreo)", "Accept-Language": "es-CO,es;q=0.9" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`YouTube respondió ${res.status}`);
  return leerPaginaEnVivo(await res.text());
}
