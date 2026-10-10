import { NextResponse } from "next/server";

import { cambioSchema } from "@/lib/portales/esquemas";
import { respuestaError } from "@/lib/portales/respuesta";
import { cambiarEstado, duplicarPortal, eliminarPortal, guardarPortal } from "@/lib/portales/store";

export const runtime = "nodejs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guardar cambios, desplegar, pausar, reanudar o duplicar un portal. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "Identificador no válido." }, { status: 400 });
  const p = cambioSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  try {
    const c = p.data;
    if (c.accion === "guardar") return NextResponse.json({ portal: await guardarPortal(id, { nombre: c.nombre, slug: c.slug, config: c.config && c.nombre ? { ...c.config, nombre: c.nombre } : c.config }) });
    if (c.accion === "duplicar") return NextResponse.json({ portal: await duplicarPortal(id) }, { status: 201 });
    return NextResponse.json({ portal: await cambiarEstado(id, c.accion) });
  } catch (e) {
    return respuestaError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "Identificador no válido." }, { status: 400 });
  try {
    await eliminarPortal(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
}
