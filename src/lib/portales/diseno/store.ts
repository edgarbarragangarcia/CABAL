import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ErrorPortales } from "../store";
import { sanearDiseno } from "./sanear";
import { disenoVacio, type DisenoPortal } from "./tipos";

/**
 * Guardado del diseño de un portal: el publicado, el borrador que se está editando y la instantánea anterior (para deshacer la
 * última publicación). Viven en el JSON de `portal_ajustes.ajustes` (claves `diseno`, `disenoBorrador`, `disenoAnterior`), así que no
 * hace falta ningún SQL nuevo; lo demás de los ajustes se conserva intacto al escribir.
 */

export const COOKIE_VISTA = "portal_vista";

type Crudos = Record<string, unknown>;

function cliente() {
  const c = getSupabaseServerClient();
  if (!c) throw new ErrorPortales("sin_db", "Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  return c;
}

async function leerCrudos(portalId: string): Promise<Crudos> {
  const { data, error } = await cliente().from("portal_ajustes").select("ajustes").eq("portal_id", portalId).maybeSingle();
  if (error) throw new ErrorPortales("sin_tabla", error.message || "No se pudo leer el diseño del portal.");
  return ((data?.ajustes ?? {}) as Crudos) ?? {};
}

async function escribir(portalId: string, cambios: Crudos): Promise<void> {
  const actuales = await leerCrudos(portalId);
  const { error } = await cliente()
    .from("portal_ajustes")
    .upsert({ portal_id: portalId, ajustes: { ...actuales, ...cambios }, actualizado_en: new Date().toISOString() }, { onConflict: "portal_id" });
  if (error) throw new ErrorPortales("sin_tabla", error.message || "No se pudo guardar el diseño del portal.");
}

const hayAlgo = (v: unknown) => !!v && typeof v === "object" && Object.keys(v as object).length > 0;

export type EstadoDiseno = {
  publicado: DisenoPortal;
  /** null = no hay borrador: el editor parte del publicado. */
  borrador: DisenoPortal | null;
  hayAnterior: boolean;
  publicadoEn: string | null;
};

export async function estadoDiseno(portalId: string): Promise<EstadoDiseno> {
  const a = await leerCrudos(portalId);
  return {
    publicado: sanearDiseno(a.diseno),
    borrador: hayAlgo(a.disenoBorrador) ? sanearDiseno(a.disenoBorrador) : null,
    hayAnterior: hayAlgo(a.disenoAnterior),
    publicadoEn: typeof a.disenoPublicadoEn === "string" ? a.disenoPublicadoEn : null,
  };
}

export async function guardarBorrador(portalId: string, diseno: unknown): Promise<DisenoPortal> {
  const limpio = sanearDiseno(diseno);
  await escribir(portalId, { disenoBorrador: limpio });
  return limpio;
}

export async function descartarBorrador(portalId: string): Promise<void> {
  await escribir(portalId, { disenoBorrador: null });
}

/** El borrador pasa a ser el diseño publicado; lo que estaba publicado queda como instantánea para poder deshacer. */
export async function publicarDiseno(portalId: string): Promise<EstadoDiseno> {
  const a = await leerCrudos(portalId);
  const borrador = hayAlgo(a.disenoBorrador) ? sanearDiseno(a.disenoBorrador) : null;
  if (!borrador) throw new ErrorPortales("invalido", "No hay cambios sin publicar.");
  await escribir(portalId, {
    diseno: borrador,
    disenoAnterior: hayAlgo(a.diseno) ? a.diseno : disenoVacio(),
    disenoBorrador: null,
    disenoPublicadoEn: new Date().toISOString(),
  });
  return estadoDiseno(portalId);
}

/** Vuelve al diseño anterior a la última publicación. */
export async function deshacerPublicacion(portalId: string): Promise<EstadoDiseno> {
  const a = await leerCrudos(portalId);
  if (!hayAlgo(a.disenoAnterior)) throw new ErrorPortales("invalido", "No hay una publicación anterior a la que volver.");
  await escribir(portalId, { diseno: sanearDiseno(a.disenoAnterior), disenoAnterior: null, disenoBorrador: null, disenoPublicadoEn: new Date().toISOString() });
  return estadoDiseno(portalId);
}

/** ¿Quien pide la página es el administrador con la vista previa del borrador de ESTE portal abierta? */
export async function vistaBorradorActiva(portalId: string): Promise<boolean> {
  try {
    const jar = await cookies();
    if (jar.get(COOKIE_VISTA)?.value !== portalId) return false;
    return !!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value));
  } catch {
    return false;
  }
}

/** El diseño con el que se dibuja el sitio: el publicado o, en la vista previa del editor, el borrador. null = el de siempre. */
export async function disenoParaSitio(portalId: string, vista: boolean): Promise<DisenoPortal | null> {
  try {
    const e = await estadoDiseno(portalId);
    const d = vista ? (e.borrador ?? e.publicado) : e.publicado;
    return JSON.stringify(d) === JSON.stringify(disenoVacio()) ? null : d;
  } catch {
    return null;
  }
}
