import { NextResponse } from "next/server";

import { articuloSchema } from "@/lib/portales/cms/tipos";
import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { actualizarArticulo, eliminarArticulo, obtenerArticulo } from "@/lib/portales/cms/store";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; articuloId: string }> };

/** Un artículo completo, para editarlo. */
export async function GET(_req: Request, { params }: Params) {
  const { id, articuloId } = await params;
  if (!UUID.test(id) || !UUID.test(articuloId)) return idNoValido();
  try {
    return NextResponse.json({ articulo: await obtenerArticulo(id, articuloId) });
  } catch (e) {
    return respuestaError(e);
  }
}

/** Guarda el artículo completo (el panel siempre manda todos los campos). */
export async function PUT(req: Request, { params }: Params) {
  const { id, articuloId } = await params;
  if (!UUID.test(id) || !UUID.test(articuloId)) return idNoValido();
  const p = articuloSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ articulo: await actualizarArticulo(id, articuloId, p.data, (await usuarioActual()) ?? "") });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, articuloId } = await params;
  if (!UUID.test(id) || !UUID.test(articuloId)) return idNoValido();
  try {
    await eliminarArticulo(id, articuloId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
