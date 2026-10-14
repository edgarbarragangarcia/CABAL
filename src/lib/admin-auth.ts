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

// En producción, define ADMIN_EMAIL y ADMIN_PASSWORD como variables de
// entorno: los valores por defecto están a la vista en el repositorio.
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "admin@escuela.com").trim().toLowerCase();
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "12345";

export const SESSION_COOKIE = "el_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

// En producción, define ADMIN_SESSION_SECRET como variable de entorno.
// Este valor por defecto solo protege contra manipulación casual de la
// cookie, no sustituye un secreto real.
const SECRET =
  process.env.ADMIN_SESSION_SECRET ??
  "escuela-libertad-admin-dev-secret-cambiar-en-produccion";

/**
 * `true` mientras el panel use la contraseña o el secreto de sesión por
 * defecto: cualquiera que lea el repositorio podría entrar (o firmar su
 * propia cookie). Con eso, el panel no entrega datos personales del CRM.
 */
export const ADMIN_USES_PUBLIC_DEFAULTS =
  !process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET;

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

export type AdminSession = { email: string; exp: number; /** Rol del usuario dado de alta; sin rol (o «direccion») ve todo el panel. */ rol?: string; /** Debe cambiar su clave temporal antes de usar el panel. */ cambiar?: boolean };

/** Página donde quien entra con una clave temporal la cambia. */
export const RUTA_CAMBIAR = "/admin/cambiar-clave";

/**
 * Roles del panel y lo que ve cada uno. «direccion» (y el administrador principal) ve todo. Los prefijos son de páginas (/admin/...) y
 * de las APIs que las alimentan (/api/admin/...). El login, el cierre de sesión y el asistente son de todos.
 */
export const ROLES = {
  direccion: { nombre: "Dirección política", detalle: "Todo el panel", paginas: ["*"], apis: ["*"] },
  investigacion: { nombre: "Investigación y análisis", detalle: "Análisis y gestor documental", paginas: ["analisis-publicaciones", "fuente-de-la-verdad"], apis: ["avales", "cabal-resultados", "elecciones", "monitoreo", "red-crm", "secop", "territorio", "documentos", "gestor"] },
  contenidos: { nombre: "Contenidos y comunicación", detalle: "Redactor, portales, comunidad y gestor documental", paginas: ["redactor", "portales", "comunidad", "fuente-de-la-verdad"], apis: ["portales", "comunidad", "documentos", "gestor"] },
  formacion: { nombre: "Formación política", detalle: "LMS y gestor documental", paginas: ["lms", "fuente-de-la-verdad"], apis: ["documentos", "gestor"] },
  juridico: { nombre: "Jurídico y electoral", detalle: "Gestor documental y votaciones", paginas: ["fuente-de-la-verdad", "analisis-publicaciones"], apis: ["documentos", "gestor", "elecciones", "cabal-resultados"] },
  territorial: { nombre: "Coordinación territorial", detalle: "Análisis y comunidad", paginas: ["analisis-publicaciones", "comunidad"], apis: ["avales", "cabal-resultados", "elecciones", "territorio", "red-crm", "comunidad"] },
} as const;
export type RolId = keyof typeof ROLES;
export const esRol = (r: unknown): r is RolId => typeof r === "string" && r in ROLES;

/** ¿Puede esta sesión abrir esta ruta del panel (página o API)? */
export function rutaPermitida(rol: string | undefined, pathname: string): boolean {
  if (pathname === RUTA_CAMBIAR || pathname === "/api/admin/cambiar-clave") return true;
  if (!rol || rol === "direccion" || !esRol(rol)) return !rol || rol === "direccion";
  const def = ROLES[rol];
  if (pathname === "/admin" || pathname === "/admin/") return true;
  if (pathname.startsWith("/admin/")) {
    const seccion = pathname.split("/")[2] ?? "";
    return (def.paginas as readonly string[]).includes(seccion);
  }
  if (pathname.startsWith("/api/admin/")) {
    const seccion = pathname.split("/")[3] ?? "";
    if (["login", "logout", "asistente"].includes(seccion)) return true;
    return (def.apis as readonly string[]).includes(seccion);
  }
  return true;
}

/** Crea el valor de la cookie de sesión: `payload_b64.firma_b64`. */
export async function createSessionToken(email: string, rol?: string, cambiar?: boolean): Promise<string> {
  const payload: AdminSession = {
    email,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    ...(rol && rol !== "direccion" ? { rol } : {}),
    ...(cambiar ? { cambiar: true } : {}),
  };
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

/**
 * Ficha de un solo propósito y corta vida (p. ej. la carga electoral en segundo plano, que se llama a sí misma): va firmada con
 * el mismo secreto, pero su contenido no trae `email`, así que `verifySessionToken` la rechaza y NO sirve como sesión del panel.
 */
export async function createPurposeToken(purpose: string, ttlSeconds: number): Promise<string> {
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify({ p: purpose, exp: Date.now() + ttlSeconds * 1000 })));
  return `${payloadB64}.${await sign(payloadB64)}`;
}

/** ¿Es una ficha válida, vigente y creada para este propósito? */
export async function verifyPurposeToken(purpose: string, token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig || (await sign(payloadB64)) !== sig) return false;
  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64))) as { p?: unknown; exp?: unknown };
    return payload.p === purpose && typeof payload.exp === "number" && Date.now() <= payload.exp;
  } catch {
    return false;
  }
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
