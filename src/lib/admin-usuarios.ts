import "server-only";

import { createClient } from "@supabase/supabase-js";
import { scryptSync, timingSafeEqual } from "node:crypto";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { SQL_POR_ARCHIVO } from "@/lib/gestor/sql";
import { ADMIN_EMAIL } from "@/lib/admin-auth";

/**
 * Quién puede entrar al panel. Las credenciales (correo y clave) viven en Supabase Auth: aquí se comprueban con
 * `signInWithPassword`, y se crean o cambian con la API de administración de Auth. La tabla admin_usuarios guarda a quién se dio acceso,
 * con qué rol y si sigue activo. El administrador principal (ADMIN_EMAIL) también es un usuario de Supabase Auth y es el único que da de
 * alta, desactiva o elimina a los demás.
 */
export type UsuarioPanel = { email: string; rol: string; nombre: string; activo: boolean; creado_en: string; ultimo_ingreso: string | null; creado_por: string | null };

const TABLA = "admin_usuarios";
const COLUMNAS = "email, rol, nombre, activo, creado_en, ultimo_ingreso, creado_por";
export const CLAVE_MINIMA = 8;

/** Marca de las filas cuya clave ya vive en Supabase Auth. */
const CLAVE_EN_AUTH = "supabase-auth";

/** Cliente aparte, sin sesión guardada, solo para comprobar una clave (la llave se usa del lado del servidor, nunca llega al navegador). */
function clienteAuth() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

/** ¿El servidor tiene lo necesario para hablar con Supabase Auth (URL y una llave)? */
export const supabaseAuthConfigurado = () => !!clienteAuth();

let principalGuardado: { en: number; email: string } | null = null;

/**
 * El correo del administrador principal, según Supabase Auth: el usuario marcado con `app_metadata.principal` (lo hace
 * scripts/crear-admin.mjs) o, si ninguno lo está, el primero que se creó en el proyecto. Si existe la variable ADMIN_EMAIL, manda ella.
 */
export async function emailPrincipal(): Promise<string> {
  if (ADMIN_EMAIL) return ADMIN_EMAIL;
  if (principalGuardado && Date.now() - principalGuardado.en < 10 * 60_000) return principalGuardado.email;
  const c = getSupabaseServerClient();
  if (!c) return "";
  const { data, error } = await c.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return "";
  const usuarios = data.users.filter((u) => !!u.email);
  const elegido = usuarios.find((u) => u.app_metadata?.principal === true) ?? [...usuarios].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
  const email = elegido?.email?.toLowerCase() ?? "";
  principalGuardado = { en: Date.now(), email };
  return email;
}

export async function esPrincipal(email: string): Promise<boolean> {
  const p = await emailPrincipal();
  return !!p && p === email.trim().toLowerCase();
}

/** Lo que Supabase Auth contesta a un intento de entrada (su mensaje sirve para saber qué falla: clave, llave del proyecto, correo sin confirmar…). */
export async function intentarEnSupabase(email: string, clave: string): Promise<{ ok: boolean; mensaje?: string; estado?: number }> {
  const c = clienteAuth();
  if (!c || !email || !clave) return { ok: false, mensaje: "Supabase no está configurado" };
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: clave });
  if (!error && data.user) return { ok: true };
  return { ok: false, mensaje: error?.message ?? "sin respuesta", estado: error?.status };
}

/**
 * Diagnóstico TEMPORAL del login: a qué proyecto de Supabase apunta el servidor y si el correo existe como usuario allí. Se muestra en el
 * mensaje de error para saber si la clave está mal o si el usuario está en otro proyecto. Quitar cuando el acceso funcione.
 */
export async function diagnosticarUsuario(email: string): Promise<string> {
  const proyecto = (process.env.SUPABASE_URL ?? "").replace(/^https?:\/\//, "").split(".")[0] || "sin URL";
  const c = getSupabaseServerClient();
  if (!c) return `proyecto ${proyecto}; sin llave de servicio`;
  const correo = email.trim().toLowerCase();
  for (let pagina = 1; pagina <= 5; pagina++) {
    const { data, error } = await c.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) return `proyecto ${proyecto}; no se pudo listar usuarios (${error.message})`;
    const u = data.users.find((x) => x.email?.toLowerCase() === correo);
    if (u) return `proyecto ${proyecto}; el usuario existe${u.email_confirmed_at ? "" : " pero NO está confirmado"}`;
    if (data.users.length < 200) break;
  }
  return `proyecto ${proyecto}; el usuario NO existe en ese proyecto`;
}

