import { NextResponse } from "next/server";
import { z } from "zod";

import { usuarioActual } from "@/lib/documentos/usuario";
import { crearArticulo } from "@/lib/portales/cms/store";
import { guardarNota, leerNota } from "@/lib/redactor/store";

export const runtime = "nodejs";

/** Envía la nota a un portal como BORRADOR sin revisar: publicar sigue siendo una acción de una persona, en el portal. */
export async function POST(req: Request) {
  const p = z.object({ id: z.string().uuid(), portalId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Elige la nota y el portal." }, { status: 422 });
  const nota = await leerNota(p.data.id);
  if (!nota) return NextResponse.json({ error: "La nota no existe." }, { status: 404 });
  if (nota.titulo.trim().length < 3 || nota.cuerpo.trim().length < 50) return NextResponse.json({ error: "Escribe al menos el título y el cuerpo antes de enviarla." }, { status: 422 });
  try {
    const articulo = await crearArticulo(p.data.portalId, {
      titulo: nota.titulo.slice(0, 160), resumen: nota.resumen.slice(0, 400), cuerpo: nota.cuerpo, categoria: nota.seccion, tipo: "", etiquetas: nota.claves,
      estado: "borrador", destacado: false, generadoConIa: nota.generadaConIa, revisado: false, autor: nota.autor ?? (await usuarioActual()) ?? "",
      seoDescripcion: (nota.seoDescripcion || nota.resumen).slice(0, 200), portadaUrl: nota.portadaUrl, portadaAlt: nota.portadaAlt, publicarEn: "", notaRevision: "Enviada desde el Redactor.",
    });
    await guardarNota(nota.id, { portalId: p.data.portalId }, null);
    return NextResponse.json({ articulo: { id: articulo.id, slug: articulo.slug } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo enviar al portal." }, { status: 502 });
  }
}
