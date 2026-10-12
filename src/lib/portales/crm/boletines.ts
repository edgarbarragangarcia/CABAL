import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ErrorPortales, type Portal } from "../store";
import { leerAjustes } from "../cms/store";
import { enlaceDeBaja } from "./baja";
import { boletinHtml, boletinTexto } from "./boletin-html";
import type { Boletin, DatosBoletin, Segmento } from "./boletines-tipos";
import { correoConfigurado, enviarCorreos, type Mensaje } from "./correo";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;

function db() {
  const c = getSupabaseServerClient();
  if (!c) throw new ErrorPortales("sin_db", "Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  return c;
}
const sinTabla = (e: { code?: string; message?: string }) => e.code === "42P01" || e.code === "PGRST205" || /schema cache|does not exist/i.test(e.message ?? "");
const fallo = (e: { code?: string; message?: string }) =>
  sinTabla(e)
    ? new ErrorPortales("sin_tabla", "Falta el CMS avanzado: ejecuta supabase/portales-cms-pro.sql en Supabase.")
    : (console.error("[portales/boletines]", e), new ErrorPortales("invalido", "No fue posible completar la acción."));

const aBoletin = (f: Fila): Boletin => ({
  id: f.id,
  portalId: f.portal_id,
  asunto: f.asunto,
  cuerpo: f.cuerpo ?? "",
  segmento: (f.segmento ?? {}) as Segmento,
  estado: f.estado,
  destinatarios: f.destinatarios ?? 0,
  enviados: f.enviados ?? 0,
  fallidos: f.fallidos ?? 0,
  enviadaEn: f.enviada_en ?? null,
  creadoPor: f.creado_por ?? "",
  creadoEn: f.creado_en,
  actualizadoEn: f.actualizado_en,
});

export async function listarBoletines(portalId: string): Promise<Boletin[]> {
  const { data, error } = await db().from("portal_campanas").select("*").eq("portal_id", portalId).order("creado_en", { ascending: false }).limit(100);
  if (error) throw fallo(error);
  return ((data ?? []) as Fila[]).map(aBoletin);
}

export async function obtenerBoletin(portalId: string, id: string): Promise<Boletin> {
  const { data, error } = await db().from("portal_campanas").select("*").eq("portal_id", portalId).eq("id", id).maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "No existe ese boletín.");
  return aBoletin(data);
}

export async function crearBoletin(portalId: string, d: DatosBoletin, autor: string): Promise<Boletin> {
  const { data, error } = await db().from("portal_campanas").insert({ portal_id: portalId, asunto: d.asunto, cuerpo: d.cuerpo, segmento: d.segmento, creado_por: autor.slice(0, 120) }).select("*").single();
  if (error) throw fallo(error);
  return aBoletin(data);
}

export async function actualizarBoletin(portalId: string, id: string, d: DatosBoletin): Promise<Boletin> {
  const actual = await obtenerBoletin(portalId, id);
  if (actual.estado !== "borrador") throw new ErrorPortales("invalido", "Un boletín ya enviado no se puede editar: duplícalo para escribir otro.");
  const { data, error } = await db().from("portal_campanas").update({ asunto: d.asunto, cuerpo: d.cuerpo, segmento: d.segmento, actualizado_en: new Date().toISOString() }).eq("portal_id", portalId).eq("id", id).select("*").single();
  if (error) throw fallo(error);
  return aBoletin(data);
}

export async function eliminarBoletin(portalId: string, id: string) {
  const { error } = await db().from("portal_campanas").delete().eq("portal_id", portalId).eq("id", id);
  if (error) throw fallo(error);
}

export type Destinatario = { id: string; nombre: string; email: string };

/**
 * A quién le llega: solo personas con correo que AUTORIZARON comunicaciones, nunca las «inactivas» salvo que se elijan
 * expresamente, y que cumplan el segmento. El tope es 5.000 por envío.
 */
export async function destinatariosDe(portalId: string, s: Segmento): Promise<Destinatario[]> {
  let q = db().from("portal_contactos").select("id,nombre,email,etapa").eq("portal_id", portalId).eq("acepta_comunicaciones", true).not("email", "is", null);
  if (s.etapas?.length) q = q.in("etapa", s.etapas);
  else q = q.neq("etapa", "inactivo");
  if (s.origenes?.length) q = q.in("origen", s.origenes);
  if (s.etiqueta) q = q.contains("etiquetas", [s.etiqueta]);
  if (s.ciudad) q = q.eq("ciudad", s.ciudad);
  const { data, error } = await q.order("creado_en", { ascending: true }).limit(5000);
  if (error) throw fallo(error);
  return ((data ?? []) as Fila[]).map((f) => ({ id: f.id, nombre: f.nombre, email: f.email }));
}

type Contexto = { portal: Portal; origen: string };

async function opciones(ctx: Contexto, b: Pick<Boletin, "asunto" | "cuerpo">, urlBaja: string) {
  const ajustes = await leerAjustes(ctx.portal.id);
  return { portal: ctx.portal.nombre, color: ctx.portal.config.colorPrimario, asunto: b.asunto, markdown: b.cuerpo, urlPortal: `${ctx.origen}/p/${ctx.portal.slug}`, urlBaja, editor: ajustes.editor || "Iniciativa de la comunidad de María Fernanda Cabal" };
}

