import { NextResponse } from "next/server";

import { clasificarTonos } from "@/lib/monitoreo/tono-ia";

export const maxDuration = 60;

/** Mide con IA el tono de una lista de titulares: `{ textos: string[] }` → `{ tonos: ("positivo"|"neutral"|"negativo"|null)[] }`. */
export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as { textos?: unknown } | null;
  const textos = Array.isArray(cuerpo?.textos) ? cuerpo.textos.filter((t): t is string => typeof t === "string").slice(0, 400) : [];
  if (textos.length === 0) return NextResponse.json({ error: "No hay textos para medir." }, { status: 400 });
  try {
    return NextResponse.json({ tonos: await clasificarTonos(textos) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error && e.message) || "No fue posible medir el tono." }, { status: 502 });
  }
}
