import { NextResponse } from "next/server";

import { redes } from "@/lib/monitoreo/redes";
import { sentimientoDe } from "@/lib/monitoreo/sentimiento";

export const maxDuration = 60;

/** Redes sociales con credenciales propias (YouTube y X); cada una responde por separado. */
export async function GET() {
  return NextResponse.json(await redes(), { headers: { "Cache-Control": "private, no-store" } });
}

/** Tono de las publicaciones y comentarios recientes, clasificado por la IA configurada. */
export async function POST() {
  try {
    const r = await redes();
    const textos = [
      ...(r.x.estado === "ok" ? r.x.datos.recientes : []),
      ...(r.youtube.estado === "ok" ? r.youtube.datos.comentarios : []),
    ].map((p) => ({ titulo: p.texto.replace(/\s+/g, " ").slice(0, 280), medio: p.autor, fecha: p.fecha, enlace: p.enlace }));
    if (textos.length === 0) return NextResponse.json({ error: "Conecta YouTube o X en Configuración para analizar publicaciones." }, { status: 400 });
    return NextResponse.json(await sentimientoDe(textos, "publicaciones"));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible clasificar." }, { status: 502 });
  }
}
