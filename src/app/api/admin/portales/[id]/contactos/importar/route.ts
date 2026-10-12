import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { importacionSchema } from "@/lib/portales/crm/tipos";
import { importarContactos } from "@/lib/portales/crm/store";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Importa una lista de personas (hasta 1.000 por vez). Quien la sube confirma que tiene su autorización. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = importacionSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json(await importarContactos(id, p.data.filas, (await usuarioActual()) ?? ""));
  } catch (e) {
    return respuestaError(e);
  }
}
