import { NextResponse } from "next/server";

import { getPresenciaInternet } from "@/lib/gov-data/avales/presencia-internet";
import { buscarResumenIa } from "@/lib/gov-data/avales/resumen-ia";

export const maxDuration = 120;

/** POST, no GET: dispara una llamada de pago al proveedor de IA configurado — solo con el botón de investigación. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const nombre = typeof body?.nombre === "string" ? body.nombre.replace(/\s+/g, " ").trim() : "";
  if (nombre.length < 3 || nombre.length > 120) {
    return NextResponse.json({ error: "Falta el nombre completo." }, { status: 400 });
  }

  try {
    const { temas } = await getPresenciaInternet(nombre);
    return NextResponse.json(await buscarResumenIa(nombre, temas));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible completar la búsqueda con IA." },
      { status: 502 }
    );
  }
}
