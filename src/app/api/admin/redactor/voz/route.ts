import { NextResponse } from "next/server";
import { z } from "zod";

import { verificarVoz } from "@/lib/voz/huella";
import { huellaActual } from "@/lib/voz/store";

export const runtime = "nodejs";

/** Comprueba, con código, si un texto suena a la Dra.: largo de frases, vocabulario ajeno, giros de máquina y expresiones suyas. */
export async function POST(req: Request) {
  const p = z.object({ texto: z.string().max(60_000) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Texto no válido." }, { status: 422 });
  const h = await huellaActual();
  if (!h) return NextResponse.json({ verificacion: null });
  return NextResponse.json({ verificacion: verificarVoz(p.data.texto, h) }, { headers: { "Cache-Control": "private, no-store" } });
}
