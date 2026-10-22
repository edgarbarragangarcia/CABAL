import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, verifySessionToken } from "@/lib/admin-auth";
import { actualizarUsuario, autenticarConSupabase, cambiarClaveEnAuth, CLAVE_MINIMA, esPrincipal, verificarUsuario } from "@/lib/admin-usuarios";

/** El usuario cambia su propia clave (obligatorio cuando entró con una temporal): la nueva queda guardada con hash. */
export async function POST(req: Request) {
  const s = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { actual?: string; nueva?: string } | null;
  if (!b || typeof b.actual !== "string" || typeof b.nueva !== "string") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  if (b.nueva.length < CLAVE_MINIMA) return NextResponse.json({ error: `La clave nueva debe tener al menos ${CLAVE_MINIMA} caracteres.` }, { status: 400 });
  if (b.nueva === b.actual) return NextResponse.json({ error: "La clave nueva debe ser distinta de la actual." }, { status: 400 });
  // El administrador principal solo vive en Supabase Auth; los demás, además, en admin_usuarios (con su rol).
  const principal = await esPrincipal(s.email);
  const u = principal ? ((await autenticarConSupabase(s.email, b.actual)) ? { rol: undefined as string | undefined } : null) : await verificarUsuario(s.email, b.actual);
  if (!u) return NextResponse.json({ error: "La clave actual no es correcta." }, { status: 401 });
  if (principal) {
    const falla = await cambiarClaveEnAuth(s.email, b.nueva);
    if (falla) return NextResponse.json({ error: falla }, { status: 502 });
  } else {
    const r = await actualizarUsuario(s.email, { clave: b.nueva, claveTemporal: false });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(s.email, u.rol), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS });
  return res;
}
