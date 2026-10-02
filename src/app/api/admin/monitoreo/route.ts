import { NextResponse } from "next/server";

import { monitoreo } from "@/lib/monitoreo";
import { sentimientoDe } from "@/lib/monitoreo/sentimiento";

export const maxDuration = 60;

/** Datos reales del monitoreo (directo de YouTube, noticias, videos, Wikipedia). `?forzar=1` ignora la memoria de 2 minutos. */
export async function GET(req: Request) {
  const forzar = new URL(req.url).searchParams.get("forzar") === "1";
  try {
    return NextResponse.json(await monitoreo(new Date(), { forzar }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible consultar las fuentes." }, { status: 502 });
  }
}

/** POST: clasifica con IA el tono de los titulares de los últimos 30 días. */
export async function POST() {
  try {
    const datos = await monitoreo();
    return NextResponse.json(await sentimientoDe(datos.ultimasNoticias));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible clasificar el sentimiento." }, { status: 502 });
  }
}
