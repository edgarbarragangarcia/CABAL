import { NextResponse } from "next/server";

import { calcularTransferencia } from "@/lib/gov-data/elecciones/comparacion";
import { getComparacion } from "@/lib/gov-data/elecciones/resultados";

// Un departamento son decenas de municipios, dos archivos cada uno.
export const maxDuration = 60;

/**
 * Votos de una persona en dos elecciones, por territorio, y su cambio.
 * `?ea=&ca=` (elección y cargo de referencia) `&eb=&cb=&a=<ámbito de la actual>&persona=<nombre>`.
 * Si quedan territorios sin consultar (`pendientes`), el cliente vuelve a pedirla.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const persona = q.get("persona") ?? "";
  if (!q.get("ea") || !q.get("eb") || persona.split(" ").length < 3) {
    return NextResponse.json({ error: "Faltan las elecciones o el nombre completo del candidato." }, { status: 400 });
  }
  try {
    const c = await getComparacion({
      a: { eleccion: q.get("ea")!, corporacion: q.get("ca") ?? "" },
      b: { eleccion: q.get("eb")!, corporacion: q.get("cb") ?? "" },
      ambito: q.get("a"),
      persona,
    });
    const { filas, ...resto } = c;
    return NextResponse.json(
      { ...resto, transferencia: calcularTransferencia(filas) },
      { headers: { "Cache-Control": c.pendientes ? "no-store" : "private, max-age=600" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible comparar las elecciones." },
      { status: 502 }
    );
  }
}
