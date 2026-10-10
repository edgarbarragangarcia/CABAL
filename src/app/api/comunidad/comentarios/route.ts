import { NextResponse } from "next/server";

import { errorJson, exigirMiembro, limitar } from "@/lib/comunidad/api";
import { comentarSchema } from "@/lib/comunidad/esquemas";
import { comentar, comentarios } from "@/lib/comunidad/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const yo = await exigirMiembro();
  if (yo instanceof NextResponse) return yo;
  const id = new URL(req.url).searchParams.get("publicacion") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  try {
    return NextResponse.json({ comentarios: await comentarios(id) });
  } catch (e) {
    return errorJson(e);
  }
}

export async function POST(req: Request) {
  const yo = await exigirMiembro();
  if (yo instanceof NextResponse) return yo;
  const limite = await limitar(req, "comentar");
  if (limite) return limite;
  const p = comentarSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Escribe un comentario (máximo 500 caracteres)." }, { status: 422 });
  try {
    await comentar(yo.id, p.data.publicacionId, p.data.texto);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
