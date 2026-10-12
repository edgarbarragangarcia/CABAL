import { NextResponse } from "next/server";
import { z } from "zod";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { ESTADOS_INSCRIPCION } from "@/lib/portales/crm/tipos";
import { marcarInscripcion } from "@/lib/portales/crm/store";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";

const schema = z.object({ contactoId: z.string().uuid(), estado: z.enum(ESTADOS_INSCRIPCION) });

/** El equipo marca si la persona asistió, no asistió o canceló. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string; eventoId: string }> }) {
  const { id, eventoId } = await params;
  if (!UUID.test(id) || !UUID.test(eventoId)) return idNoValido();
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    await marcarInscripcion(id, eventoId, p.data.contactoId, p.data.estado, (await usuarioActual()) ?? "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
