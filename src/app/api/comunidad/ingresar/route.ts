import { NextResponse } from "next/server";

import { errorJson, limitar } from "@/lib/comunidad/api";
import { loginSchema } from "@/lib/comunidad/esquemas";
import { MIEMBRO_COOKIE, crearToken, opcionesCookie } from "@/lib/comunidad/sesion";
import { autenticar } from "@/lib/comunidad/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limite = await limitar(req, "ingresar");
  if (limite) return limite;
  const p = loginSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Escribe tu correo o usuario y tu contraseña." }, { status: 422 });
  try {
    const m = await autenticar(p.data.acceso, p.data.password);
    if (!m) return NextResponse.json({ error: "Correo, usuario o contraseña incorrectos." }, { status: 401 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(MIEMBRO_COOKIE, crearToken(m.id), opcionesCookie);
    return res;
  } catch (e) {
    return errorJson(e);
  }
}
