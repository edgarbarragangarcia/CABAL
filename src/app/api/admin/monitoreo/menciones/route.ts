import { NextResponse } from "next/server";

import { mencionesWeb } from "@/lib/monitoreo/menciones-web";

export const maxDuration = 60;

/** Dónde nombran a María Fernanda Cabal (prensa, redes públicas indexadas, YouTube). `?forzar=1` ignora la memoria de 15 minutos. */
export async function GET(req: Request) {
  const forzar = new URL(req.url).searchParams.get("forzar") === "1";
  try {
    return NextResponse.json(await mencionesWeb(forzar), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error && e.message) || "No fue posible consultar las fuentes." }, { status: 502 });
  }
}
