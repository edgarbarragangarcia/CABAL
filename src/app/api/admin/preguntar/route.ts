import { NextResponse } from "next/server";

import { preguntar } from "@/lib/gov-data/elecciones/preguntas";

// Planear, consultar los datos oficiales y redactar: dos llamadas a la IA y hasta tres consultas.
export const maxDuration = 60;

/** POST { pregunta }: responde con los datos electorales oficiales y devuelve las consultas que hizo. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { pregunta?: string } | null;
  const pregunta = body?.pregunta?.trim() ?? "";
  if (pregunta.length < 5 || pregunta.length > 500) {
    return NextResponse.json({ error: "Escribe una pregunta de entre 5 y 500 caracteres." }, { status: 400 });
  }
  try {
    return NextResponse.json(await preguntar(pregunta));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible responder." }, { status: 502 });
  }
}
