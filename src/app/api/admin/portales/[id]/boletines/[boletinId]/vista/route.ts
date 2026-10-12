import { NextResponse } from "next/server";

import { UUID, idNoValido, respuestaError } from "@/lib/portales/cms/rutas";
import { obtenerBoletin, vistaPrevia } from "@/lib/portales/crm/boletines";
import { obtener } from "@/lib/portales/store";

export const runtime = "nodejs";

/** El boletín tal como llegará por correo (HTML y texto), con un enlace de baja de ejemplo. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; boletinId: string }> }) {
  const { id, boletinId } = await params;
  if (!UUID.test(id) || !UUID.test(boletinId)) return idNoValido();
  try {
    const [portal, boletin] = await Promise.all([obtener(id), obtenerBoletin(id, boletinId)]);
    return NextResponse.json(await vistaPrevia({ portal, origen: new URL(req.url).origin }, boletin), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}
