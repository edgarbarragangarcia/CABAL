import { NextResponse } from "next/server";
import { z } from "zod";

import { preguntar } from "@/lib/documentos/gestor";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST { pregunta, documento? }: responde solo con lo que dicen los documentos y cita cada fuente con su número. */
export async function POST(req: Request) {
  const p = z.object({ pregunta: z.string().trim().min(3).max(1000), documento: z.string().uuid().optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Escribe una pregunta de al menos tres letras." }, { status: 422 });
  try {
    return NextResponse.json(await preguntar(p.data.pregunta, p.data.documento));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible responder." }, { status: 502 });
  }
}
