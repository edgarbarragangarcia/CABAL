import { NextResponse } from "next/server";

import { anuncioSchema } from "@/lib/portales/cms/tipos";
import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { actualizarAnuncio, eliminarAnuncio } from "@/lib/portales/cms/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; anuncioId: string }> };

export async function PUT(req: Request, { params }: Params) {
  const { id, anuncioId } = await params;
  if (!UUID.test(id) || !UUID.test(anuncioId)) return idNoValido();
  const p = anuncioSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ anuncio: await actualizarAnuncio(id, anuncioId, p.data) });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, anuncioId } = await params;
  if (!UUID.test(id) || !UUID.test(anuncioId)) return idNoValido();
  try {
    await eliminarAnuncio(id, anuncioId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
