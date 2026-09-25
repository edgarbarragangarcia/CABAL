import { NextResponse } from "next/server";

import { getVotosCandidato } from "@/lib/gov-data/elecciones/resultados";

// Un departamento o un puesto grande son decenas de archivos de la Registraduría.
export const maxDuration = 60;

/**
 * Votos de un candidato en un ámbito y en cada uno de sus hijos, hasta las mesas.
 * `?e=<elección>&c=<sigla>&a=<ámbito>&circ=<circunscripción>&p=<partido>&k=<candidato>`
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const partido = searchParams.get("p") ?? "";
  const candidato = searchParams.get("k") ?? "";
  if (!partido || !candidato) {
    return NextResponse.json({ error: "Falta el partido o el candidato." }, { status: 400 });
  }
  try {
    const votos = await getVotosCandidato({
      eleccion: searchParams.get("e") ?? "",
      corporacion: searchParams.get("c") ?? "",
      ambito: searchParams.get("a"),
      circunscripcion: searchParams.get("circ") ?? "",
      partido,
      candidato,
    });
    // Si quedaron territorios sin consultar, el navegador vuelve a pedirla: no se cachea a medias.
    const cache = votos.pendientes ? "no-store" : "private, max-age=600";
    return NextResponse.json(votos, { headers: { "Cache-Control": cache } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible cargar los votos del candidato." },
      { status: 502 }
    );
  }
}
