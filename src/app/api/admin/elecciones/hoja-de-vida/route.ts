import { NextResponse } from "next/server";

import { getHojaDeVida } from "@/lib/gov-data/elecciones/hoja-de-vida";

/** Hoja de vida pública de un candidato, por su cédula (`?cedula=`). */
export async function GET(req: Request) {
  const cedula = new URL(req.url).searchParams.get("cedula") ?? "";
  if (!/^\d{3,12}$/.test(cedula)) {
    return NextResponse.json({ error: "Cédula no válida." }, { status: 400 });
  }
  try {
    const hv = await getHojaDeVida(cedula);
    return NextResponse.json(hv, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible consultar la hoja de vida." },
      { status: 502 }
    );
  }
}
