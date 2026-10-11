import { NextResponse } from "next/server";
import { z } from "zod";

import { estadoAlmacen, reiniciarInterruptor } from "@/lib/gov-data/elecciones/almacen";
import { SQL_ELECCIONES } from "@/lib/gov-data/elecciones/sql";
import { NIVELES_SINCRONIZACION, PARES, estadoSincronizacion, sincronizarLote } from "@/lib/gov-data/elecciones/sincronizar";

export const runtime = "nodejs";
// Cada lote pide territorios a la fuente durante unos 40 s.
export const maxDuration = 60;

const editorSql = () => {
  const ref = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : "";
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : undefined;
};

/** Estado de la copia de resultados en Supabase y cuánto hay guardado de cada cargo. `/api/admin/*` ya exige la sesión del panel (src/proxy.ts). */
export async function GET() {
  try {
    // Quien viene a comprobar acaba de crear las tablas, o de repararlas: que no pese el último fallo.
    reiniciarInterruptor();
    const estado = await estadoAlmacen();
    if (!estado.configurada) return NextResponse.json({ ...estado, pares: [] });
    if (!estado.tabla) return NextResponse.json({ ...estado, pares: [], sql: SQL_ELECCIONES, editorSql: editorSql() });
    return NextResponse.json({ ...estado, pares: await estadoSincronizacion() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer el estado." }, { status: 502 });
  }
}

const lote = z.object({
  eleccion: z.string().min(1).max(60).optional(),
  corporacion: z.string().min(1).max(10).optional(),
  nivelMax: z.number().refine((n): n is (typeof NIVELES_SINCRONIZACION)[number] => (NIVELES_SINCRONIZACION as readonly number[]).includes(n), "Nivel no válido."),
}).refine((v) => PARES.some((x) => (!v.eleccion || x.eleccion === v.eleccion) && (!v.corporacion || x.corporacion === v.corporacion)), "Elección o cargo no válido.");

/** Guarda un lote de territorios (los que falten) y devuelve cuánto va; el panel repite hasta que `terminado`. */
export async function POST(req: Request) {
  const p = lote.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  try {
    return NextResponse.json(await sincronizarLote(p.data));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible sincronizar." }, { status: 502 });
  }
}
