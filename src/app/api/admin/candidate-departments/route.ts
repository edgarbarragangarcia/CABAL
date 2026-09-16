import { NextResponse } from "next/server";

import { getCandidateVotesByDepartment } from "@/lib/gov-data/queries";

/**
 * Votos por departamento de UN candidato, bajo demanda — usado por el
 * comparador de candidatos del admin para no tener que precargar los 10
 * candidatos (10 llamadas a Socrata) antes de poder mostrar la página.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const candidato = searchParams.get("candidato");
  if (!candidato) {
    return NextResponse.json({ error: "Falta el parámetro candidato." }, { status: 400 });
  }

  try {
    const values = await getCandidateVotesByDepartment(candidato);
    return NextResponse.json({ values });
  } catch {
    return NextResponse.json(
      { error: "No fue posible cargar los datos de datos.gov.co." },
      { status: 502 }
    );
  }
}
