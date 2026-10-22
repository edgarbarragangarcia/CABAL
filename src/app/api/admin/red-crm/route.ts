import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_USES_PUBLIC_DEFAULTS, SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { BitrixError, getCrmSnapshot } from "@/lib/crm/bitrix24";
import { snapshotDesdeSupabase } from "@/lib/crm/desde-supabase";
import type { RedCrmResponse } from "@/lib/crm/types";

export const maxDuration = 60;

/**
 * Contactos para la red de relaciones (pestaña Red Cabal): los leads guardados en Supabase o, si no hay, los de Bitrix24.
 * `?refresh=1` ignora la copia en memoria de Bitrix24 (la de los últimos 10 minutos).
 *
 * El proxy solo protege las páginas /admin, no /api/admin: por eso la
 * sesión se verifica aquí. Y como son datos personales reales, en
 * producción no se entregan mientras el panel siga con la contraseña o el
 * secreto de sesión por defecto, que están a la vista en el repositorio.
 */
export async function GET(req: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    return reply({ status: "error", message: "Tu sesión expiró. Vuelve a iniciar sesión." }, 401);
  }

  const webhook = process.env.BITRIX24_WEBHOOK_URL?.trim();
  const falta = {
    admin: process.env.NODE_ENV === "production" && ADMIN_USES_PUBLIC_DEFAULTS,
    bitrix: !webhook,
  };
  if (falta.admin) return reply({ status: "configurar", falta });

  // Primero Supabase: los leads ya guardados (crm_leads) no dependen de que Bitrix24 responda. Solo si no hay, se pregunta a Bitrix24.
  const guardado = await snapshotDesdeSupabase({ refresh: new URL(req.url).searchParams.get("refresh") === "1" });
  if ("snapshot" in guardado) return reply({ status: "ok", snapshot: guardado.snapshot });
  if (!webhook) return reply({ status: "error", message: `${guardado.motivo} Y Bitrix24 no está configurado (BITRIX24_WEBHOOK_URL).` }, 502);

  try {
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    return reply({ status: "ok", snapshot: await getCrmSnapshot(webhook, { refresh }) });
  } catch (err) {
    const bitrix = err instanceof BitrixError ? err.message : "No fue posible leer los contactos de Bitrix24.";
    return reply({ status: "error", message: `${guardado.motivo} Y Bitrix24: ${bitrix}` }, 502);
  }
}

function reply(body: RedCrmResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
