import { NextResponse } from "next/server";

import { errorJson, exigirMiembro } from "@/lib/comunidad/api";
import { perfilSchema } from "@/lib/comunidad/esquemas";
import { guardarBio } from "@/lib/comunidad/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const yo = await exigirMiembro();
  if (yo instanceof NextResponse) return yo;
  const p = perfilSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "La biografía admite hasta 280 caracteres." }, { status: 422 });
  try {
    await guardarBio(yo.id, p.data.bio);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
