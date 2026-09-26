import { NextResponse } from "next/server";

import { calcularOportunidad } from "@/lib/gov-data/elecciones/oportunidad";
import { getDatosOportunidad } from "@/lib/gov-data/elecciones/resultados";

// Un municipio grande son cientos de archivos de la Registraduría.
export const maxDuration = 60;

/**
 * Oportunidad por puesto de un candidato bajo un municipio, localidad o zona.
 * `?e=<elección>&c=<sigla>&a=<ámbito>&circ=<circunscripción>&p=<partido>&k=<candidato>`
 * Si quedan puestos sin consultar (`pendientes`), el cliente vuelve a pedirla.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!q.get("p") || !q.get("k")) {
    return NextResponse.json({ error: "Falta el partido o el candidato." }, { status: 400 });
  }
  try {
    const datos = await getDatosOportunidad({
      eleccion: q.get("e") ?? "",
      corporacion: q.get("c") ?? "",
      ambito: q.get("a"),
      circunscripcion: q.get("circ") ?? "",
      partido: q.get("p")!,
      candidato: q.get("k")!,
    });
    const { puestos, ...resto } = datos;
    return NextResponse.json(
      { ...resto, oportunidad: calcularOportunidad(puestos) },
      { headers: { "Cache-Control": datos.pendientes ? "no-store" : "private, max-age=600" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible calcular la oportunidad." },
      { status: 502 }
    );
  }
}
