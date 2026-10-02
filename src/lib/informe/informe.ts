import { noticias, videos, visitasWikipedia, type Noticia, type Video } from "./fuentes";

/**
 * Informe semanal: recoge las fuentes, deja que la IA lo resuma si hay un
 * proveedor configurado, y lo arma como mensaje de Telegram (HTML).
 */

export type DatosInforme = {
  /** Primer y último día de la semana cubierta (YYYY-MM-DD). */
  desde: string;
  hasta: string;
  noticias: Noticia[];
  noticiasPrevias: number | null;
  videos: Video[];
  wikipedia: { ultimos: number; previos: number } | null;
  /** Fuentes que no respondieron. */
  errores: string[];
};

const DIA = 86_400_000;
const dia = (d: Date) => d.toISOString().slice(0, 10);

export async function recolectar(hoy = new Date()): Promise<DatosInforme> {
  const semana = new Date(hoy.getTime() - 7 * DIA);
  const previa = new Date(hoy.getTime() - 14 * DIA);
  const [n, np, v, w] = await Promise.allSettled([
    noticias(semana, new Date(hoy.getTime() + DIA)),
    noticias(previa, semana),
    videos(),
    visitasWikipedia(hoy),
  ]);
  const errores: string[] = [];
  const valor = <T,>(r: PromiseSettledResult<T>, fuente: string): T | null => {
    if (r.status === "fulfilled") return r.value;
    errores.push(`${fuente}: ${r.reason instanceof Error ? r.reason.message : "no respondió"}`);
    return null;
  };
  return {
    desde: dia(semana),
    hasta: dia(hoy),
    noticias: valor(n, "Noticias") ?? [],
    noticiasPrevias: valor(np, "Noticias de la semana anterior")?.length ?? null,
    videos: valor(v, "YouTube") ?? [],
    wikipedia: valor(w, "Wikipedia"),
    errores,
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n: number) => n.toLocaleString("es-CO");
/** "2026-09-20" (solo día) se muestra tal cual; una fecha con hora se pasa a hora de Colombia. */
const fechaCorta = (iso: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  });
const variacion = (ahora: number, antes: number) =>
  antes > 0 ? `${ahora >= antes ? "+" : "−"}${Math.abs(Math.round((100 * (ahora - antes)) / antes))} %` : "sin base";

/** La IA suele responder con markdown; Telegram (HTML) solo necesita texto limpio. */
export function limpiarMarkdown(texto: string) {
  return texto
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/^[-*]\s+/, "• ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatearInforme(d: DatosInforme, analisis?: string): string {
  const partes: string[] = [`<b>Informe semanal · María Fernanda Cabal</b>\nSemana del ${fechaCorta(d.desde)} al ${fechaCorta(d.hasta)}`];

  const cambio = d.noticiasPrevias === null ? "" : ` (${variacion(d.noticias.length, d.noticiasPrevias)} frente a la semana anterior, ${fmt(d.noticiasPrevias)})`;
  const medios = new Map<string, number>();
  for (const n of d.noticias) medios.set(n.medio, (medios.get(n.medio) ?? 0) + 1);
  const top = [...medios].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, c]) => `${esc(m)} ${c}`).join(", ");
  partes.push(
    `📰 <b>Noticias:</b> ${fmt(d.noticias.length)} esta semana${cambio}.${top ? `\nMás publicaron: ${top}.` : ""}` +
      (d.noticias.length
        ? "\n" + d.noticias.slice(0, 5).map((n) => `• <a href="${esc(n.enlace)}">${esc(n.titulo)}</a> — ${esc(n.medio)}, ${fechaCorta(n.fecha)}`).join("\n")
        : "")
  );

  const limite = new Date(d.hasta).getTime() - 7 * DIA;
  const nuevos = d.videos.filter((v) => new Date(v.fecha).getTime() >= limite);
  partes.push(
    nuevos.length
      ? `▶️ <b>YouTube (SoyCabalTV):</b> ${nuevos.length} ${nuevos.length === 1 ? "video nuevo" : "videos nuevos"}.\n` +
          nuevos.map((v) => `• <a href="${esc(v.enlace)}">${esc(v.titulo)}</a> — ${fmt(v.vistas)} vistas${v.likes === null ? "" : `, ${fmt(v.likes)} me gusta`}`).join("\n")
      : `▶️ <b>YouTube (SoyCabalTV):</b> sin videos nuevos esta semana.${d.videos[0] ? `\nEl último: <a href="${esc(d.videos[0].enlace)}">${esc(d.videos[0].titulo)}</a> (${fechaCorta(d.videos[0].fecha)}, ${fmt(d.videos[0].vistas)} vistas).` : ""}`
  );

  if (d.wikipedia) {
    partes.push(`🔎 <b>Wikipedia:</b> ${fmt(d.wikipedia.ultimos)} visitas a su artículo en los últimos 7 días (${variacion(d.wikipedia.ultimos, d.wikipedia.previos)} frente a los 7 previos, ${fmt(d.wikipedia.previos)}).`);
  }
  if (analisis?.trim()) partes.push(`🤖 <b>Lectura de la semana</b>\n${esc(limpiarMarkdown(analisis))}`);
  if (d.errores.length) partes.push(`⚠️ No respondieron: ${esc(d.errores.join("; "))}.`);
  return partes.join("\n\n");
}

/** Texto plano del mensaje, para la vista previa del panel. */
export const aTextoPlano = (html: string) =>
  html
    .replace(/<a href="[^"]*">([\s\S]*?)<\/a>/g, "$1")
    .replace(/<\/?b>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export function promptAnalisis(d: DatosInforme) {
  const cambio = d.noticiasPrevias === null ? "" : ` (semana anterior: ${d.noticiasPrevias})`;
  return [
    `Semana del ${d.desde} al ${d.hasta}.`,
    `Noticias sobre María Fernanda Cabal: ${d.noticias.length}${cambio}.`,
    ...d.noticias.slice(0, 20).map((n) => `- ${n.titulo} (${n.medio}, ${n.fecha.slice(0, 10)})`),
    d.wikipedia ? `Visitas a Wikipedia: ${d.wikipedia.ultimos} (7 previos: ${d.wikipedia.previos}).` : "",
    ...d.videos.slice(0, 5).map((v) => `Video: ${v.titulo} (${v.fecha.slice(0, 10)}), ${v.vistas} vistas${v.likes === null ? "" : `, ${v.likes} me gusta`}.`),
  ]
    .filter(Boolean)
    .join("\n");
}
