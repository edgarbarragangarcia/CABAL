import { NextResponse } from "next/server";
import { z } from "zod";

import { quienEs } from "@/lib/redactor/permisos";
import { guardarNota, leerNota } from "@/lib/redactor/store";

export const runtime = "nodejs";

const pedido = z.object({
  id: z.string().uuid(),
  accion: z.enum(["revision", "aprobar", "devolver", "publicada", "reabrir", "programar"]),
  enlace: z.string().trim().max(800).optional(),
  motivo: z.string().trim().max(500).optional(),
  programadaPara: z.string().datetime({ offset: true }).nullable().optional(),
});

/**
 * El flujo del equipo: borrador → revisión → aprobada → publicada. Aprobar y devolver son de Dirección; publicar siempre es a mano
 * (se publica en la red y aquí se anota el enlace): el Redactor nunca publica.
 */
export async function POST(req: Request) {
  const p = pedido.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  const { id, accion } = p.data;
  const nota = await leerNota(id);
  if (!nota) return NextResponse.json({ error: "La nota no existe." }, { status: 404 });
  const { email, esDireccion } = await quienEs();
  try {
    if (accion === "revision") {
      if (nota.generadaConIa && !nota.revisada) return NextResponse.json({ error: "Marca «Lo revisé» antes de enviarla a revisión: la IA no revisa su propio trabajo." }, { status: 422 });
      return NextResponse.json({ nota: await guardarNota(id, { estado: "revision", notaRevision: null }, null) });
    }
    if (accion === "aprobar" || accion === "devolver") {
      if (!esDireccion) return NextResponse.json({ error: "Solo Dirección aprueba o devuelve las piezas." }, { status: 403 });
      if (nota.estado !== "revision") return NextResponse.json({ error: "Solo se aprueba lo que está en revisión." }, { status: 422 });
      if (accion === "devolver") return NextResponse.json({ nota: await guardarNota(id, { estado: "borrador", notaRevision: p.data.motivo || "Devuelta sin comentarios." }, null) });
      return NextResponse.json({ nota: await guardarNota(id, { estado: "aprobada", aprobadaPor: email, aprobadaEn: new Date().toISOString() }, null) });
    }
    if (accion === "publicada") {
      if (nota.estado !== "aprobada") return NextResponse.json({ error: "Solo se marca como publicada una pieza aprobada." }, { status: 422 });
      return NextResponse.json({ nota: await guardarNota(id, { estado: "publicada", enlacePublicado: p.data.enlace ?? "", publicadaEn: new Date().toISOString() }, null) });
    }
    if (accion === "reabrir") {
      if (!esDireccion) return NextResponse.json({ error: "Solo Dirección reabre una pieza." }, { status: 403 });
      return NextResponse.json({ nota: await guardarNota(id, { estado: "borrador", aprobadaPor: null, aprobadaEn: null, publicadaEn: null }, null) });
    }
    return NextResponse.json({ nota: await guardarNota(id, { programadaPara: p.data.programadaPara ?? null }, null) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo completar la acción." }, { status: 502 });
  }
}
