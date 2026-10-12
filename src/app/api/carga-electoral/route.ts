import { timingSafeEqual } from "node:crypto";

import { NextResponse, after } from "next/server";
import { z } from "zod";

import { verifyPurposeToken } from "@/lib/admin-auth";
import { leerCarga } from "@/lib/gov-data/elecciones/almacen";
import { PROPOSITO_CARGA, ejecutarTramo } from "@/lib/gov-data/elecciones/carga";

export const runtime = "nodejs";
// Un tramo de la carga trabaja unos 40 s después de responder.
export const maxDuration = 60;

/** Compara dos textos sin que el tiempo que tarda delate cuánto se parecen. */
function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const cuerpo = z.object({ cadena: z.string().uuid(), enfriar: z.boolean().optional(), turno: z.number().int().positive().optional() });

/**
 * Siguiente tramo de la carga de resultados en segundo plano (ver `carga.ts`). Lo llama el propio servidor con una ficha de corta
 * vida (no sirve como sesión del panel) o Postgres (pg_net) con el identificador de la carga vigente, una cadena aleatoria que solo
 * conoce la base de datos y que deja de valer al terminar la carga. Responde enseguida y hace el trabajo después, para que quien
 * lo llama pueda terminar y no se acumulen funciones esperando.
 */
export async function POST(req: Request) {
  const portador = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const p = cuerpo.safeParse(await req.json().catch(() => null));
  const conFicha = portador ? await verifyPurposeToken(PROPOSITO_CARGA, portador) : false;
  // Sin ficha, solo vale quien traiga la cadena de la carga vigente (se comprueba abajo contra la base).
  if (!conFicha && !portador) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!p.success) return NextResponse.json({ error: "Datos no válidos." }, { status: conFicha ? 422 : 401 });

  const { carga } = await leerCarga().catch(() => ({ carga: null }));
  if (!conFicha && !iguales(portador, p.data.cadena)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!carga || !carga.activa || carga.cadena !== p.data.cadena) return NextResponse.json({ error: "Esa carga ya no está vigente." }, { status: 409 });

  const origen = new URL(req.url).origin;
  after(() => ejecutarTramo(p.data.cadena, origen, p.data.enfriar === true, p.data.turno));
  return NextResponse.json({ ok: true }, { status: 202 });
}
