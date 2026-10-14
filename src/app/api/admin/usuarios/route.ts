import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ADMIN_EMAIL, SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { actualizarUsuario, crearUsuario, eliminarUsuario, estadoUsuarios, listarUsuarios } from "@/lib/admin-usuarios";

/** Solo el administrador principal (ADMIN_EMAIL) gestiona usuarios. */
async function principal() {
  const s = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return s && s.email === ADMIN_EMAIL ? s.email : null;
}
const sinPermiso = () => NextResponse.json({ error: "Solo el administrador principal puede gestionar usuarios." }, { status: 403 });
const noCache = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  if (!(await principal())) return sinPermiso();
  const estado = await estadoUsuarios();
  return NextResponse.json({ ...estado, principal: ADMIN_EMAIL, usuarios: estado.disponible ? await listarUsuarios() : [] }, noCache);
}

export async function POST(req: Request) {
  const yo = await principal();
  if (!yo) return sinPermiso();
  const b = (await req.json().catch(() => null)) as { email?: string; nombre?: string; clave?: string } | null;
  if (!b || typeof b.email !== "string" || typeof b.clave !== "string") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const r = await crearUsuario({ email: b.email, nombre: typeof b.nombre === "string" ? b.nombre : "", clave: b.clave, creadoPor: yo });
  return r.ok ? NextResponse.json({ ok: true }, noCache) : NextResponse.json({ error: r.error }, { status: 400 });
}

export async function PATCH(req: Request) {
  if (!(await principal())) return sinPermiso();
  const b = (await req.json().catch(() => null)) as { email?: string; activo?: boolean; clave?: string; nombre?: string } | null;
  if (!b || typeof b.email !== "string") return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const r = await actualizarUsuario(b.email, { activo: b.activo, clave: b.clave, nombre: b.nombre });
  return r.ok ? NextResponse.json({ ok: true }, noCache) : NextResponse.json({ error: r.error }, { status: 400 });
}

export async function DELETE(req: Request) {
  if (!(await principal())) return sinPermiso();
  const email = new URL(req.url).searchParams.get("email") ?? "";
  if (!email) return NextResponse.json({ error: "Falta el correo." }, { status: 400 });
  return (await eliminarUsuario(email)) ? NextResponse.json({ ok: true }, noCache) : NextResponse.json({ error: "No se pudo eliminar." }, { status: 502 });
}
