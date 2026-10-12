import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { eventoSchema } from "@/lib/portales/crm/tipos";
import { actualizarEvento, eliminarEvento, inscripcionesDe, obtenerEvento } from "@/lib/portales/crm/store";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; eventoId: string }> };

/** El evento con su lista de inscritos. */
export async function GET(_req: Request, { params }: Params) {
  const { id, eventoId } = await params;
  if (!UUID.test(id) || !UUID.test(eventoId)) return idNoValido();
  try {
    const [evento, inscripciones] = await Promise.all([obtenerEvento(id, eventoId), inscripcionesDe(id, eventoId)]);
    return NextResponse.json({ evento, inscripciones }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function PUT(req: Request, { params }: Params) {
  const { id, eventoId } = await params;
  if (!UUID.test(id) || !UUID.test(eventoId)) return idNoValido();
  const p = eventoSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ evento: await actualizarEvento(id, eventoId, p.data) });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, eventoId } = await params;
  if (!UUID.test(id) || !UUID.test(eventoId)) return idNoValido();
  try {
    await eliminarEvento(id, eventoId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
