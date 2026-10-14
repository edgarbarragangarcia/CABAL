import { NextResponse } from "next/server";

import { enriquecerFichas, estadoArchivo, medirTonos } from "@/lib/monitoreo/archivo";

export const maxDuration = 60;

/** El estado del archivo de menciones en Supabase (qué hay, qué falta analizar). */
export async function GET() {
  try {
    return NextResponse.json(await estadoArchivo(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error && e.message) || "No fue posible leer el archivo." }, { status: 502 });
  }
}

/** `{ accion: "fichas" | "tono" }`: completa un lote del archivo y dice cuánto falta. */
export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as { accion?: string } | null;
  try {
    if (cuerpo?.accion === "fichas") return NextResponse.json(await enriquecerFichas(12), { headers: { "Cache-Control": "private, no-store" } });
    if (cuerpo?.accion === "tono") return NextResponse.json(await medirTonos(50), { headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ error: "Acción no válida." }, { status: 422 });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error && e.message) || "No fue posible completar el paso." }, { status: 502 });
  }
}
