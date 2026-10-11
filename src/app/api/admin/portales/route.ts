import { NextResponse } from "next/server";

import { crearSchema } from "@/lib/portales/esquemas";
import { hayCms } from "@/lib/portales/cms/store";
import { SQL_PORTALES } from "@/lib/portales/sql";
import { respuestaError } from "@/lib/portales/respuesta";
import { ErrorPortales, crearPortal, hayTabla, listarPortales } from "@/lib/portales/store";

export const runtime = "nodejs";

/** Lista los portales generados. `/api/admin/*` ya exige la sesión del panel (src/proxy.ts). */
export async function GET() {
  try {
    const tabla = await hayTabla();
    // Las piezas del centro de operaciones (artículos, anuncios...) vienen en el mismo SQL; si falta alguna, se vuelve a ofrecer completo.
    const cms = tabla && (await hayCms());
    if (!tabla || !cms) {
      const ref = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : "";
      return NextResponse.json({ configurada: true, tabla, cms, portales: tabla ? await listarPortales() : [], sql: SQL_PORTALES, editorSql: ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : undefined });
    }
    return NextResponse.json({ configurada: true, tabla: true, cms: true, portales: await listarPortales() });
  } catch (e) {
    if (e instanceof ErrorPortales && e.codigo === "sin_db") return NextResponse.json({ configurada: false, tabla: false, portales: [] });
    return respuestaError(e);
  }
}

export async function POST(req: Request) {
  const p = crearSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  try {
    return NextResponse.json({ portal: await crearPortal({ ...p.data, config: { ...p.data.config, nombre: p.data.nombre } }) }, { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}
