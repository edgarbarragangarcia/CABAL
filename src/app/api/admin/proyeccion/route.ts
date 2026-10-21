import { NextResponse } from "next/server";

import { proyectar, SinDatosDane } from "@/lib/proyeccion/modelo";

export const runtime = "nodejs";
export const maxDuration = 60;

/** El censo electoral proyectado a 2030 por municipio y por edad (DANE + Registraduría). */
export async function GET() {
  try {
    return NextResponse.json(await proyectar(), { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (e) {
    if (e instanceof SinDatosDane) return NextResponse.json({ error: e.message, sinDatos: true }, { status: 409 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible calcular la proyección." }, { status: 502 });
  }
}
