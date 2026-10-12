import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { interaccionSchema } from "@/lib/portales/crm/tipos";
import { agregarInteraccion } from "@/lib/portales/crm/store";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";

/** Anota algo en el historial de la persona: una nota, una llamada, un mensaje o una reunión. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; contactoId: string }> }) {
  const { id, contactoId } = await params;
  if (!UUID.test(id) || !UUID.test(contactoId)) return idNoValido();
  const p = interaccionSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ interaccion: await agregarInteraccion(id, contactoId, p.data.tipo, p.data.texto, (await usuarioActual()) ?? "") }, { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}
