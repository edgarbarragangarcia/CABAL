import { NextResponse } from "next/server";

import { hayCrm, resumenCrm } from "@/lib/portales/crm/store";
import { SQL_PORTALES_CRM } from "@/lib/portales/crm/sql";
import { UUID, idNoValido, respuestaError } from "@/lib/portales/cms/rutas";

export const runtime = "nodejs";

/** ¿Está creado el CRM en Supabase? Con tablas, trae también las cifras del portal; sin ellas, el SQL que falta ejecutar. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    if (!(await hayCrm())) return NextResponse.json({ disponible: false, sql: SQL_PORTALES_CRM });
    return NextResponse.json({ disponible: true, resumen: await resumenCrm(id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}
