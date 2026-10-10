import { NextResponse } from "next/server";

import { errorJson, exigirMiembro, limitar } from "@/lib/comunidad/api";
import { publicarSchema } from "@/lib/comunidad/esquemas";
import { publicar } from "@/lib/comunidad/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const yo = await exigirMiembro();
  if (yo instanceof NextResponse) return yo;
  const limite = await limitar(req, "publicar");
  if (limite) return limite;
  const p = publicarSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Escribe algo (máximo 2000 caracteres)." }, { status: 422 });
  try {
    await publicar(yo.id, p.data.texto, p.data.grupo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
