import { NextResponse } from "next/server";
import { z } from "zod";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { actualizarAlt, eliminarMedio, medioPorId, usosDeMedio } from "@/lib/portales/cms/medios";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; medioId: string }> };

/** Cambia el texto alternativo (lo que lee un lector de pantalla y se ve si la imagen no carga). */
export async function PUT(req: Request, { params }: Params) {
  const { id, medioId } = await params;
  if (!UUID.test(id) || !UUID.test(medioId)) return idNoValido();
  const p = z.object({ alt: z.string().trim().max(160) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ medio: await actualizarAlt(id, medioId, p.data.alt) });
  } catch (e) {
    return respuestaError(e);
  }
}

/** Borra la imagen. Si algún artículo o página la usa, avisa (409) y solo la borra con `?forzar=1`. */
export async function DELETE(req: Request, { params }: Params) {
  const { id, medioId } = await params;
  if (!UUID.test(id) || !UUID.test(medioId)) return idNoValido();
  try {
    if (new URL(req.url).searchParams.get("forzar") !== "1") {
      const m = await medioPorId(id, medioId);
      if (m) {
        const usos = await usosDeMedio(id, m.url);
        if (usos.articulos.length + usos.paginas.length > 0) return NextResponse.json({ error: "Esta imagen está en uso.", usos }, { status: 409 });
      }
    }
    await eliminarMedio(id, medioId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
