import { NextResponse } from "next/server";

import { comunidadConfigurada } from "@/lib/comunidad/store";
import { inteligencia } from "@/lib/comunidad/inteligencia";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Panel de decisión de la comunidad. `/api/admin/*` ya exige la sesión del panel (src/proxy.ts). */
export async function GET(req: Request) {
  if (!comunidadConfigurada()) return NextResponse.json({ configurada: false });
  const d = Number(new URL(req.url).searchParams.get("dias"));
  const dias = [7, 14, 30].includes(d) ? d : 7;
  try {
    return NextResponse.json({ configurada: true, ...(await inteligencia(dias)) });
  } catch (e) {
    console.error("[inteligencia]", e);
    return NextResponse.json({ configurada: true, error: "No se pudo calcular. ¿Ejecutaste supabase/comunidad.sql?" }, { status: 500 });
  }
}
