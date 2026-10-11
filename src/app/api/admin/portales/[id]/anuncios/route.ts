import { NextResponse } from "next/server";

import { anuncioSchema } from "@/lib/portales/cms/tipos";
import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { crearAnuncio, listarAnuncios } from "@/lib/portales/cms/store";

export const runtime = "nodejs";

/** Los anuncios del portal, con sus impresiones y clics. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    return NextResponse.json({ anuncios: await listarAnuncios(id) });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = anuncioSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ anuncio: await crearAnuncio(id, p.data) }, { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}
