import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { SQL_POR_ARCHIVO } from "@/lib/gestor/sql";

/**
 * Usuarios del panel guardados en Supabase (tabla admin_usuarios). La clave se guarda con scrypt y sal propia. El usuario del
 * entorno (ADMIN_EMAIL) sigue existiendo y es el único que da de alta, desactiva o elimina a los demás.
 */
export type UsuarioPanel = { email: string; rol: string; nombre: string; activo: boolean; creado_en: string; ultimo_ingreso: string | null; creado_por: string | null };

const TABLA = "admin_usuarios";
const COLUMNAS = "email, rol, nombre, activo, creado_en, ultimo_ingreso, creado_por";
export const CLAVE_MINIMA = 8;

export function hashDeClave(clave: string): string {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString("hex")}$${scryptSync(clave, sal, 64).toString("hex")}`;
}

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

/** Verifica correo y clave contra la tabla; si coincide y está activo, anota el ingreso. */
export async function verificarUsuario(email: string, clave: string): Promise<{ rol: string; cambiar: boolean } | null> {
  const c = getSupabaseServerClient();
  if (!c) return null;
  const correo = email.trim().toLowerCase();
  // Con las columnas nuevas (rol, clave temporal) si ya existen; si falta el SQL, entra como antes.
  let r = await c.from(TABLA).select("email, clave_hash, activo, rol, cambiar_clave").eq("email", correo).maybeSingle();
  if (r.error) r = (await c.from(TABLA).select("email, clave_hash, activo, rol").eq("email", correo).maybeSingle()) as typeof r;
  if (r.error) r = (await c.from(TABLA).select("email, clave_hash, activo").eq("email", correo).maybeSingle()) as typeof r;
  const data = r.data as { email: string; clave_hash: string; activo: boolean; rol?: string; cambiar_clave?: boolean } | null;
  if (!data || !data.activo || !claveCoincide(clave, String(data.clave_hash))) return null;
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
  const { error } = await c.from(TABLA).insert({ email, nombre: p.nombre.trim().slice(0, 120), clave_hash: hashDeClave(p.clave), rol: p.rol, creado_por: p.creadoPor, cambiar_clave: true });
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
    fila.clave_hash = hashDeClave(cambios.clave);
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
  return !error;
}
