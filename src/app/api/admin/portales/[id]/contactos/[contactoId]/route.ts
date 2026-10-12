import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { contactoSchema } from "@/lib/portales/crm/tipos";
import { actualizarContacto, eliminarContacto, obtenerContacto } from "@/lib/portales/crm/store";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; contactoId: string }> };

/** La ficha de una persona: sus datos, su historial y los eventos en que participó. */
export async function GET(_req: Request, { params }: Params) {
  const { id, contactoId } = await params;
  if (!UUID.test(id) || !UUID.test(contactoId)) return idNoValido();
  try {
    return NextResponse.json(await obtenerContacto(id, contactoId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function PUT(req: Request, { params }: Params) {
  const { id, contactoId } = await params;
  if (!UUID.test(id) || !UUID.test(contactoId)) return idNoValido();
  const p = contactoSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ contacto: await actualizarContacto(id, contactoId, p.data, (await usuarioActual()) ?? "") });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, contactoId } = await params;
  if (!UUID.test(id) || !UUID.test(contactoId)) return idNoValido();
  try {
    await eliminarContacto(id, contactoId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
