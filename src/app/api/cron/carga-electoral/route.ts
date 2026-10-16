import { timingSafeEqual } from "node:crypto";

import { NextResponse, after } from "next/server";

import { ejecutarTramo, estadoDeCarga, iniciarCarga } from "@/lib/gov-data/elecciones/carga";
import { NIVELES_SINCRONIZACION } from "@/lib/gov-data/elecciones/sincronizar";

export const runtime = "nodejs";
export const maxDuration = 60;

const iguales = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Arranque automático de la carga de resultados en Supabase: Vercel lo llama cada día. Si no hay una carga en marcha, abre una (hasta
 * municipios, o el nivel de CARGA_AUTOMATICA_NIVEL) y deja el primer tramo; de ahí en adelante la carga sigue sola (por Postgres, sin
 * pantalla abierta). Lo ya guardado se salta, así que si todo está cargado termina enseguida. Vercel manda `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Falta configurar CRON_SECRET en Vercel." }, { status: 500 });
  const portador = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!portador || !iguales(portador, secreto)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const { carga } = await estadoDeCarga();
    if (carga?.enMarcha) return NextResponse.json({ ok: true, accion: "ya-en-marcha" });
    const pedido = Number(process.env.CARGA_AUTOMATICA_NIVEL);
    const nivelMax = (NIVELES_SINCRONIZACION as readonly number[]).includes(pedido) ? pedido : 3;
    const inicio = await iniciarCarga({ nivelMax });
    if (!inicio.ok) return NextResponse.json({ ok: false, motivo: inicio.motivo }, { status: inicio.motivo === "en-marcha" ? 200 : 409 });
    const origen = new URL(req.url).origin;
    after(() => ejecutarTramo(inicio.cadena, origen));
    return NextResponse.json({ ok: true, accion: "iniciada", nivelMax });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo iniciar la carga." }, { status: 502 });
  }
}
