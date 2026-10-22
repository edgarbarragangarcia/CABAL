import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { estadoLeads, guardarLeads, leadsDeMunicipio, ultimoId } from "@/lib/crm/leads";

export const runtime = "nodejs";
export const maxDuration = 60;

const autorizado = async () => verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);

/** Cuántos leads hay guardados en Supabase; con ?dane=XXXXX, las personas de ese municipio (50 por página, ?pagina=N). */
export async function GET(req: Request) {
  if (!(await autorizado())) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  try {
    const params = new URL(req.url).searchParams;
    const dane = params.get("dane");
    if (dane) {
      if (!/^\d{5}$/.test(dane)) return NextResponse.json({ error: "Municipio no válido." }, { status: 422 });
      return NextResponse.json(await leadsDeMunicipio(dane, Math.max(1, Number(params.get("pagina")) || 1)), { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ ...(await estadoLeads()), webhook: !!process.env.BITRIX24_WEBHOOK_URL?.trim() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer el estado." }, { status: 502 });
  }
}

/** Trae de Bitrix24 un tramo de leads y los guarda; el panel repite hasta terminar. */
export async function POST(req: Request) {
  if (!(await autorizado())) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
  const webhook = process.env.BITRIX24_WEBHOOK_URL?.trim();
  if (!webhook) return NextResponse.json({ error: "Falta la variable BITRIX24_WEBHOOK_URL en el servidor." }, { status: 409 });
  const p = z.object({ desde: z.number().int().min(0).default(0) }).safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 422 });
  try {
    return NextResponse.json(await guardarLeads(webhook, p.data.desde));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible guardar los leads." }, { status: 502 });
  }
}

export { ultimoId };
