import { NextResponse } from "next/server";

import { investigarDepartamento } from "@/lib/monitoreo/menciones-web";

export const maxDuration = 60;

/** Investiga un departamento a fondo: `?dep=50` (código DANE de 2 dígitos). */
export async function GET(req: Request) {
  const dep = new URL(req.url).searchParams.get("dep") ?? "";
  if (!/^\d{2}$/.test(dep)) return NextResponse.json({ error: "Departamento no válido." }, { status: 400 });
  try {
    const informe = await investigarDepartamento(dep);
    if (!informe) return NextResponse.json({ error: "Departamento no encontrado." }, { status: 404 });
    return NextResponse.json(informe, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e instanceof Error && e.message) || "No fue posible consultar las fuentes." }, { status: 502 });
  }
}
