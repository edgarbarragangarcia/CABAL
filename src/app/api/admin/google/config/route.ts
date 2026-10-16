import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

const COOKIE = "google_client_id";
const FORMA = /^\d{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$/i;

/**
 * El identificador público (client ID) de la app de Google con la que el panel se conecta a Drive. No es un secreto: va en el navegador.
 * Sale de la variable GOOGLE_CLIENT_ID o, si no está, del que se pegó una vez desde el botón (queda en este navegador).
 */
export async function GET() {
  const guardado = (await cookies()).get(COOKIE)?.value;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || (guardado && FORMA.test(guardado) ? guardado : null);
  return NextResponse.json({ clientId }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const p = z.object({ clientId: z.string().trim().regex(FORMA, "Ese no parece un ID de cliente de Google (termina en .apps.googleusercontent.com).") }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "ID no válido." }, { status: 422 });
  const res = NextResponse.json({ ok: true, clientId: p.data.clientId });
  res.cookies.set(COOKIE, p.data.clientId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
