import { NextResponse } from "next/server";
import { z } from "zod";

import { usuarioActual } from "@/lib/documentos/usuario";
import { agregarRegistro, borrarRegistro, leerPiloto } from "@/lib/piloto";

const nc = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  return NextResponse.json(await leerPiloto(), nc);
}

const nuevo = z.object({
  tarea: z.string().trim().min(2).max(200),
  area: z.enum(["investigacion", "contenidos", "formacion", "juridico", "territorial", "otra"]).default("otra"),
  minutos_sin_ia: z.number().int().min(0).max(100_000),
  minutos_con_ia: z.number().int().min(0).max(100_000),
  costo_cop: z.number().min(0).max(1e9).default(0),
  precision: z.number().int().min(1).max(5).nullable().default(null),
  errores: z.number().int().min(0).max(1000).default(0),
  nota: z.string().trim().max(500).nullable().default(null),
});

export async function POST(req: Request) {
  const p = nuevo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  const ok = await agregarRegistro({ ...p.data, fecha: new Date().toISOString().slice(0, 10), usuario: await usuarioActual() });
  return ok ? NextResponse.json({ ok: true }, nc) : NextResponse.json({ error: "No se pudo guardar: ¿está creada la tabla en Supabase?" }, { status: 502 });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Falta el registro." }, { status: 400 });
  return (await borrarRegistro(id)) ? NextResponse.json({ ok: true }, nc) : NextResponse.json({ error: "No se pudo borrar." }, { status: 502 });
}
