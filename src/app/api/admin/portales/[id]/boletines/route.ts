import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { boletinSchema } from "@/lib/portales/crm/boletines-tipos";
import { crearBoletin, listarBoletines } from "@/lib/portales/crm/boletines";
import { correoConfigurado } from "@/lib/portales/crm/correo";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    const c = correoConfigurado();
    return NextResponse.json({ boletines: await listarBoletines(id), correo: { listo: c.listo, desde: c.desde } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = boletinSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ boletin: await crearBoletin(id, p.data, (await usuarioActual()) ?? "") }, { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}
