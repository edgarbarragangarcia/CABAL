import { NextResponse } from "next/server";

import { fichasDeVideos } from "@/lib/monitoreo/ficha-video";

export const maxDuration = 60;

/** Fichas completas de videos de YouTube (fecha exacta, me gusta, suscriptores…). `?ids=a,b,c` (hasta 12). */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => /^[\w-]{6,15}$/.test(s)).slice(0, 12);
  if (ids.length === 0) return NextResponse.json({ fichas: {} });
  try {
    return NextResponse.json({ fichas: await fichasDeVideos(ids) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error && e.message) || "No fue posible leer los videos." }, { status: 502 });
  }
}
