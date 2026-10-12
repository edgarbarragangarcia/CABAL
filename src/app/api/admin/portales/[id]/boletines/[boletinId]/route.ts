import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { boletinSchema } from "@/lib/portales/crm/boletines-tipos";
import { actualizarBoletin, eliminarBoletin, obtenerBoletin } from "@/lib/portales/crm/boletines";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; boletinId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id, boletinId } = await params;
  if (!UUID.test(id) || !UUID.test(boletinId)) return idNoValido();
  try {
    return NextResponse.json({ boletin: await obtenerBoletin(id, boletinId) });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function PUT(req: Request, { params }: Params) {
  const { id, boletinId } = await params;
  if (!UUID.test(id) || !UUID.test(boletinId)) return idNoValido();
  const p = boletinSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ boletin: await actualizarBoletin(id, boletinId, p.data) });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, boletinId } = await params;
  if (!UUID.test(id) || !UUID.test(boletinId)) return idNoValido();
  try {
    await eliminarBoletin(id, boletinId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
