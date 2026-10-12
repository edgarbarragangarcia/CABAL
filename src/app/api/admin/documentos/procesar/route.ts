import { NextResponse } from "next/server";
import { z } from "zod";

import { marcarVigente } from "@/lib/documentos/gestor";
import { MAX_PARTES, procesarDocumento } from "@/lib/documentos/servicio";

export const runtime = "nodejs";
// Sacar el texto de un PDF grande y dividirlo puede tardar.
export const maxDuration = 60;

const cuerpo = z.object({ id: z.string().uuid(), partes: z.number().int().min(1).max(MAX_PARTES) });

/** POST { id, partes }: con el archivo ya subido, saca su texto y lo divide en fragmentos (todavía sin vectorizar). */
export async function POST(req: Request) {
  const p = cuerpo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 422 });
  try {
    const doc = await procesarDocumento(p.data.id, p.data.partes);
    // Una versión nueva pasa a ser la vigente cuando ya tiene su texto (las anteriores quedan en el historial).
    await marcarVigente(doc).catch(() => {});
    return NextResponse.json({ documento: doc });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible procesar el documento." }, { status: 422 });
  }
}
