import { NextResponse } from "next/server";
import { z } from "zod";

import { ErrorComunidad, comunidadConfigurada, publicarComoOficial, totalAfiliados } from "@/lib/comunidad/store";

export const runtime = "nodejs";

/** `/api/admin/*` ya exige la sesión del panel (src/proxy.ts). */
export async function GET() {
  if (!comunidadConfigurada()) return NextResponse.json({ configurada: false, afiliados: 0 });
  try {
    return NextResponse.json({ configurada: true, afiliados: await totalAfiliados() });
  } catch {
    return NextResponse.json({ configurada: true, afiliados: 0, error: "No se pudo leer. ¿Ejecutaste supabase/comunidad.sql?" });
  }
}

export async function POST(req: Request) {
  const p = z.object({ texto: z.string().trim().min(1).max(2000) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Escribe el mensaje (máximo 2000 caracteres)." }, { status: 422 });
  try {
    await publicarComoOficial(p.data.texto);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof ErrorComunidad ? e.message : "No fue posible publicar." }, { status: e instanceof ErrorComunidad ? 400 : 500 });
  }
}
