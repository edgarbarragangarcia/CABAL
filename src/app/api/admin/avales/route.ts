import { NextResponse } from "next/server";

import { getAvalesData } from "@/lib/gov-data/avales";

export const maxDuration = 60;

/**
 * Ficha de verificación de un candidato: hoja de vida (SIGEP/PEP),
 * antecedentes disciplinarios (SIRI) e historial electoral, a partir de su
 * cédula. El nombre es obligatorio aunque la cédula identifique sin dudas:
 * la hoja de vida (`getHojaDeVida`) lo necesita para el respaldo por nombre
 * cuando la cédula no basta, igual que su propia ruta en
 * `elecciones/hoja-de-vida`. `/api/admin/*` ya está protegido por `src/proxy.ts`.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cedula = (searchParams.get("cedula") ?? "").trim();
  const nombre = (searchParams.get("nombre") ?? "").replace(/\s+/g, " ").trim();
  if (!/^\d{3,12}$/.test(cedula)) {
    return NextResponse.json({ error: "Cédula no válida." }, { status: 400 });
  }
  if (nombre.length < 3 || nombre.length > 120) {
    return NextResponse.json({ error: "Falta el nombre completo." }, { status: 400 });
  }

  const datos = await getAvalesData(cedula, nombre);
  return NextResponse.json(datos, { headers: { "Cache-Control": "private, max-age=600" } });
}
