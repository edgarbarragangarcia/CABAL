import { NextResponse } from "next/server";
import { z } from "zod";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { enviarPrueba, obtenerBoletin } from "@/lib/portales/crm/boletines";
import { obtener } from "@/lib/portales/store";

export const runtime = "nodejs";

/** Manda el boletín a una sola dirección (la de quien lo prepara) para ver cómo llega. No toca a la comunidad. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; boletinId: string }> }) {
  const { id, boletinId } = await params;
  if (!UUID.test(id) || !UUID.test(boletinId)) return idNoValido();
  const p = z.object({ correo: z.string().trim().toLowerCase().email("Correo no válido.").max(160) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    const [portal, boletin] = await Promise.all([obtener(id), obtenerBoletin(id, boletinId)]);
    await enviarPrueba({ portal, origen: new URL(req.url).origin }, boletin, p.data.correo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
