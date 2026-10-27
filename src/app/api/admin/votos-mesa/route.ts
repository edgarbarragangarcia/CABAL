import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { SQL_POR_ARCHIVO } from "@/lib/gestor/sql";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Fila = { anio: number; etapa: string; corporacion: string; candidato: string; departamento: string; municipios: number; mesas: number; votos: number };

/** Los votos por mesa guardados en Supabase (tabla votos_mesa), resumidos por departamento. Si falta la tabla, devuelve el SQL para crearla. */
export async function GET() {
  if (!(await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está conectado." }, { status: 503 });
  const { data, error } = await supabase.from("votos_mesa_departamento").select("*").order("votos", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: "Falta crear la tabla: pega este SQL en Supabase > SQL Editor > Run.", sql: SQL_POR_ARCHIVO["votos-mesa"] }, { status: 409 });
  const filas = (data ?? []) as Fila[];
  const mesas = filas.reduce((a, f) => a + Number(f.mesas), 0);
  return NextResponse.json({ filas, mesas, votos: filas.reduce((a, f) => a + Number(f.votos), 0) }, { headers: { "Cache-Control": "private, no-store" } });
}
