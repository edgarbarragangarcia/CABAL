/**
 * Autenticación mínima del panel administrativo — SIN base de datos, por
 * ahora. Un único usuario fijo y una cookie de sesión firmada (HMAC-SHA256,
 * Web Crypto: funciona igual en el middleware [Edge] y en las rutas de API
 * [Node]) para no dejar la sesión en texto plano.
 *
 * Esto es un placeholder deliberado. Antes de manejar datos reales de
 * estudiantes o del sitio, reemplazar por autenticación real (Supabase Auth
 * u otro proveedor) con contraseñas con hash y usuarios en base de datos.
 */

export const ADMIN_EMAIL = "admin@escuela.com";
export const ADMIN_PASSWORD = "12345";

export const SESSION_COOKIE = "el_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

// En producción, define ADMIN_SESSION_SECRET como variable de entorno.
// Este valor por defecto solo protege contra manipulación casual de la
// cookie, no sustituye un secreto real.
const SECRET =
  process.env.ADMIN_SESSION_SECRET ??
  "escuela-libertad-admin-dev-secret-cambiar-en-produccion";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url: string): Uint8Array {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const str = atob(b64);
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(data: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(sig);
}

/** Compara dos credenciales sin distinguir mayúsculas en el correo. */
export function checkCredentials(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD
  );
}

export type AdminSession = { email: string; exp: number };

/** Crea el valor de la cookie de sesión: `payload_b64.firma_b64`. */
export async function createSessionToken(email: string): Promise<string> {
  const payload: AdminSession = {
    email,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

/** Verifica firma y expiración; devuelve la sesión o `null`. */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<AdminSession | null> {
  if (!token) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expectedSig = await sign(payloadB64);
  if (expectedSig !== sig) return null;

  try {
    const payload = JSON.parse(
      decoder.decode(fromBase64Url(payloadB64))
    ) as AdminSession;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    if (typeof payload.email !== "string" || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}
