import { NextResponse } from "next/server";

import { respuestaError } from "@/lib/portales/cms/rutas";
import { resumenPortales } from "@/lib/portales/cms/store";

export const runtime = "nodejs";

/** Las cifras de cada portal para el centro de operaciones: artículos, lecturas, anuncios, clics en «Súmate» y afiliados traídos. */
export async function GET() {
  try {
    return NextResponse.json({ resumen: await resumenPortales() });
  } catch (e) {
    return respuestaError(e);
  }
}
