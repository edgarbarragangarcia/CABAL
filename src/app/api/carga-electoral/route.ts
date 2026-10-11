import { NextResponse, after } from "next/server";
import { z } from "zod";

import { verifyPurposeToken } from "@/lib/admin-auth";
import { leerCarga } from "@/lib/gov-data/elecciones/almacen";
import { PROPOSITO_CARGA, ejecutarTramo } from "@/lib/gov-data/elecciones/carga";

export const runtime = "nodejs";
// Un tramo de la carga trabaja unos 40 s después de responder.
export const maxDuration = 60;

const cuerpo = z.object({ cadena: z.string().uuid(), enfriar: z.boolean().optional() });

/**
 * Siguiente tramo de la carga de resultados en segundo plano (ver `carga.ts`). Solo lo llama el propio servidor, con una ficha
 * de un solo uso y corta vida (no sirve como sesión del panel) y el identificador de la carga vigente. Responde enseguida y hace
 * el trabajo después, para que quien lo llama pueda terminar y no se acumulen funciones esperando.
 */
export async function POST(req: Request) {
  const ficha = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!(await verifyPurposeToken(PROPOSITO_CARGA, ficha))) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const p = cuerpo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 422 });

  const { carga } = await leerCarga().catch(() => ({ carga: null }));
  if (!carga || !carga.activa || carga.cadena !== p.data.cadena) return NextResponse.json({ error: "Esa carga ya no está vigente." }, { status: 409 });

  const origen = new URL(req.url).origin;
  after(() => ejecutarTramo(p.data.cadena, origen, p.data.enfriar === true));
  return NextResponse.json({ ok: true }, { status: 202 });
}
