import { NextResponse } from "next/server";
import { z } from "zod";

import { subirParte } from "@/lib/documentos/almacen";
import { MAX_PARTES, TAM_PARTE } from "@/lib/documentos/servicio";

export const runtime = "nodejs";
export const maxDuration = 30;

const consulta = z.object({ id: z.string().uuid(), n: z.coerce.number().int().min(0).max(MAX_PARTES) });

/** PUT ?id=&n= con una parte (hasta 3,5 MB) de un archivo grande: Vercel no admite más de 4,5 MB por petición. */
export async function PUT(req: Request) {
  const q = new URL(req.url).searchParams;
  const p = consulta.safeParse({ id: q.get("id"), n: q.get("n") });
  if (!p.success) return NextResponse.json({ error: "Parte no válida." }, { status: 422 });
  const datos = Buffer.from(await req.arrayBuffer());
  if (datos.length === 0) return NextResponse.json({ error: "La parte llegó vacía." }, { status: 422 });
  if (datos.length > TAM_PARTE + 1024) return NextResponse.json({ error: "La parte es demasiado grande." }, { status: 413 });
  try {
    await subirParte(p.data.id, p.data.n, datos);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible guardar la parte." }, { status: 502 });
  }
}
