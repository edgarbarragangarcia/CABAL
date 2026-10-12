import { NextResponse } from "next/server";

import { buscar } from "@/lib/territorio/jerarquia";

export const runtime = "nodejs";

/** Lugares por nombre (departamento, municipio, localidad, barrio de Bogotá o puesto): `?q=bogota`. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80);
  return NextResponse.json({ resultados: await buscar(q, 10) }, { headers: { "Cache-Control": "private, max-age=300" } });
}
