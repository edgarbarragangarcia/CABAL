import { NextResponse } from "next/server";
import { z } from "zod";

import { leerVozClonada, guardarVozClonada, quitarVozClonada } from "@/lib/ia-config";

export const runtime = "nodejs";

/** Qué hay configurado, sin mostrar la clave. */
export async function GET() {
  const v = await leerVozClonada();
  return NextResponse.json(v ? { activa: true, vozId: v.vozId, autorizadaPor: v.autorizadaPor, autorizadaEn: v.autorizadaEn, clave: `••••${v.clave.slice(-4)}` } : { activa: false }, { headers: { "Cache-Control": "no-store" } });
}

const cuerpo = z.object({
  clave: z.string().trim().min(10, "Pega la clave de ElevenLabs.").max(200),
  vozId: z.string().trim().min(8, "Pega el ID de la voz.").max(80).regex(/^[\w-]+$/, "El ID de la voz no es válido."),
  autorizacion: z.literal(true, { error: "Sin la confirmación de que la Dra. autorizó su voz clonada no se puede activar." }),
  autorizadaPor: z.string().trim().min(3, "Escribe el nombre de quien confirma la autorización.").max(120),
});

/** Activa la voz clonada: exige la confirmación expresa (y el nombre de quien la da) de que la Dra. la autorizó. */
export async function POST(req: Request) {
  const p = cuerpo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  // Se comprueba la clave y que la voz exista en esa cuenta antes de guardar.
  const r = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(p.data.vozId)}`, { headers: { "xi-api-key": p.data.clave }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!r || !r.ok) return NextResponse.json({ error: r?.status === 401 ? "ElevenLabs no aceptó esa clave." : "No encontré esa voz en tu cuenta de ElevenLabs: revisa el ID y la clave." }, { status: 422 });
  await guardarVozClonada({ clave: p.data.clave, vozId: p.data.vozId, autorizadaPor: p.data.autorizadaPor });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await quitarVozClonada();
  return NextResponse.json({ ok: true });
}
