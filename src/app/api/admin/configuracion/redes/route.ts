import { NextResponse } from "next/server";

import { ADMIN_USES_PUBLIC_DEFAULTS } from "@/lib/admin-auth";
import { guardarRedes, resumenRedes } from "@/lib/ia-config";

export async function GET() {
  return NextResponse.json(await resumenRedes(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const compartida = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (compartida && process.env.NODE_ENV === "production" && ADMIN_USES_PUBLIC_DEFAULTS) {
    return NextResponse.json({ error: "Primero cambia la contraseña del panel (ADMIN_PASSWORD y ADMIN_SESSION_SECRET en Vercel)." }, { status: 403 });
  }
  const b = (await req.json().catch(() => null)) as { youtube?: string; x?: string } | null;
  if (!b) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  try {
    await guardarRedes({ youtube: typeof b.youtube === "string" ? b.youtube : undefined, x: typeof b.x === "string" ? b.x : undefined });
    return NextResponse.json(await resumenRedes());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar." }, { status: 502 });
  }
}
