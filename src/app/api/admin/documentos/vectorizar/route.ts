import { NextResponse } from "next/server";
import { z } from "zod";

import { vectorizarPendientes } from "@/lib/documentos/servicio";

export const runtime = "nodejs";
// Cada llamada vectoriza durante unos 40 s; el navegador repite hasta que termine.
export const maxDuration = 60;

const cuerpo = z.object({ id: z.string().uuid() });

/** POST { id }: vectoriza los fragmentos que falten y devuelve el avance; repetir hasta `listo`. */
export async function POST(req: Request) {
  const p = cuerpo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Documento no válido." }, { status: 422 });
  try {
    return NextResponse.json(await vectorizarPendientes(p.data.id));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible vectorizar." }, { status: 502 });
  }
}
