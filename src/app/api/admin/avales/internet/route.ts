import { NextResponse } from "next/server";

import { getPresenciaInternet } from "@/lib/gov-data/avales/presencia-internet";

/**
 * Ruta aparte de `/api/admin/avales`: así la búsqueda en Google Noticias no
 * espera a que termine el historial electoral, mucho más lento por el
 * firewall de la Registraduría.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nombre = (searchParams.get("nombre") ?? "").replace(/\s+/g, " ").trim();
  if (nombre.length < 3 || nombre.length > 120) {
    return NextResponse.json({ error: "Falta el nombre completo." }, { status: 400 });
  }

  try {
    const datos = await getPresenciaInternet(nombre);
    return NextResponse.json(datos, { headers: { "Cache-Control": "private, max-age=1800" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible consultar Google Noticias." },
      { status: 502 }
    );
  }
}
