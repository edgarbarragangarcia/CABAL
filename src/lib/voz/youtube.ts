import "server-only";

/**
 * La transcripción de un video de YouTube a partir de sus subtítulos públicos (los que el propio video publica o los automáticos).
 * Desde servidores en la nube YouTube a veces bloquea la lectura: en ese caso se dice con claridad y la persona pega la transcripción.
 * Los subtítulos automáticos pueden traer errores de transcripción: la pantalla lo avisa.
 */

export const idDeVideo = (url: string) => url.trim().match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/)?.[1] ?? null;

type Pista = { baseUrl: string; languageCode: string; kind?: string; name?: { simpleText?: string } };

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodificar = (t: string) => t.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTIDADES[e.toLowerCase()] ?? m)));
const limpiar = (t: string) => t.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
const deJson = (b: string) => limpiar((JSON.parse(b) as { events?: { segs?: { utf8?: string }[] }[] }).events?.map((e) => (e.segs ?? []).map((x) => x.utf8 ?? "").join("")).join(" ") ?? "");
/** Los subtítulos en XML: <text start="…" dur="…">frase</text> (o <p><s>…</s></p> en el formato nuevo). */
const deXml = (b: string) => limpiar([...b.matchAll(/<(?:text|p)\b[^>]*>([\s\S]*?)<\/(?:text|p)>/g)].map((m) => decodificar(m[1].replace(/<[^>]+>/g, ""))).join(" "));

type Jugador = { videoDetails?: { title?: string; author?: string }; captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Pista[] } } };

/** El reproductor de la app de Android entrega los subtítulos sin las firmas que la página web ahora exige. */
async function jugadorAndroid(id: string): Promise<Jugador | null> {
  const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip", "Content-Type": "application/json" },
    body: JSON.stringify({ context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 34, osName: "Android", osVersion: "14", hl: "es", gl: "CO" } }, videoId: id, contentCheckOk: true, racyCheckOk: true }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  return r.ok ? ((await r.json()) as Jugador) : null;
}

export async function transcripcionYouTube(url: string): Promise<{ ok: true; titulo: string; canal: string; texto: string; automatica: boolean } | { ok: false; error: string }> {
  const id = idDeVideo(url);
  if (!id) return { ok: false, error: "No parece un enlace de un video de YouTube." };
  try {
    const j = await jugadorAndroid(id);
    if (!j) return { ok: false, error: "YouTube no respondió (suele pasar desde servidores en la nube). Pega la transcripción a mano." };
    const pistas = j.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    if (!pistas.length) return { ok: false, error: "Ese video no tiene subtítulos disponibles. Pega la transcripción a mano." };
    const elegida = pistas.find((p) => p.languageCode.startsWith("es") && p.kind !== "asr") ?? pistas.find((p) => p.languageCode.startsWith("es")) ?? pistas[0];
    const r = await fetch(`${elegida.baseUrl}&fmt=json3`, { headers: { "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const bruto = r.ok ? await r.text() : "";
    if (!bruto) return { ok: false, error: "YouTube no entregó los subtítulos de este video. Pega la transcripción a mano." };
    const texto = bruto.trimStart().startsWith("{") ? deJson(bruto) : deXml(bruto);
    if (texto.length < 80) return { ok: false, error: "Los subtítulos están vacíos. Pega la transcripción a mano." };
    return { ok: true, titulo: j.videoDetails?.title ?? `Video ${id}`, canal: j.videoDetails?.author ?? "", texto, automatica: elegida.kind === "asr" };
  } catch (e) {
    return { ok: false, error: `${e instanceof Error ? e.message : "No se pudo leer el video"}. Pega la transcripción a mano.` };
  }
}
