import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { actualizarPagina, eliminarPagina, obtenerPagina } from "@/lib/portales/cms/paginas";
import { paginaSchema } from "@/lib/portales/cms/paginas-tipos";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; paginaId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, paginaId } = await params;
  if (!UUID.test(id) || !UUID.test(paginaId)) return idNoValido();
  try {
    return NextResponse.json({ pagina: await obtenerPagina(id, paginaId) });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function PUT(req: Request, { params }: Params) {
  const { id, paginaId } = await params;
  if (!UUID.test(id) || !UUID.test(paginaId)) return idNoValido();
  const p = paginaSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ pagina: await actualizarPagina(id, paginaId, p.data) });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, paginaId } = await params;
  if (!UUID.test(id) || !UUID.test(paginaId)) return idNoValido();
  try {
    await eliminarPagina(id, paginaId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
