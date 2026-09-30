import { NextResponse } from "next/server";

import { buscarResumenIa } from "@/lib/gov-data/avales/resumen-ia";

export const maxDuration = 60;

/** POST, no GET: dispara una llamada de pago al proveedor de IA configurado — nunca se lanza sola, solo con el botón "Buscar con IA". */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const nombre = typeof body?.nombre === "string" ? body.nombre.replace(/\s+/g, " ").trim() : "";
  if (nombre.length < 3 || nombre.length > 120) {
    return NextResponse.json({ error: "Falta el nombre completo." }, { status: 400 });
  }

  try {
    const resumen = await buscarResumenIa(nombre);
    return NextResponse.json(resumen);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible completar la búsqueda con IA." },
      { status: 502 }
    );
  }
}
