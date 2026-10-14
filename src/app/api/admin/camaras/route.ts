import { NextResponse } from "next/server";
import { z } from "zod";

import { cargarCamara, leerCamaras } from "@/lib/camaras/almacen";
import { CAMARAS } from "@/lib/camaras/catalogo";

export const maxDuration = 60;
const nc = { headers: { "Cache-Control": "private, no-store" } };

/** Las cámaras guardadas y la lista de las 58 por cargar. */
export async function GET() {
  return NextResponse.json({ ...(await leerCamaras()), codigos: CAMARAS.map((c) => c.codigo) }, nc);
}

/** POST { codigo }: trae de datos.gov.co y guarda una cámara. */
export async function POST(req: Request) {
  const p = z.object({ codigo: z.string().regex(/^\d{2}$/) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Código de cámara no válido." }, { status: 422 });
  try {
    return NextResponse.json({ camara: await cargarCamara(p.data.codigo) }, nc);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo cargar la cámara." }, { status: 502 });
  }
}
