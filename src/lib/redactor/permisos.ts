import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";

/** Quién es y si puede aprobar: solo el administrador principal y el rol de Dirección aprueban y editan la guía de voz. */
export async function quienEs(): Promise<{ email: string | null; esDireccion: boolean }> {
  const s = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return { email: s?.email ?? null, esDireccion: !!s && (!s.rol || s.rol === "direccion") };
}
