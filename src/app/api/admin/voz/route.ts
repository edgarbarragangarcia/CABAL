import { NextResponse } from "next/server";
import { z } from "zod";

import { borrarVoz, cambiarVoz, FORMATOS_VOZ, listarVoz } from "@/lib/voz/store";

export const runtime = "nodejs";
const nc = { headers: { "Cache-Control": "private, no-store" } };

/** Los textos de la voz de la Dra. y la huella de escritura medida con ellos. */
export async function GET() {
  const { huella, ...resto } = await listarVoz();
  // El vocabulario completo no viaja al navegador: solo se usa en el servidor para comprobar textos.
  return NextResponse.json({ ...resto, huella: huella ? { ...huella, vocabulario: undefined, vocabularioTotal: huella.vocabulario.length } : null, formatos: FORMATOS_VOZ }, nc);
}

const cambio = z.object({ id: z.string().uuid(), activo: z.boolean().optional(), formato: z.string().optional(), titulo: z.string().max(200).optional() });

export async function PATCH(req: Request) {
  const p = cambio.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 422 });
  return (await cambiarVoz(p.data.id, p.data)) ? NextResponse.json({ ok: true }, nc) : NextResponse.json({ error: "No se pudo guardar el cambio." }, { status: 502 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return (await borrarVoz(id)) ? NextResponse.json({ ok: true }, nc) : NextResponse.json({ error: "No se pudo borrar." }, { status: 502 });
}
