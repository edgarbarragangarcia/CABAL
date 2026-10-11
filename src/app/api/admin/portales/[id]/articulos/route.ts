import { NextResponse } from "next/server";

import { articuloSchema } from "@/lib/portales/cms/tipos";
import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { crearArticulo, listarArticulos } from "@/lib/portales/cms/store";

export const runtime = "nodejs";

/** Los artículos del portal (sin el cuerpo). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    return NextResponse.json({ articulos: await listarArticulos(id) });
  } catch (e) {
    return respuestaError(e);
  }
}

/** Crea un artículo (borrador, o publicado si cumple lo mínimo). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = articuloSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ articulo: await crearArticulo(id, p.data) }, { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}
