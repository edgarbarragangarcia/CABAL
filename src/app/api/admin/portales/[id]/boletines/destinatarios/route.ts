import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { segmentoSchema } from "@/lib/portales/crm/boletines-tipos";
import { destinatariosDe } from "@/lib/portales/crm/boletines";

export const runtime = "nodejs";

/** Cuántas personas recibirían un boletín con este segmento (solo cuentan quienes autorizaron comunicaciones). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = segmentoSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    const gente = await destinatariosDe(id, p.data);
    return NextResponse.json({ total: gente.length, muestra: gente.slice(0, 5).map((g) => g.nombre) });
  } catch (e) {
    return respuestaError(e);
  }
}
