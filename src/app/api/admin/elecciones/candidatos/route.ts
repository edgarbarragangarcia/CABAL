import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const consulta = z.object({
  eleccion: z.string().min(1).max(60),
  corporacion: z.string().min(1).max(10),
  nivel: z.coerce.number().int().min(1).max(6).default(3),
  prefijo: z.string().max(12).regex(/^[A-Za-z0-9]*$/).default(""),
  q: z.string().max(80).default(""),
  limite: z.coerce.number().int().min(1).max(500).default(100),
});

/** Los candidatos más votados de un cargo (concejales, ediles…) en el país o en un departamento, con búsqueda por nombre. */
export async function GET(req: Request) {
  const p = consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return NextResponse.json({ error: "Consulta no válida." }, { status: 422 });
  const c = getSupabaseServerClient();
  if (!c) return NextResponse.json({ error: "Falta conectar Supabase." }, { status: 503 });
  const { data, error } = await c.rpc("candidatos_mas_votados", { p_eleccion: p.data.eleccion, p_corporacion: p.data.corporacion, p_nivel: p.data.nivel, p_prefijo: p.data.prefijo, p_busqueda: p.data.q.replace(/[%_\\]/g, ""), p_limite: p.data.limite });
  if (error) {
    const falta = /candidatos_mas_votados|schema cache|does not exist/i.test(error.message);
    return NextResponse.json({ error: falta ? "Falta ejecutar el SQL de los más votados (supabase/elecciones.sql)." : error.message }, { status: falta ? 501 : 502 });
  }
  return NextResponse.json({ candidatos: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}
