import { NextResponse } from "next/server";

import { buscarEnTerritorio } from "@/lib/gov-data/elecciones/historial-electoral";

export const maxDuration = 30;

/** Búsqueda puntual del historial electoral en Cámara, Gobernación, Alcaldía, Asamblea, Concejo o JAL. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cedula = (searchParams.get("cedula") ?? "").trim();
  const nombre = (searchParams.get("nombre") ?? "").replace(/\s+/g, " ").trim();
  const eleccion = searchParams.get("eleccion") ?? "";
  const corporacion = searchParams.get("corporacion") ?? "";
  const territorio = (searchParams.get("territorio") ?? "").trim();

  if (!/^\d{3,12}$/.test(cedula)) return NextResponse.json({ error: "Cédula no válida." }, { status: 400 });
  if (!eleccion || !corporacion) return NextResponse.json({ error: "Falta la elección o la corporación." }, { status: 400 });
  if (territorio.length < 2) return NextResponse.json({ error: "Escribe un departamento o municipio." }, { status: 400 });

  try {
    const resultado = await buscarEnTerritorio({ eleccionId: eleccion, corporacionSigla: corporacion, territorio }, cedula, nombre);
    return NextResponse.json(resultado, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible completar la búsqueda." },
      { status: 502 }
    );
  }
}
