import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { eventoSchema } from "@/lib/portales/crm/tipos";
import { crearEvento, listarEventos } from "@/lib/portales/crm/store";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    return NextResponse.json({ eventos: await listarEventos(id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = eventoSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ evento: await crearEvento(id, p.data) }, { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}
