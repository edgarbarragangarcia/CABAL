import "server-only";

import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { ErrorComunidad, miembroPorId, type Miembro } from "./store";
import { miembroIdActual } from "./sesion";

export const ip = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

export async function limitar(req: Request, cual: string) {
  const r = await rateLimit(`comunidad:${cual}:${ip(req)}`);
  return r.success ? null : NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
}

export async function exigirMiembro(): Promise<Miembro | NextResponse> {
  const id = await miembroIdActual();
  const m = id ? await miembroPorId(id).catch(() => null) : null;
  return m ?? NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
}

export function errorJson(e: unknown) {
  if (e instanceof ErrorComunidad) return NextResponse.json({ error: e.message }, { status: 400 });
  console.error("[comunidad]", e);
  return NextResponse.json({ error: "No fue posible completar la acción." }, { status: 500 });
}
