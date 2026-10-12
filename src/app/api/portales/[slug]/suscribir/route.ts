import { NextResponse } from "next/server";

import { suscripcionSchema } from "@/lib/portales/crm/tipos";
import { suscribir } from "@/lib/portales/crm/store";
import { portalPorEnlace } from "@/lib/portales/store";

export const runtime = "nodejs";

/**
 * Una persona se suma a la comunidad de un portal desde su formulario público. Exige la autorización expresa para tratar sus
 * datos (habeas data, Ley 1581 de 2012); el campo `web` es una trampa para programas automáticos. El límite por minuto y la
 * verificación de origen los aplica `src/proxy.ts`. La respuesta es la misma si la persona ya estaba: no se revela quién está.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return NextResponse.json({ error: "Portal no encontrado." }, { status: 404 });
  const p = suscripcionSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) {
    const m = p.error.issues[0];
    return NextResponse.json({ error: m?.path[0] === "acepta" ? "Para sumarte necesitamos tu autorización para tratar tus datos." : m?.path[0] === "email" ? "Escribe un correo válido." : m?.path[0] === "nombre" ? "Escribe tu nombre." : "Revisa los datos del formulario." }, { status: 422 });
  }
  // Un programa automático llenó el campo trampa: se responde «bien» y no se guarda nada.
  if (p.data.web) return NextResponse.json({ ok: true });
  try {
    const portal = await portalPorEnlace(slug);
    if (portal?.estado !== "publicado") return NextResponse.json({ error: "Este portal no está disponible." }, { status: 404 });
    await suscribir(portal.id, p.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[portales/suscribir]", e);
    return NextResponse.json({ error: "No pudimos registrarte en este momento. Intenta de nuevo en unos minutos." }, { status: 503 });
  }
}
