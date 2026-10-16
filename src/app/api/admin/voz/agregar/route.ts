import { NextResponse } from "next/server";
import { z } from "zod";

import { usuarioActual } from "@/lib/documentos/usuario";
import { EXTENSIONES, extraerTexto, extensionDe } from "@/lib/documentos/extraer";
import { agregarTexto } from "@/lib/voz/store";
import { transcripcionYouTube } from "@/lib/voz/youtube";

export const runtime = "nodejs";
export const maxDuration = 60;
/** Vercel admite ~4,5 MB por petición: los archivos suben de a uno. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Agrega a la voz de la Dra.:
 * · multipart con un archivo (PDF, Word, texto…): se lee el texto completo, sin resumir;
 * · JSON { youtube }: trae la transcripción del video, si YouTube la entrega;
 * · JSON { texto, titulo }: un texto pegado a mano (también sirve de respaldo cuando YouTube no entrega los subtítulos).
 */
export async function POST(req: Request) {
  const por = await usuarioActual();
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const f = await req.formData();
      const archivo = f.get("archivo");
      const formato = String(f.get("formato") ?? "general");
      if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 422 });
      const ext = extensionDe(archivo.name);
      if (!(EXTENSIONES as readonly string[]).includes(ext)) return NextResponse.json({ error: `No se pueden leer archivos .${ext || "sin extensión"} (usa PDF, Word, texto, Markdown, CSV o HTML).` }, { status: 422 });
      if (archivo.size > MAX_BYTES) return NextResponse.json({ error: `«${archivo.name}» pesa más de 4 MB: divídelo en partes más pequeñas.` }, { status: 413 });
      const ext2 = await extraerTexto(Buffer.from(await archivo.arrayBuffer()), archivo.name);
      const contenido = ext2.paginas.map((p) => p.texto.trim()).filter(Boolean).join("\n\n");
      const r = await agregarTexto({ tipo: "archivo", titulo: archivo.name.replace(/\.[a-z0-9]+$/i, ""), fuente: archivo.name, formato, contenido, paginas: ext2.totalPaginas, por });
      return r.ok ? NextResponse.json({ ok: true, palabras: r.palabras, paginas: ext2.totalPaginas }) : NextResponse.json({ error: r.error, duplicado: r.duplicado }, { status: r.duplicado ? 409 : 422 });
    }
    const p = z.union([
      z.object({ youtube: z.string().trim().min(10).max(300), formato: z.string().default("general") }),
      z.object({ texto: z.string().trim().min(40).max(400_000), titulo: z.string().trim().min(1).max(200), formato: z.string().default("general"), fuente: z.string().trim().max(300).optional() }),
    ]).safeParse(await req.json().catch(() => null));
    if (!p.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 422 });
    if ("youtube" in p.data) {
      const t = await transcripcionYouTube(p.data.youtube);
      if (!t.ok) return NextResponse.json({ error: t.error }, { status: 422 });
      const r = await agregarTexto({ tipo: "youtube", titulo: t.titulo, fuente: p.data.youtube, formato: p.data.formato, contenido: t.texto, por });
      return r.ok ? NextResponse.json({ ok: true, titulo: t.titulo, palabras: r.palabras, automatica: t.automatica }) : NextResponse.json({ error: r.error, duplicado: r.duplicado }, { status: r.duplicado ? 409 : 422 });
    }
    const r = await agregarTexto({ tipo: p.data.fuente?.includes("youtu") ? "youtube" : "texto", titulo: p.data.titulo, fuente: p.data.fuente ?? null, formato: p.data.formato, contenido: p.data.texto, por });
    return r.ok ? NextResponse.json({ ok: true, palabras: r.palabras }) : NextResponse.json({ error: r.error, duplicado: r.duplicado }, { status: r.duplicado ? 409 : 422 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo leer el archivo." }, { status: 422 });
  }
}
