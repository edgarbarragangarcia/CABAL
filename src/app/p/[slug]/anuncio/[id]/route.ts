import { NextResponse } from "next/server";

import { anuncioVigente } from "@/lib/portales/cms/puro";
import { anuncioPorId, esBot, registrarEvento } from "@/lib/portales/cms/store";
import { portalPorEnlace } from "@/lib/portales/store";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Clic en un anuncio: se cuenta y se lleva al anunciante. El destino sale siempre del anuncio guardado (nunca de la dirección
 * que llega), así este enlace no sirve para redirigir a otros sitios. Si el anuncio ya no está vigente, vuelve al portal.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const inicio = NextResponse.redirect(new URL(`/p/${/^[a-z0-9-]{3,40}$/.test(slug) ? slug : ""}`, req.url), 302);
  inicio.headers.set("Cache-Control", "no-store");
  if (!/^[a-z0-9-]{3,40}$/.test(slug) || !UUID.test(id)) return inicio;
  const portal = await portalPorEnlace(slug);
  if (portal?.estado !== "publicado") return inicio;
  const anuncio = await anuncioPorId(portal.id, id);
  if (!anuncio || !anuncioVigente(anuncio)) return inicio;
  if (!esBot(req.headers.get("user-agent"))) registrarEvento(portal.id, "anuncio", { anuncioIds: [anuncio.id] });
  const res = NextResponse.redirect(anuncio.destinoUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