/** Cómo se verá el correo (con un enlace de baja de ejemplo). */
export async function vistaPrevia(ctx: Contexto, b: Pick<Boletin, "asunto" | "cuerpo">) {
  const o = await opciones(ctx, b, `${ctx.origen}/p/${ctx.portal.slug}/baja`);
  return { html: boletinHtml(o), texto: boletinTexto(o) };
}

function mensajeDe(o: Awaited<ReturnType<typeof opciones>>, para: string, asunto: string): Mensaje {
  return { para, asunto, html: boletinHtml(o), texto: boletinTexto(o), encabezados: { "List-Unsubscribe": `<${o.urlBaja}>` } };
}

/** Un correo de prueba a una sola dirección (la de quien edita). No toca a la comunidad ni cambia el boletín. */
export async function enviarPrueba(ctx: Contexto, b: Pick<Boletin, "asunto" | "cuerpo">, correo: string) {
  if (!correoConfigurado().listo) throw new ErrorPortales("invalido", "No hay proveedor de correo configurado.");
  const o = await opciones(ctx, b, `${ctx.origen}/p/${ctx.portal.slug}/baja`);
  const r = await enviarCorreos([mensajeDe(o, correo, `[Prueba] ${b.asunto}`)]);
  if (r.enviados === 0) throw new ErrorPortales("invalido", r.errores[0] ?? "No se pudo enviar la prueba.");
}

/**
 * Envía el boletín a su segmento. Solo un borrador se puede enviar, y se marca «enviando» antes de empezar, así un doble clic
 * o una recarga no lo manda dos veces. Anota el envío en el historial de cada persona.
 */
export async function enviarBoletin(ctx: Contexto, id: string, autor: string): Promise<Boletin> {
  if (!correoConfigurado().listo) throw new ErrorPortales("invalido", "No hay proveedor de correo configurado: el boletín no se envió.");
  const c = db();
  const b = await obtenerBoletin(ctx.portal.id, id);
  if (b.estado !== "borrador") throw new ErrorPortales("invalido", "Este boletín ya se envió.");
  if (b.cuerpo.trim().length < 20) throw new ErrorPortales("invalido", "El boletín está casi vacío: escribe su contenido.");
  const gente = await destinatariosDe(ctx.portal.id, b.segmento);
  if (gente.length === 0) throw new ErrorPortales("invalido", "Nadie cumple ese segmento con autorización para recibir correos.");

  // Bloqueo: solo uno gana el paso de «borrador» a «enviando».
  const { data: tomado, error: e0 } = await c.from("portal_campanas").update({ estado: "enviando", destinatarios: gente.length, actualizado_en: new Date().toISOString() }).eq("id", id).eq("portal_id", ctx.portal.id).eq("estado", "borrador").select("id");
  if (e0) throw fallo(e0);
  if (!tomado || tomado.length === 0) throw new ErrorPortales("invalido", "Este boletín ya se está enviando.");

  let enviados = 0;
  let fallidos = 0;
  const errores: string[] = [];
  const entregados: string[] = [];
  try {
    const base = await opciones(ctx, b, "");
    for (let i = 0; i < gente.length; i += 100) {
      const lote = gente.slice(i, i + 100);
      const msgs: Mensaje[] = lote.map((g) => mensajeDe({ ...base, urlBaja: enlaceDeBaja(ctx.origen, ctx.portal.slug, g.id) }, g.email, b.asunto));
      const r = await enviarCorreos(msgs);
      enviados += r.enviados;
      fallidos += r.fallidos;
      errores.push(...r.errores);
      if (r.enviados === lote.length) entregados.push(...lote.map((g) => g.id));
    }
  } catch (e) {
    errores.push(e instanceof Error ? e.message : "Fallo inesperado.");
    fallidos = gente.length - enviados;
  }
  const estado = enviados === 0 ? "fallida" : "enviada";
  const { data, error } = await c.from("portal_campanas").update({ estado, enviados, fallidos, enviada_en: new Date().toISOString(), actualizado_en: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw fallo(error);
  // El historial de cada persona: «Boletín: asunto».
  for (let i = 0; i < entregados.length; i += 200) {
    await c.from("portal_interacciones").insert(entregados.slice(i, i + 200).map((contacto_id) => ({ portal_id: ctx.portal.id, contacto_id, tipo: "mensaje", texto: `Boletín: ${b.asunto}`.slice(0, 2000), autor: autor.slice(0, 80) })));
    await c.from("portal_contactos").update({ ultimo_contacto: new Date().toISOString() }).in("id", entregados.slice(i, i + 200));
  }
  if (errores.length > 0) console.error("[portales/boletines] envío:", errores.slice(0, 3));
  return aBoletin(data);
}

/** La persona se da de baja: no vuelve a recibir boletines (queda en la base, sin autorización, con la fecha en su historial). */
export async function darDeBaja(portalId: string, contactoId: string): Promise<boolean> {
  const c = db();
  const { data, error } = await c.from("portal_contactos").update({ acepta_comunicaciones: false, actualizado_en: new Date().toISOString() }).eq("portal_id", portalId).eq("id", contactoId).select("id").maybeSingle();
  if (error) throw fallo(error);
  if (!data) return false;
  await c.from("portal_interacciones").insert({ portal_id: portalId, contacto_id: contactoId, tipo: "sistema", texto: "Se dio de baja de los boletines desde el enlace del correo.", autor: "" });
  return true;
}
