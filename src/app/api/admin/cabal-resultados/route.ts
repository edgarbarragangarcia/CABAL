import { NextResponse } from "next/server";

import { getCabalNivel, type ElectoralYear } from "@/lib/gov-data/cabal-electoral";

/**
 * Resultados de María Fernanda Cabal al Senado por nivel territorial.
 * `?year=2018|2022&nivel=pais|departamento|municipio|zona|puesto&id=...`
 * (el `id` de cada nivel viene en la respuesta del nivel anterior).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const nivel = searchParams.get("nivel") ?? "pais";
  const id = searchParams.get("id") ?? "";

  if (year !== 2018 && year !== 2022) {
    return NextResponse.json({ error: "Año no válido." }, { status: 400 });
  }

  try {
    const data = await getCabalNivel(year as ElectoralYear, nivel, id);
    // Resultados cerrados: pueden cachearse en el navegador sin problema.
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible cargar los datos electorales." },
      { status: 502 }
    );
  }
}
