import { NextResponse } from "next/server";

import { getHojaDeVida } from "@/lib/gov-data/elecciones/hoja-de-vida";

/**
 * Hoja de vida pública de un candidato: `?nombre=` (el del tarjetón) y, si la
 * Registraduría la publicó, `&cedula=`, que la ubica sin homónimos.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cedula = searchParams.get("cedula") ?? "";
  const nombre = (searchParams.get("nombre") ?? "").replace(/\s+/g, " ").trim();
  if (cedula && !/^\d{3,12}$/.test(cedula)) {
    return NextResponse.json({ error: "Cédula no válida." }, { status: 400 });
  }
  if (nombre.length < 3 || nombre.length > 120) {
    return NextResponse.json({ error: "Falta el nombre del candidato." }, { status: 400 });
  }
  try {
    const hv = await getHojaDeVida(cedula, nombre);
    return NextResponse.json(hv, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible consultar la hoja de vida." },
      { status: 502 }
    );
  }
}
