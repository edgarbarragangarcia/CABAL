import { NextResponse } from "next/server";

import { votosCabalDeHijos } from "@/lib/territorio/ambitos";
import { lugarDe } from "@/lib/territorio/jerarquia";
import { ELECCIONES_MAPA, votosCabalPorLugar } from "@/lib/territorio/mapa";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Votos de María Fernanda en cada hijo de un lugar, para pintar el mapa y colorear la lista: departamentos (`?id=co`), municipios de
 * un departamento (`?id=13`) o, más abajo, comunas, barrios y puestos (`?id=05001`, `?id=11001:z01`).
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const id = p.get("id") ?? "co";
  const eleccion = p.get("eleccion") ?? ELECCIONES_MAPA[0].id;
  if (!ELECCIONES_MAPA.some((e) => e.id === eleccion)) return NextResponse.json({ error: "Elección no válida." }, { status: 422 });
  try {
    const elecciones = ELECCIONES_MAPA;
    if (id === "co" || /^\d{2}$/.test(id)) {
      // Bogotá es departamento y municipio a la vez: sus hijos son localidades.
      if (id !== "11") return NextResponse.json({ ...(await votosCabalPorLugar(eleccion, id)), elecciones }, { headers: { "Cache-Control": "private, max-age=300" } });
    }
    const lugar = await lugarDe(id === "11" ? "11001" : id);
    if (!lugar || !lugar.municipio) return NextResponse.json({ error: "Lugar no válido." }, { status: 422 });
    const hijos = [...new Set(lugar.vistas.flatMap((v) => v.items.map((i) => i.id)))].filter((h) => h.includes(":"));
    return NextResponse.json({ ...(await votosCabalDeHijos(hijos, lugar.municipio.dane, eleccion)), elecciones }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer los votos." }, { status: 502 });
  }
}
