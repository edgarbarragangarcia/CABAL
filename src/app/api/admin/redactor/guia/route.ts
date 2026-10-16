import { NextResponse } from "next/server";
import { z } from "zod";

import { quienEs } from "@/lib/redactor/permisos";
import { guardarGuia, leerGuia } from "@/lib/redactor/store";

export const runtime = "nodejs";
const nc = { headers: { "Cache-Control": "private, no-store" } };

/** La guía de voz del equipo: la lee todo el equipo de redacción; la edita Dirección. */
export async function GET() {
  const { esDireccion } = await quienEs();
  return NextResponse.json({ ...(await leerGuia()), puedeEditar: esDireccion }, nc);
}

const guia = z.object({ voz: z.string().max(4000), mensajes: z.string().max(4000), lineasRojas: z.string().max(3000), hashtags: z.string().max(1000), cuentas: z.string().max(1000) });

export async function PUT(req: Request) {
  const { email, esDireccion } = await quienEs();
  if (!esDireccion) return NextResponse.json({ error: "Solo Dirección edita la guía de voz." }, { status: 403 });
  const p = guia.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "La guía es demasiado larga o no es válida." }, { status: 422 });
  try {
    await guardarGuia(p.data, email);
    return NextResponse.json({ ok: true }, nc);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar." }, { status: 502 });
  }
}
