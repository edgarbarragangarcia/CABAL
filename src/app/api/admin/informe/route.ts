import { NextResponse } from "next/server";

import { generarInforme } from "@/lib/informe/generar";
import { aTextoPlano } from "@/lib/informe/informe";
import { configTelegram, enviarTelegram } from "@/lib/informe/telegram";
import { resumenConfig } from "@/lib/ia-config";

export const maxDuration = 60;

/** Estado del informe semanal (qué falta configurar), sin mostrar ningún valor secreto. */
export async function GET() {
  const ia = await resumenConfig().catch(() => null);
  return NextResponse.json(
    {
      telegram: !!configTelegram(),
      cron: !!process.env.CRON_SECRET,
      ia: !!ia && (!!ia.claves[ia.proveedor] || (ia.proveedor === "anthropic" && ia.anthropicEnv)),
      programacion: "Lunes 7:00 a. m. (hora de Colombia)",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** POST { accion: "vista" | "enviar" }: genera el informe ahora, y con "enviar" lo manda a Telegram. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { accion?: string } | null;
  if (body?.accion !== "vista" && body?.accion !== "enviar") {
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  }
  try {
    const { html, conIA } = await generarInforme();
    if (body.accion === "enviar") await enviarTelegram(html);
    return NextResponse.json({ texto: aTextoPlano(html), conIA, enviado: body.accion === "enviar" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible generar el informe." }, { status: 502 });
  }
}
