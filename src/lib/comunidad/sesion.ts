import "server-only";

import { createHmac, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const MIEMBRO_COOKIE = "el_miembro";
const DURACION_S = 60 * 60 * 24 * 30; // 30 días

function secreto() {
  const s = process.env.COMUNIDAD_SESSION_SECRET;
  if (s) return s;
  // Sin secreto propio cualquiera podría firmar su cookie: en producción no se emiten sesiones.
  if (process.env.NODE_ENV === "production") throw new Error("Falta COMUNIDAD_SESSION_SECRET en el servidor.");
  return "comunidad-dev-secret-solo-local";
}

const firmar = (datos: string) => createHmac("sha256", secreto()).update(datos).digest("base64url");

export function crearToken(miembroId: string) {
  const datos = `${miembroId}.${Math.floor(Date.now() / 1000) + DURACION_S}`;
  return `${datos}.${firmar(datos)}`;
}

export function leerToken(token: string | undefined): string | null {
  if (!token) return null;
  const [id, exp, firma] = token.split(".");
  if (!id || !exp || !firma) return null;
  const esperada = firmar(`${id}.${exp}`);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Number(exp) > Date.now() / 1000 ? id : null;
}

export async function miembroIdActual() {
  try {
    return leerToken((await cookies()).get(MIEMBRO_COOKIE)?.value);
  } catch {
    return null;
  }
}

export const opcionesCookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: DURACION_S };

export function hashClave(clave: string) {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString("base64url")}$${scryptSync(clave, sal, 64).toString("base64url")}`;
}

export function claveValida(clave: string, guardada: string) {
  const [tipo, sal, hash] = guardada.split("$");
  if (tipo !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64url");
  const calculado = scryptSync(clave, Buffer.from(sal, "base64url"), esperado.length);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}
