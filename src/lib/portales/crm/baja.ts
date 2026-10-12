import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Enlace personal para darse de baja de los boletines: lleva el id del contacto y una firma. Quien lo recibe solo puede darse
 * de baja a sí mismo; no hay que iniciar sesión. Con un secreto propio (PORTAL_BAJA_SECRET) o, si no, el de sesión del panel.
 */

const SECRETO = process.env.PORTAL_BAJA_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? "escuela-libertad-baja-dev-cambiar-en-produccion";

const firma = (contactoId: string) => createHmac("sha256", SECRETO).update(`baja:${contactoId}`).digest("base64url").slice(0, 32);

export function enlaceDeBaja(origen: string, slug: string, contactoId: string): string {
  return `${origen}/p/${slug}/baja?c=${contactoId}&t=${firma(contactoId)}`;
}

export function bajaValida(contactoId: string, token: string): boolean {
  const esperado = Buffer.from(firma(contactoId));
  const recibido = Buffer.from(token);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}