/** ¿Son correctos este correo y esta clave en Supabase Auth? */
export async function autenticarConSupabase(email: string, clave: string): Promise<boolean> {
  const c = clienteAuth();
  if (!c || !email || !clave) return false;
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: clave });
  return !error && !!data.user;
}

/** El id del usuario de Supabase Auth con ese correo (se busca en la lista: son pocos usuarios). */
async function idEnAuth(email: string): Promise<string | null> {
  const c = getSupabaseServerClient();
  if (!c) return null;
  const correo = email.trim().toLowerCase();
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await c.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) return null;
    const u = data.users.find((x) => x.email?.toLowerCase() === correo);
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Crea el usuario en Supabase Auth, o le pone esta clave si ya existía. */
async function ponerClaveEnAuth(email: string, clave: string): Promise<string | null> {
  const c = getSupabaseServerClient();
  if (!c) return "Supabase no está configurado.";
  const correo = email.trim().toLowerCase();
  const id = await idEnAuth(correo);
  const r = id ? await c.auth.admin.updateUserById(id, { password: clave }) : await c.auth.admin.createUser({ email: correo, password: clave, email_confirm: true });
  return r.error ? "Supabase no aceptó la clave (revisa que cumpla los requisitos de Authentication → Policies)." : null;
}

/** Cambia la clave de cualquier usuario (el principal también) en Supabase Auth. */
export const cambiarClaveEnAuth = ponerClaveEnAuth;

function claveCoincide(clave: string, guardada: string): boolean {
  const [tipo, sal, hash] = guardada.split("$");
  if (tipo !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "hex");
  const dado = scryptSync(clave, Buffer.from(sal, "hex"), esperado.length);
  return dado.length === esperado.length && timingSafeEqual(dado, esperado);
}

export const correoValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 160;

/** ¿Existe la tabla? Si no, el SQL que la crea. */
export async function estadoUsuarios(): Promise<{ disponible: boolean; sql?: string; error?: string }> {
  const c = getSupabaseServerClient();
  if (!c) return { disponible: false, error: "Supabase no está configurado en este servidor." };
  const { error } = await c.from(TABLA).select("email").limit(1);
  if (error) return { disponible: false, sql: SQL_POR_ARCHIVO.usuarios, error: "Falta crear la tabla de usuarios en Supabase." };
  return { disponible: true };
}

export async function listarUsuarios(): Promise<UsuarioPanel[]> {
  const c = getSupabaseServerClient();
  if (!c) return [];
  const { data } = await c.from(TABLA).select(COLUMNAS).order("creado_en", { ascending: false });
  return (data ?? []) as UsuarioPanel[];
}

/**
 * Verifica correo y clave de un usuario dado de alta: la clave se comprueba en Supabase Auth y el acceso (activo, rol) en admin_usuarios.
 * Quien se dio de alta antes de que existiera Supabase Auth tenía la clave guardada con hash aquí: en su primer ingreso correcto se pasa
 * a Supabase Auth y el hash deja de usarse.
 */
