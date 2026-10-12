import { NextResponse } from "next/server";
import { z } from "zod";

import { obtenerDocumento } from "@/lib/documentos/almacen";
import { eventosDe, fragmentosDe, versionesDe } from "@/lib/documentos/gestor";

export const runtime = "nodejs";

/** Lo que muestra el panel de un documento: sus versiones, su historial y los primeros fragmentos de su texto. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Documento no válido." }, { status: 422 });
  try {
    const doc = await obtenerDocumento(id);
    if (!doc) return NextResponse.json({ error: "Ese documento no existe." }, { status: 404 });
    const [versiones, eventos, fragmentos] = await Promise.all([versionesDe(doc), eventosDe(id).catch(() => []), fragmentosDe(id, 5)]);
    return NextResponse.json({ versiones, eventos, fragmentos });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer el documento." }, { status: 502 });
  }
}
