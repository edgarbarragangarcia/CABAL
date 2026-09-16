import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el servidor — usa la service role key (acceso
 * de lectura/escritura completo, ignora RLS) porque este cliente solo se
 * usa desde herramientas del asistente en rutas de API protegidas por el
 * admin, nunca se expone al navegador.
 *
 * Devuelve `null` en vez de lanzar error si las variables de entorno no
 * están configuradas — este proyecto no tiene base de datos conectada
 * todavía (MVP), así que el asistente debe poder avisarlo con claridad
 * en vez de romper la ruta de API.
 */
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
