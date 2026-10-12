import { NextResponse } from "next/server";

import { mapaDeDatos } from "@/lib/gestor/mapa";

export const maxDuration = 60;

/** Qué hay en Supabase: módulos, tablas y cuántas filas tiene cada una. */
export async function GET() {
  try {
    return NextResponse.json(await mapaDeDatos(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer Supabase." }, { status: 502 });
  }
}
