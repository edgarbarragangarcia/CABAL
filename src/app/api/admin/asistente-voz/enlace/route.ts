import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { NextResponse } from "next/server";
import { z } from "zod";

import { extraerTexto, textoDeHtml } from "@/lib/documentos/extraer";
import { idDeVideo, transcripcionYouTube } from "@/lib/voz/youtube";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CARACTERES = 160_000;

/** Direcciones internas (loopback, redes privadas, metadatos de la nube): nunca se consultan desde el servidor. */
function esInterna(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:127.") || l.startsWith("::ffff:10.") || l.startsWith("::ffff:192.168.") || l.startsWith("::ffff:169.254.");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function verificarDestino(u: URL): Promise<void> {
  if (!/^https?:$/.test(u.protocol)) throw new Error("Solo se leen enlaces http o https.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("Ese enlace es de una red interna.");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length) throw new Error("No encontré ese sitio. Revisa el enlace.");
  if (ips.some(esInterna)) throw new Error("Ese enlace es de una red interna.");
}

async function traer(url: string): Promise<{ tipo: string; cuerpo: Buffer; final: string }> {
  let actual = url;
  for (let salto = 0; salto < 5; salto++) {
    const u = new URL(actual);
    await verificarDestino(u);
    const r = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; CabalLector/1.0)", Accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5", "Accept-Language": "es-CO,es;q=0.9" } });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { actual = new URL(r.headers.get("location")!, u).toString(); continue; }
    if (!r.ok) throw new Error(`El sitio respondió ${r.status}. Puede que bloquee la lectura automática o pida iniciar sesión.`);
    const largo = Number(r.headers.get("content-length") ?? 0);
    if (largo > MAX_BYTES) throw new Error("La página pesa demasiado para leerla.");
    const cuerpo = Buffer.from(await r.arrayBuffer());
    if (cuerpo.length > MAX_BYTES) throw new Error("La página pesa demasiado para leerla.");
    return { tipo: (r.headers.get("content-type") ?? "").toLowerCase(), cuerpo, final: actual };
  }
  throw new Error("El enlace redirige demasiadas veces.");
}

const meta = (html: string, nombre: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nombre}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${nombre}["']`, "i"))?.[1] ?? "";

/** POST { url } → el texto de la página (artículo, PDF o transcripción de YouTube) para que el asistente lo analice. */
export async function POST(req: Request) {
  const p = z.object({ url: z.string().trim().url().max(2000) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Pega un enlace completo, que empiece por https://" }, { status: 422 });
  try {
    if (idDeVideo(p.data.url) && /youtu/i.test(p.data.url)) {
      const t = await transcripcionYouTube(p.data.url);
      if (!t.ok) return NextResponse.json({ error: t.error }, { status: 422 });
      return NextResponse.json({ nombre: `${t.titulo} (YouTube, ${t.canal})`, texto: t.texto.slice(0, MAX_CARACTERES), url: p.data.url });
    }
    const { tipo, cuerpo, final } = await traer(p.data.url);
    if (tipo.includes("pdf") || /\.pdf($|\?)/i.test(final)) {
      const r = await extraerTexto(cuerpo, "enlace.pdf");
      const texto = r.paginas.map((x) => (x.numero ? `[página ${x.numero}] ${x.texto}` : x.texto)).join("\n\n").replace(/[ \t]+/g, " ").trim();
      return NextResponse.json({ nombre: decodeURIComponent(new URL(final).pathname.split("/").pop() || "Documento PDF"), texto: texto.slice(0, MAX_CARACTERES), url: final });
    }
    const html = new TextDecoder("utf-8").decode(cuerpo);
    const titulo = (meta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || new URL(final).hostname).replace(/\s+/g, " ").trim();
    const fecha = meta(html, "article:published_time") || meta(html, "og:updated_time") || meta(html, "date");
    // El cuerpo del artículo si la página lo marca; si no, toda la página sin menús ni scripts.
    const bloque = html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
    const texto = textoDeHtml(bloque).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 1).join("\n\n");
    if (texto.length < 300) return NextResponse.json({ error: "No pude leer el contenido de esa página (puede cargarse con JavaScript o pedir suscripción). Pega el texto en un archivo y adjúntalo." }, { status: 422 });
    return NextResponse.json({ nombre: titulo.slice(0, 160), texto: `${fecha ? `Fecha de publicación: ${fecha}\n` : ""}Enlace: ${final}\n\n${texto}`.slice(0, MAX_CARACTERES), url: final });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer el enlace." }, { status: 422 });
  }
}
