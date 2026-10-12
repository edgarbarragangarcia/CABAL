import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { masivoSchema } from "@/lib/portales/crm/tipos";
import { cambioMasivo } from "@/lib/portales/crm/store";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";

/** Cambia la etapa, agrega etiquetas o elimina a varias personas a la vez. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = masivoSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  if (!p.data.eliminar && !p.data.etapa && !p.data.agregarEtiquetas?.length) return NextResponse.json({ error: "Elige qué cambiar." }, { status: 422 });
  try {
    return NextResponse.json({ afectados: await cambioMasivo(id, p.data, (await usuarioActual()) ?? "") });
  } catch (e) {
    return respuestaError(e);
  }
}
