import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { errorJson, limitar } from "@/lib/comunidad/api";
import { registroSchema } from "@/lib/comunidad/esquemas";
import { MIEMBRO_COOKIE, crearToken, opcionesCookie } from "@/lib/comunidad/sesion";
import { COOKIE_ORIGEN } from "@/lib/portales/cms/puro";
import { atribuirAdepto } from "@/lib/portales/cms/store";
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
    // Si llegó desde un portal temático, ese portal se anota como el que la trajo (y no estorba la afiliación si falla).
    const origen = (await cookies()).get(COOKIE_ORIGEN)?.value;
    if (origen) await atribuirAdepto(m.id, origen);
    const res = NextResponse.json({ ok: true, usuario: m.usuario });
    res.cookies.set(MIEMBRO_COOKIE, crearToken(m.id), opcionesCookie);
    if (origen) res.cookies.delete(COOKIE_ORIGEN);
    return res;
  } catch (e) {
    return errorJson(e);
  }
}
