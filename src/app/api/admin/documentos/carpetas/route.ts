import { NextResponse } from "next/server";
import { z } from "zod";

import { borrarCarpeta, crearCarpeta, listarCarpetas, renombrarCarpeta } from "@/lib/documentos/gestor";

export const runtime = "nodejs";

const nombre = z.string().trim().min(1, "Escribe un nombre.").max(80);
const fallo = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible completar la acción." }, { status: 502 });

export async function GET() {
  try {
    return NextResponse.json({ carpetas: await listarCarpetas() });
  } catch (e) {
    return fallo(e);
  }
}

export async function POST(req: Request) {
  const p = z.object({ nombre, padreId: z.string().uuid().nullable().default(null) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  try {
    return NextResponse.json({ carpeta: await crearCarpeta(p.data.nombre, p.data.padreId) });
  } catch (e) {
    return fallo(e);
  }
}

export async function PATCH(req: Request) {
  const p = z.object({ id: z.string().uuid(), nombre }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  try {
    await renombrarCarpeta(p.data.id, p.data.nombre);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fallo(e);
  }
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Carpeta no válida." }, { status: 422 });
  try {
    await borrarCarpeta(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fallo(e);
  }
}
