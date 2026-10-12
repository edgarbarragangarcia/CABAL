import { NextResponse } from "next/server";

import { listaDeLugares } from "@/lib/territorio/lugares";

export const runtime = "nodejs";

/** Los departamentos y municipios para elegir (con su código DANE). */
export async function GET() {
  return NextResponse.json(listaDeLugares(), { headers: { "Cache-Control": "private, max-age=86400" } });
}
