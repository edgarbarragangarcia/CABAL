import { NextResponse } from "next/server";
import { z } from "zod";

import { responder } from "@/lib/asistente-voz/responder";

export const runtime = "nodejs";
export const maxDuration = 60;

const pedido = z.object({
  pregunta: z.string().trim().min(2).max(1000),
  historial: z.array(z.object({ rol: z.enum(["usuario", "asistente"]), texto: z.string().max(1500) })).max(12).default([]),
  adjunto: z.object({ nombre: z.string().max(200), texto: z.string().max(170_000) }).optional(),
});

/** La pregunta (ya transcrita) y la conversación hasta ahora → la respuesta escrita lista para hablarse. Solo lectura. */
export async function POST(req: Request) {
  const p = pedido.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Pregunta no válida." }, { status: 422 });
  try {
    return NextResponse.json(await responder(p.data.pregunta, p.data.historial, p.data.adjunto), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible responder." }, { status: 502 });
  }
}
