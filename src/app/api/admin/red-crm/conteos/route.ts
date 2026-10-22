import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { BitrixError } from "@/lib/crm/bitrix24";
import { contar, resumenConteos } from "@/lib/crm/conteos";

export const runtime = "nodejs";
export const maxDuration = 60;

async function autorizado() {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Los conteos guardados: cuántos leads hay en cada ciudad y departamento. */
export async function GET() {
  if (!(await autorizado())) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  try {
    return NextResponse.json({ ...(await resumenConteos()), webhook: !!process.env.BITRIX24_WEBHOOK_URL?.trim() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer los conteos." }, { status: 502 });
  }
}

/** Calcula (con Bitrix24) un tramo de los conteos y lo guarda; el panel repite hasta terminar. */
export async function POST(req: Request) {
  if (!(await autorizado())) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  const webhook = process.env.BITRIX24_WEBHOOK_URL?.trim();
  if (!webhook) return NextResponse.json({ error: "Falta la variable BITRIX24_WEBHOOK_URL en el servidor." }, { status: 409 });
  const p = z.object({ desde: z.number().int().min(0).default(0) }).safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 422 });
  try {
    return NextResponse.json(await contar(webhook, p.data.desde));
  } catch (e) {
    return NextResponse.json({ error: e instanceof BitrixError || e instanceof Error ? e.message : "No fue posible contar." }, { status: 502 });
  }
}
