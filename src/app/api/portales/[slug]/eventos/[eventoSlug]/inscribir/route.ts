import { NextResponse } from "next/server";

import { inscripcionSchema } from "@/lib/portales/crm/tipos";
import { eventoPublicado, inscribirAEvento } from "@/lib/portales/crm/store";
import { ErrorPortales, portalPorEnlace } from "@/lib/portales/store";

export const runtime = "nodejs";

/** Inscripción a un evento del portal: crea o reutiliza a la persona en su CRM. Mismas reglas de autorización que «Súmate». */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; eventoSlug: string }> }) {
  const { slug, eventoSlug } = await params;
  if (!/^[a-z0-9-]{3,40}$/.test(slug) || !/^[a-z0-9-]{3,90}$/.test(eventoSlug)) return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  const p = inscripcionSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) {
    const m = p.error.issues[0];
    return NextResponse.json({ error: m?.path[0] === "acepta" ? "Para inscribirte necesitamos tu autorización para tratar tus datos." : m?.path[0] === "email" ? "Escribe un correo válido." : m?.path[0] === "nombre" ? "Escribe tu nombre." : "Revisa los datos del formulario." }, { status: 422 });
  }
  if (p.data.web) return NextResponse.json({ ok: true });
  try {
    const portal = await portalPorEnlace(slug);
    if (portal?.estado !== "publicado") return NextResponse.json({ error: "Este portal no está disponible." }, { status: 404 });
    const evento = await eventoPublicado(portal.id, eventoSlug);
    if (!evento) return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
    const r = await inscribirAEvento(portal.id, evento, p.data);
    return NextResponse.json({ ok: true, yaInscrito: r.yaInscrito, enlaceVirtual: evento.modalidad !== "presencial" ? evento.enlaceVirtual : "" });
  } catch (e) {
    if (e instanceof ErrorPortales && e.codigo === "invalido") return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[portales/inscribir]", e);
    return NextResponse.json({ error: "No pudimos inscribirte en este momento. Intenta de nuevo en unos minutos." }, { status: 503 });
  }
}
