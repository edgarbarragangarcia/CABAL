import { NextResponse } from "next/server";
import { z } from "zod";

import { errorJson, exigirMiembro } from "@/lib/comunidad/api";
import { alternarMeGusta } from "@/lib/comunidad/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const yo = await exigirMiembro();
  if (yo instanceof NextResponse) return yo;
  const p = z.object({ publicacionId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Solicitud no válida." }, { status: 422 });
  try {
    return NextResponse.json({ activo: await alternarMeGusta(yo.id, p.data.publicacionId) });
  } catch (e) {
    return errorJson(e);
  }
}
