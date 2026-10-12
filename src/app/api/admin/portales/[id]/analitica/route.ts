import { NextResponse } from "next/server";

import { analiticaDe } from "@/lib/portales/cms/analitica";
import { UUID, idNoValido, respuestaError } from "@/lib/portales/cms/rutas";

export const runtime = "nodejs";

/** Visitas, clics, personas nuevas y artículos más leídos del portal en los últimos 7, 30 o 90 días. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    const dias = Number(new URL(req.url).searchParams.get("dias")) || 30;
    return NextResponse.json(await analiticaDe(id, dias), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}
