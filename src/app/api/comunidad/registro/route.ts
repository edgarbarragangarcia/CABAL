import { NextResponse } from "next/server";

import { errorJson, limitar } from "@/lib/comunidad/api";
import { registroSchema } from "@/lib/comunidad/esquemas";
import { MIEMBRO_COOKIE, crearToken, opcionesCookie } from "@/lib/comunidad/sesion";
import { registrarMiembro } from "@/lib/comunidad/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limite = await limitar(req, "registro");
  if (limite) return limite;
  const p = registroSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Revisa los datos.", campos: p.error.flatten().fieldErrors }, { status: 422 });
  if (p.data.website) return NextResponse.json({ ok: true }); // bot: respuesta muda
  try {
    const m = await registrarMiembro(p.data);
    const res = NextResponse.json({ ok: true, usuario: m.usuario });
    res.cookies.set(MIEMBRO_COOKIE, crearToken(m.id), opcionesCookie);
    return res;
  } catch (e) {
    return errorJson(e);
  }
}
