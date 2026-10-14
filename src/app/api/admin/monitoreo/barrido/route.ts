import { NextResponse } from "next/server";

import { barridoCiudades, TANDAS_BARRIDO } from "@/lib/monitoreo/menciones-web";

export const maxDuration = 60;

/** Una tanda de la búsqueda a fondo por ciudades: `?tanda=0`, `1`… hasta `tandas - 1`. */
export async function GET(req: Request) {
  const tanda = Number(new URL(req.url).searchParams.get("tanda") ?? "0");
  if (!Number.isInteger(tanda) || tanda < 0 || tanda >= TANDAS_BARRIDO) return NextResponse.json({ error: "Tanda fuera de rango." }, { status: 400 });
  try {
    return NextResponse.json(await barridoCiudades(tanda), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error && e.message) || "No fue posible consultar las fuentes." }, { status: 502 });
  }
}
