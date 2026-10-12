import { NextResponse } from "next/server";

import { bajaValida } from "@/lib/portales/crm/baja";
import { darDeBaja } from "@/lib/portales/crm/boletines";
import { portalPorEnlace } from "@/lib/portales/store";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Darse de baja de los boletines con el enlace personal del correo (id del contacto firmado). Vuelve a la página de confirmación. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await req.formData().catch(() => null);
  const c = String(f?.get("c") ?? "");
  const t = String(f?.get("t") ?? "");
  const destino = (estado: string) => NextResponse.redirect(new URL(`/p/${slug}/baja?estado=${estado}`, req.url), 303);
  if (!/^[a-z0-9-]{3,40}$/.test(slug) || !UUID.test(c) || !bajaValida(c, t)) return destino("invalido");
  try {
    const portal = await portalPorEnlace(slug);
    if (!portal) return destino("invalido");
    await darDeBaja(portal.id, c);
    return destino("listo");
  } catch {
    return destino("error");
  }
}
