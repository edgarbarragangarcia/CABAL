import { NextResponse } from "next/server";
import { z } from "zod";

import { UUID, idNoValido, respuestaError } from "@/lib/portales/cms/rutas";
import { enviarBoletin } from "@/lib/portales/crm/boletines";
import { obtener } from "@/lib/portales/store";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Envía el boletín a su segmento. Exige `confirmar: true`: es una acción que sale hacia afuera y no se deshace. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; boletinId: string }> }) {
  const { id, boletinId } = await params;
  if (!UUID.test(id) || !UUID.test(boletinId)) return idNoValido();
  const p = z.object({ confirmar: z.literal(true) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Falta la confirmación del envío." }, { status: 422 });
  try {
    const portal = await obtener(id);
    if (portal.estado !== "publicado") return NextResponse.json({ error: "El portal debe estar en línea para enviar boletines: los correos llevan enlaces a él." }, { status: 409 });
    const boletin = await enviarBoletin({ portal, origen: new URL(req.url).origin }, boletinId, (await usuarioActual()) ?? "");
    return NextResponse.json({ boletin });
  } catch (e) {
    return respuestaError(e);
  }
}
