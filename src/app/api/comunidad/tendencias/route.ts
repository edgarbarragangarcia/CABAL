import { NextResponse } from "next/server";

import { errorJson, exigirMiembro } from "@/lib/comunidad/api";
import { tendencias } from "@/lib/comunidad/tendencias";

export const runtime = "nodejs";

/** Qué está en tendencia (publicaciones, temas, grupos y voces) en los últimos 7 días, para el afiliado con sesión. */
export async function GET() {
  const yo = await exigirMiembro();
  if (yo instanceof NextResponse) return yo;
  try {
    return NextResponse.json(await tendencias(yo.id, 7), { headers: { "Cache-Control": "private, max-age=45" } });
  } catch (e) {
    return errorJson(e);
  }
}
