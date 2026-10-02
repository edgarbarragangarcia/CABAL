import { NextResponse } from "next/server";

import { investigarReaccion } from "@/lib/monitoreo/reaccion";

export const maxDuration = 120;

/** POST: dispara una investigación de IA con búsqueda web (de pago); nunca se lanza sola. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { forzar?: boolean } | null;
  try {
    return NextResponse.json(await investigarReaccion({ forzar: !!body?.forzar }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible completar la investigación." }, { status: 502 });
  }
}
