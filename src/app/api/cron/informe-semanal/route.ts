import { NextResponse } from "next/server";

import { generarInforme } from "@/lib/informe/generar";
import { configTelegram, enviarTelegram } from "@/lib/informe/telegram";

export const maxDuration = 60;

/**
 * Informe semanal por Telegram, lanzado por Vercel Cron (vercel.json: lunes 12:00 UTC =
 * 7:00 a. m. en Colombia). Vercel manda `Authorization: Bearer $CRON_SECRET`; sin ese
 * secreto configurado la ruta no responde, para que nadie más pueda dispararla.
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Falta configurar CRON_SECRET en Vercel." }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!configTelegram()) {
    return NextResponse.json({ error: "Falta configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en Vercel." }, { status: 500 });
  }
  try {
    const { html, conIA } = await generarInforme();
    await enviarTelegram(html);
    return NextResponse.json({ ok: true, conIA, caracteres: html.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible enviar el informe." }, { status: 502 });
  }
}
