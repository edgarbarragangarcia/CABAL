import { NextResponse } from "next/server";

import { COOKIE_ORIGEN } from "@/lib/portales/cms/puro";
import { esBot, registrarEvento } from "@/lib/portales/cms/store";
import { portalPorEnlace } from "@/lib/portales/store";

export const dynamic = "force-dynamic";

/**
 * El botón «Súmate» de cada portal pasa por aquí: se cuenta el clic, se recuerda de qué portal vino la persona (30 días) y se la
 * lleva al formulario de afiliación de la comunidad de María Fernanda Cabal.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = NextResponse.redirect(new URL("/unete", req.url), 302);
  res.headers.set("Cache-Control", "no-store");
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return res;
  const portal = await portalPorEnlace(slug);
  if (portal?.estado !== "publicado") return res;
  if (!esBot(req.headers.get("user-agent"))) registrarEvento(portal.id, "cta");
  res.cookies.set(COOKIE_ORIGEN, portal.slug, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
