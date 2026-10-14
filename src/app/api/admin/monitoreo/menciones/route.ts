import { NextResponse } from "next/server";

import { mencionesDelArchivo, mencionesWeb } from "@/lib/monitoreo/menciones-web";

export const maxDuration = 60;

/** Dónde nombran a María Fernanda Cabal (prensa, redes públicas indexadas, YouTube). `?forzar=1` ignora la memoria de 15 minutos. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const forzar = q.get("forzar") === "1";
  try {
    // `?archivo=1`: solo lo guardado en Supabase (rápido, sin salir a buscar). Si el archivo está vacío, se busca en vivo.
    if (q.get("archivo") === "1") {
      const guardado = await mencionesDelArchivo();
      if (guardado) return NextResponse.json({ ...guardado, delArchivo: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json(await mencionesWeb(forzar), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error && e.message) || "No fue posible consultar las fuentes." }, { status: 502 });
  }
}
