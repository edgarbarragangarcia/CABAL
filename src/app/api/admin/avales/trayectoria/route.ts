import { NextResponse } from "next/server";

import { buscarTrayectoria } from "@/lib/gov-data/avales/trayectoria-ia";

export const maxDuration = 120;

/** POST: dispara una llamada de pago al proveedor de IA (con búsqueda web). `/api/admin/*` ya exige sesión. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const nombre = typeof body?.nombre === "string" ? body.nombre.replace(/\s+/g, " ").trim() : "";
  const cedula = typeof body?.cedula === "string" ? body.cedula.replace(/\D/g, "").slice(0, 12) : "";
  if (nombre.length < 3 || nombre.length > 120) return NextResponse.json({ error: "Falta el nombre completo." }, { status: 400 });
  try {
    return NextResponse.json(await buscarTrayectoria(nombre, cedula));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible buscar la trayectoria." }, { status: 502 });
  }
}
