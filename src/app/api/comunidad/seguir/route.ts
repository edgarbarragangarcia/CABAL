import { NextResponse } from "next/server";
import { z } from "zod";

import { errorJson, exigirMiembro } from "@/lib/comunidad/api";
import { seguir } from "@/lib/comunidad/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const yo = await exigirMiembro();
  if (yo instanceof NextResponse) return yo;
  const p = z.object({ miembroId: z.string().uuid(), seguir: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Solicitud no válida." }, { status: 422 });
  try {
    await seguir(yo.id, p.data.miembroId, p.data.seguir);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorJson(e);
  }
}
