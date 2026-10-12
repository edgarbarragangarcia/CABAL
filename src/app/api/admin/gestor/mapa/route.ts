import { NextResponse } from "next/server";

import { mapaDeDatos, resumenElectoral } from "@/lib/gestor/mapa";

export const maxDuration = 60;

/** Qué hay en Supabase: módulos, qué contiene cada uno y sus tablas. `?solo=electoral` devuelve solo el resumen de los datos electorales. */
export async function GET(req: Request) {
  try {
    if (new URL(req.url).searchParams.get("solo") === "electoral") return NextResponse.json(await resumenElectoral(), { headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json(await mapaDeDatos(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer Supabase." }, { status: 502 });
  }
}
