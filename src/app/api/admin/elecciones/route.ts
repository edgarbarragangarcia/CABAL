import { NextResponse } from "next/server";

import { getVistaElectoral } from "@/lib/gov-data/elecciones/resultados";

// La primera consulta de un ámbito con muchos hijos pide cada uno a la Registraduría.
export const maxDuration = 60;

/**
 * Resultados oficiales (preconteo) de cualquier elección y corporación.
 * `?e=<elección>&c=<sigla>&a=<código de ámbito>` o `&dane=<código DANE>`
 * para ubicar el mismo departamento o municipio en otra elección.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  try {
    const vista = await getVistaElectoral({
      eleccion: searchParams.get("e") ?? "",
      corporacion: searchParams.get("c") ?? "",
      ambito: searchParams.get("a"),
      dane: searchParams.get("dane"),
    });
    // Resultados cerrados: pueden cachearse en el navegador sin problema.
    return NextResponse.json(vista, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible cargar los resultados." },
      { status: 502 }
    );
  }
}
