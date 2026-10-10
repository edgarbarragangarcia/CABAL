import { NextResponse } from "next/server";

import { errorJson, exigirMiembro } from "@/lib/comunidad/api";
import { feed, type Ambito } from "@/lib/comunidad/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const yo = await exigirMiembro();
  if (yo instanceof NextResponse) return yo;
  const u = new URL(req.url).searchParams;
  const ambito = (u.get("ambito") ?? "seguidos").slice(0, 100);
  if (!/^(seguidos|todos|grupo:[a-z0-9-]+|perfil:[a-z0-9_]+)$/.test(ambito)) return NextResponse.json({ error: "Ámbito no válido." }, { status: 400 });
  const antes = u.get("antes");
  try {
    return NextResponse.json({ publicaciones: await feed(yo.id, ambito as Ambito, antes && !Number.isNaN(Date.parse(antes)) ? antes : undefined) });
  } catch (e) {
    return errorJson(e);
  }
}
