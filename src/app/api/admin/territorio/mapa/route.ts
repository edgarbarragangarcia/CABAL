import { NextResponse } from "next/server";

import { ELECCIONES_MAPA, votosCabalPorLugar } from "@/lib/territorio/mapa";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Votos de María Fernanda por departamento (`?id=co`) o por municipio de un departamento (`?id=13`), para pintar el mapa. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const id = p.get("id") ?? "co";
  const eleccion = p.get("eleccion") ?? ELECCIONES_MAPA[0].id;
  if (!/^(co|\d{2})$/.test(id) || !ELECCIONES_MAPA.some((e) => e.id === eleccion)) return NextResponse.json({ error: "Lugar o elección no válidos." }, { status: 422 });
  try {
    return NextResponse.json({ ...(await votosCabalPorLugar(eleccion, id)), elecciones: ELECCIONES_MAPA }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer los votos." }, { status: 502 });
  }
}
