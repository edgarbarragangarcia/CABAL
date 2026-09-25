import { NextResponse } from "next/server";

import { PROVEEDORES, listarModelos, type Proveedor } from "@/lib/ia-config";

/** Modelos disponibles del proveedor. POST { proveedor, clave? } (sin clave, usa la guardada). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { proveedor?: string; clave?: string } | null;
  if (!body?.proveedor || !(body.proveedor in PROVEEDORES)) {
    return NextResponse.json({ error: "Proveedor no válido." }, { status: 400 });
  }
  try {
    return NextResponse.json({ modelos: await listarModelos(body.proveedor as Proveedor, body.clave) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo consultar." }, { status: 502 });
  }
}
