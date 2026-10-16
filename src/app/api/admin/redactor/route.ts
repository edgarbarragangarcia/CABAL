import { NextResponse } from "next/server";
import { z } from "zod";

import { usuarioActual } from "@/lib/documentos/usuario";
import { borrarNota, guardarNota, leerNota, listarNotas } from "@/lib/redactor/store";

export const runtime = "nodejs";
const nc = { headers: { "Cache-Control": "private, no-store" } };

/** Las notas guardadas; con `?id=` una sola. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const nota = await leerNota(id);
    return nota ? NextResponse.json({ nota }, nc) : NextResponse.json({ error: "La nota no existe." }, { status: 404 });
  }
  return NextResponse.json(await listarNotas(), nc);
}

const nota = z.object({
  id: z.string().uuid().nullable().optional(),
  titulo: z.string().max(200).optional(),
  resumen: z.string().max(600).optional(),
  cuerpo: z.string().max(60_000).optional(),
  claves: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  palabraClave: z.string().max(80).optional(),
  portadaUrl: z.string().max(600).optional(),
  portadaAlt: z.string().max(300).optional(),
  seccion: z.string().max(60).optional(),
  region: z.string().max(80).optional(),
  seoTitulo: z.string().max(120).optional(),
  seoDescripcion: z.string().max(300).optional(),
  grafica: z.unknown().optional(),
  material: z.string().max(60_000).optional(),
  fuentes: z.array(z.object({ titulo: z.string().max(300), url: z.string().max(800) })).max(40).optional(),
  modo: z.enum(["manual", "ia"]).optional(),
  tono: z.string().max(40).optional(),
  estado: z.enum(["borrador", "revision"]).optional(),
  generadaConIa: z.boolean().optional(),
  revisada: z.boolean().optional(),
});

/** Guarda (crea o actualiza) una nota. Nunca publica: publicar es una acción aparte, en el portal. */
export async function POST(req: Request) {
  const p = nota.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  const { id, ...datos } = p.data;
  try {
    return NextResponse.json({ nota: await guardarNota(id ?? null, datos, await usuarioActual()) }, nc);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return (await borrarNota(id)) ? NextResponse.json({ ok: true }, nc) : NextResponse.json({ error: "No se pudo borrar." }, { status: 502 });
}
