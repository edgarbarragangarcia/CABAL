import { NextResponse } from "next/server";

import { personajes } from "@/lib/monitoreo/personajes";

export const maxDuration = 60;

/** Publicaciones en X y prensa de los personajes políticos de la lista base. `?forzar=1` ignora la memoria de 30 minutos. */
export async function GET(req: Request) {
  const forzar = new URL(req.url).searchParams.get("forzar") === "1";
  try {
    return NextResponse.json(await personajes(forzar), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible consultar." }, { status: 502 });
  }
}
