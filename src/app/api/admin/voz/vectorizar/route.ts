import { NextResponse } from "next/server";

import { estadoVectoresVoz, vectorizarPendientes } from "@/lib/voz/vectores";

export const runtime = "nodejs";
export const maxDuration = 60;
const nc = { headers: { "Cache-Control": "private, no-store" } };

export async function GET() {
  return NextResponse.json(await estadoVectoresVoz(), nc);
}

/** Vectoriza fragmentos pendientes durante ~35 s; el panel repite hasta que no quede ninguno. */
export async function POST() {
  return NextResponse.json(await vectorizarPendientes(), nc);
}
