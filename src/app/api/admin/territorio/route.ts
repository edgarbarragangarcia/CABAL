import { NextResponse } from "next/server";

import { eleccionesDeAmbito } from "@/lib/territorio/ambitos";
import { indicadoresDe } from "@/lib/territorio/indicadores";
import { lugarDe } from "@/lib/territorio/jerarquia";
import { relacionDelDepartamento } from "@/lib/territorio/relacion";
import { eleccionesDeLugar } from "@/lib/territorio/votacion";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Todo lo de un lugar (`?id=11001:z01`; ids en `jerarquia.ts`, o un código DANE de departamento o municipio): sus hijos para seguir
 * bajando, cómo le fue a María Fernanda Cabal y a la oposición, el conflicto del municipio y, en un departamento, la relación entre
 * ambos municipio por municipio. Solo lee de Supabase. `/api/admin/*` ya exige la sesión del panel (src/proxy.ts).
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const id = p.get("id") ?? p.get("dane") ?? "co";
  const lugar = await lugarDe(id);
  if (!lugar) return NextResponse.json({ error: "No encontré ese lugar." }, { status: 422 });
  if (lugar.nivel === "pais") return NextResponse.json({ lugar, elecciones: [], indicadores: null, relacion: null });
  const dane = lugar.municipio?.dane ?? lugar.departamento!.dane;
  try {
    const subMunicipal = lugar.nivel === "localidad" || lugar.nivel === "barrio" || lugar.nivel === "puesto";
    const [elecciones, indicadores, relacion] = await Promise.all([
      subMunicipal ? eleccionesDeAmbito(id, dane) : eleccionesDeLugar(dane),
      indicadoresDe(dane),
      lugar.nivel === "departamento" ? relacionDelDepartamento(dane) : Promise.resolve(null),
    ]);
    return NextResponse.json({ lugar, elecciones, indicadores, relacion }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (e) {
    // Aun sin datos de votación, el recorrido por los lugares tiene que seguir funcionando.
    return NextResponse.json({ lugar, error: e instanceof Error ? e.message : "No fue posible armar la información del lugar." }, { status: 200 });
  }
}
