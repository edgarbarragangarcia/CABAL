import { NextResponse } from "next/server";

import { cargarProyeccion, estadoCarga, sqlDeProyeccion } from "@/lib/proyeccion/carga";

export const runtime = "nodejs";
export const maxDuration = 120;

/** GET → cuántas filas hay cargadas; GET ?sql=N → la parte N del SQL para pegar en Supabase. */
export async function GET(req: Request) {
  const parte = new URL(req.url).searchParams.get("sql");
  try {
    if (parte) {
      const r = await sqlDeProyeccion(Number(parte));
      if (!r) return NextResponse.json({ error: "Esa parte no existe." }, { status: 404 });
      return new Response(r.sql, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="proyeccion-parte-${String(parte).padStart(2, "0")}-de-${r.partes}.sql"` } });
    }
    const e = await estadoCarga();
    return NextResponse.json({ ...e, partes: Math.ceil(e.esperadas / 400) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible leer el estado." }, { status: 502 });
  }
}

/** Sube los datos del DANE a Supabase. */
export async function POST() {
  try {
    const filas = await cargarProyeccion();
    return NextResponse.json({ ok: true, filas });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible cargar." }, { status: 502 });
  }
}