export async function verificarUsuario(email: string, clave: string): Promise<{ rol: string; cambiar: boolean } | null> {
  const c = getSupabaseServerClient();
  if (!c) return null;
  const correo = email.trim().toLowerCase();
  // Con las columnas nuevas (rol, clave temporal) si ya existen; si falta el SQL, entra como antes.
  let r = await c.from(TABLA).select("email, clave_hash, activo, rol, cambiar_clave").eq("email", correo).maybeSingle();
  if (r.error) r = (await c.from(TABLA).select("email, clave_hash, activo, rol").eq("email", correo).maybeSingle()) as typeof r;
  if (r.error) r = (await c.from(TABLA).select("email, clave_hash, activo").eq("email", correo).maybeSingle()) as typeof r;
  const data = r.data as { email: string; clave_hash: string; activo: boolean; rol?: string; cambiar_clave?: boolean } | null;
  if (!data || !data.activo) return null;
  let ok = await autenticarConSupabase(correo, clave);
  if (!ok && data.clave_hash !== CLAVE_EN_AUTH && claveCoincide(clave, String(data.clave_hash))) {
    // Clave antigua correcta: se pasa a Supabase Auth.
    if ((await ponerClaveEnAuth(correo, clave)) === null) {
      await c.from(TABLA).update({ clave_hash: CLAVE_EN_AUTH }).eq("email", data.email);
      ok = true;
    }
  }
  if (!ok) return null;
  await c.from(TABLA).update({ ultimo_ingreso: new Date().toISOString() }).eq("email", data.email);
  return { rol: data.rol ?? "direccion", cambiar: data.cambiar_clave === true };
}

/** ¿Sigue vigente este usuario? (para cerrar sesiones de quien se desactivó) */
export async function usuarioActivo(email: string): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c) return false;
  const { data } = await c.from(TABLA).select("activo").eq("email", email.trim().toLowerCase()).maybeSingle();
  return !!data?.activo;
}

export async function crearUsuario(p: { email: string; nombre: string; clave: string; rol: string; creadoPor: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = getSupabaseServerClient();
  if (!c) return { ok: false, error: "Supabase no está configurado." };
  const email = p.email.trim().toLowerCase();
  if (!correoValido(email)) return { ok: false, error: "Escribe un correo válido." };
  if (p.clave.length < CLAVE_MINIMA) return { ok: false, error: `La clave debe tener al menos ${CLAVE_MINIMA} caracteres.` };
  const { data: existe } = await c.from(TABLA).select("email").eq("email", email).maybeSingle();
  if (existe) return { ok: false, error: "Ese correo ya tiene usuario." };
  const falla = await ponerClaveEnAuth(email, p.clave);
  if (falla) return { ok: false, error: falla };
  const { error } = await c.from(TABLA).insert({ email, nombre: p.nombre.trim().slice(0, 120), clave_hash: CLAVE_EN_AUTH, rol: p.rol, creado_por: p.creadoPor, cambiar_clave: true });
  if (error) return { ok: false, error: error.code === "23505" ? "Ese correo ya tiene usuario." : "No se pudo crear el usuario." };
  return { ok: true };
}

export async function actualizarUsuario(email: string, cambios: { activo?: boolean; clave?: string; nombre?: string; rol?: string; claveTemporal?: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = getSupabaseServerClient();
  if (!c) return { ok: false, error: "Supabase no está configurado." };
  const fila: Record<string, unknown> = {};
  if (typeof cambios.activo === "boolean") fila.activo = cambios.activo;
  if (typeof cambios.rol === "string") fila.rol = cambios.rol;
  if (typeof cambios.nombre === "string") fila.nombre = cambios.nombre.trim().slice(0, 120);
  if (typeof cambios.clave === "string") {
    if (cambios.clave.length < CLAVE_MINIMA) return { ok: false, error: `La clave debe tener al menos ${CLAVE_MINIMA} caracteres.` };
    const falla = await ponerClaveEnAuth(email, cambios.clave);
    if (falla) return { ok: false, error: falla };
    fila.clave_hash = CLAVE_EN_AUTH;
    fila.cambiar_clave = cambios.claveTemporal ?? false;
  }
  if (Object.keys(fila).length === 0) return { ok: false, error: "Nada que cambiar." };
  const { error } = await c.from(TABLA).update(fila).eq("email", email.trim().toLowerCase());
  return error ? { ok: false, error: "No se pudo guardar el cambio." } : { ok: true };
}

export async function eliminarUsuario(email: string): Promise<boolean> {
  const c = getSupabaseServerClient();
  if (!c) return false;
  const { error } = await c.from(TABLA).delete().eq("email", email.trim().toLowerCase());
  if (error) return false;
  // También se quita su cuenta de Supabase Auth (si no, su clave seguiría existiendo).
  const id = await idEnAuth(email);
  if (id) await c.auth.admin.deleteUser(id);
  return true;
}
