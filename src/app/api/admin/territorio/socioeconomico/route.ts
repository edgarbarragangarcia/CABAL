import { NextResponse } from "next/server";

import { lugarDe } from "@/lib/territorio/jerarquia";
import { socioeconomicoDe } from "@/lib/territorio/socioeconomico";

export const runtime = "nodejs";
export const maxDuration = 60;

/** `?id=<lugar>`: economía, población y servicios sociales del municipio (o departamento) al que pertenece el lugar. `/api/admin/*` exige sesión. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "co";
  const lugar = await lugarDe(id);
  if (!lugar || lugar.nivel === "pais") return NextResponse.json({ error: "Elige un departamento, municipio o un lugar dentro de uno." }, { status: 422 });
  const dane = lugar.municipio?.dane ?? lugar.departamento!.dane;
  const nombre = lugar.municipio?.nombre ?? lugar.departamento!.nombre;
  // La comuna o localidad: el propio lugar o la que lo contiene (barrio, puesto). En Bogotá la zona N del nomenclátor es la localidad N.
  const loc = lugar.nivel === "localidad" ? { id: lugar.id, nombre: lugar.nombre } : [...lugar.ruta].reverse().find((m) => m.nivel === "localidad");
  const numero = dane === "11001" ? loc?.id.match(/:z(\d{2})/)?.[1] : undefined;
  const datos = await socioeconomicoDe(dane, nombre, lugar.departamento?.nombre ?? nombre, loc ? { nombre: loc.nombre, numero } : undefined);
  return NextResponse.json(datos, { headers: { "Cache-Control": "private, no-store" } });
}
