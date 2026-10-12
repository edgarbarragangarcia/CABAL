import { NextResponse } from "next/server";

import { indicadoresDe } from "@/lib/territorio/indicadores";
import { lugarDe } from "@/lib/territorio/lugares";
import { relacionDelDepartamento } from "@/lib/territorio/relacion";
import { eleccionesDeLugar } from "@/lib/territorio/votacion";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Todo lo de un departamento (`?dane=13`) o municipio (`?dane=13244`): cómo le fue a María Fernanda Cabal y a la oposición en cada
 * elección, el conflicto armado y los problemas del lugar y, en un departamento, la relación entre ambos municipio por municipio.
 * Solo lee de Supabase. `/api/admin/*` ya exige la sesión del panel (src/proxy.ts).
 */
export async function GET(req: Request) {
  const dane = new URL(req.url).searchParams.get("dane") ?? "";
  const lugar = lugarDe(dane);
  if (!lugar) return NextResponse.json({ error: "Elige un departamento o un municipio." }, { status: 422 });
  try {
    const [elecciones, indicadores, relacion] = await Promise.all([
      eleccionesDeLugar(dane),
      indicadoresDe(dane),
      lugar.nivel === "departamento" ? relacionDelDepartamento(dane) : Promise.resolve(null),
    ]);
    return NextResponse.json({ lugar, elecciones, indicadores, relacion }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible armar la información del lugar." }, { status: 502 });
  }
}
