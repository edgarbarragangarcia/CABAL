import { NextResponse } from "next/server";

import { ajustesSchema } from "@/lib/portales/cms/tipos";
import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { guardarAjustes, leerAjustes } from "@/lib/portales/cms/store";
import { obtener } from "@/lib/portales/store";

export const runtime = "nodejs";

/** Los ajustes del CMS del portal (llamado a sumarse a la comunidad, guía de la IA, buscadores). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    await obtener(id);
    return NextResponse.json({ ajustes: await leerAjustes(id) });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = ajustesSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    await obtener(id);
    return NextResponse.json({ ajustes: await guardarAjustes(id, p.data) });
  } catch (e) {
    return respuestaError(e);
  }
}
