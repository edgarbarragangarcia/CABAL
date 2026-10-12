import { NextResponse } from "next/server";
import { z } from "zod";

import { buscarEnDocumentos } from "@/lib/documentos/servicio";

export const runtime = "nodejs";
export const maxDuration = 30;

const cuerpo = z.object({
  consulta: z.string().trim().min(2).max(1000),
  cantidad: z.number().int().min(1).max(20).default(8),
  documento: z.string().uuid().optional(),
});

/** POST { consulta, cantidad?, documento? }: los fragmentos de los documentos más parecidos, por significado. */
export async function POST(req: Request) {
  const p = cuerpo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Escribe una consulta de al menos dos letras." }, { status: 422 });
  try {
    return NextResponse.json(await buscarEnDocumentos(p.data.consulta, p.data.cantidad, p.data.documento));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible buscar." }, { status: 502 });
  }
}
