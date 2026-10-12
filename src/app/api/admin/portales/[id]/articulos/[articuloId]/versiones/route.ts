import { NextResponse } from "next/server";

import { UUID, idNoValido, respuestaError } from "@/lib/portales/cms/rutas";
import { listarVersiones } from "@/lib/portales/cms/store";

export const runtime = "nodejs";

/** El historial de un artículo: las versiones anteriores, para compararlas y restaurarlas. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; articuloId: string }> }) {
  const { id, articuloId } = await params;
  if (!UUID.test(id) || !UUID.test(articuloId)) return idNoValido();
  try {
    return NextResponse.json({ versiones: await listarVersiones(id, articuloId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}
