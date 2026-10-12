import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";

/** Quién hace la acción, para el historial de los documentos. */
export async function usuarioActual(): Promise<string | null> {
  const s = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return s?.email ?? null;
}
