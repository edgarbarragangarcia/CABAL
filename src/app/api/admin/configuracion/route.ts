import { NextResponse } from "next/server";

import { ADMIN_USES_PUBLIC_DEFAULTS } from "@/lib/admin-auth";
import { PROVEEDORES, guardarConfig, resumenConfig, type Proveedor } from "@/lib/ia-config";

/** Configuración de IA: GET la resume (sin claves), POST la guarda. */
export async function GET() {
  try {
    return NextResponse.json(await resumenConfig(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  // Con la contraseña por defecto, cualquiera que lea el repositorio podría leer o cambiar las claves.
  if (process.env.NODE_ENV === "production" && ADMIN_USES_PUBLIC_DEFAULTS) {
    return NextResponse.json(
      { error: "Primero cambia la contraseña del panel (ADMIN_PASSWORD y ADMIN_SESSION_SECRET en Vercel)." },
      { status: 403 }
    );
  }
  const body = (await req.json().catch(() => null)) as { proveedor?: string; modelo?: string; clave?: string } | null;
  if (!body?.proveedor || !(body.proveedor in PROVEEDORES)) {
    return NextResponse.json({ error: "Proveedor no válido." }, { status: 400 });
  }
  try {
    await guardarConfig(body.proveedor as Proveedor, body.modelo ?? "", body.clave);
    return NextResponse.json(await resumenConfig());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar." }, { status: 502 });
  }
}
