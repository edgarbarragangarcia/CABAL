import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { slugDeTitulo, slugUnico } from "../cms/puro";
import { ErrorPortales } from "../store";
import {
  ETAPAS,
  ORIGENES,
  resumenCrmVacio,
  type Contacto,
  type DatosContacto,
  type DatosEvento,
  type DatosInscripcion,
  type DatosSuscripcion,
  type Etapa,
  type EstadoInscripcion,
  type Evento,
  type FiltroContactos,
  type Inscripcion,
  type Interaccion,
  type Origen,
  type ResumenCrm,
  type TipoInteraccion,
} from "./tipos";

/**
 * Acceso a datos del CRM de los portales (ver supabase/portales-crm.sql). Todos los portales comparten las tablas y cada fila
 * lleva su `portal_id`. Solo servidor, con la service role key (las tablas tienen RLS sin políticas: hay correos y teléfonos).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;

function db() {
  const c = getSupabaseServerClient();
  if (!c) throw new ErrorPortales("sin_db", "Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  return c;
}

const sinTabla = (e: { code?: string; message?: string }) => e.code === "42P01" || e.code === "PGRST205" || /schema cache|does not exist/i.test(e.message ?? "");
function fallo(e: { code?: string; message?: string }) {
  if (sinTabla(e)) return new ErrorPortales("sin_tabla", "Faltan las tablas del CRM: ejecuta supabase/portales-crm.sql en Supabase.");
  if (e.code === "23505") return new ErrorPortales("duplicado", "Ya existe una persona con ese correo en este portal.");
  if (e.code === "23514") return new ErrorPortales("invalido", "Algún dato no cumple las reglas de la base (revisa los largos y el correo).");
  console.error("[portales/crm]", e);
  return new ErrorPortales("invalido", "No fue posible completar la acción.");
}

const TABLAS = ["portal_contactos", "portal_interacciones", "portal_eventos", "portal_inscripciones"] as const;

/** ¿Están las tablas del CRM creadas? (GET y no HEAD: una petición HEAD a una tabla inexistente no devuelve error.) */
export async function hayCrm(): Promise<boolean> {
  const c = db();
  for (const t of TABLAS) {
    const { error } = await c.from(t).select("portal_id").limit(1);
    if (error && sinTabla(error)) return false;
    if (error && error.code !== "42703") throw fallo(error);
  }
  return true;
}

// ------------------------------------------------------------ contactos ---

const aContacto = (f: Fila, afiliado = false): Contacto => ({
  id: f.id,
  portalId: f.portal_id,
  nombre: f.nombre,
  email: f.email ?? null,
  telefono: f.telefono ?? "",
  ciudad: f.ciudad ?? "",
  departamento: f.departamento ?? "",
  intereses: Array.isArray(f.intereses) ? f.intereses : [],
  etiquetas: Array.isArray(f.etiquetas) ? f.etiquetas : [],
  etapa: f.etapa,
  origen: f.origen,
  aceptaComunicaciones: !!f.acepta_comunicaciones,
  consentimientoEn: f.consentimiento_en ?? null,
  notas: f.notas ?? "",
  ultimoContacto: f.ultimo_contacto ?? null,
  esAfiliado: afiliado || !!f.miembro_id,
  creadoEn: f.creado_en,
  actualizadoEn: f.actualizado_en,
});

/** Los correos de estas filas que también son afiliados a la comunidad de María Fernanda Cabal. */
async function afiliadosEntre(filas: Fila[]): Promise<Set<string>> {
  const correos = [...new Set(filas.map((f) => String(f.email ?? "").toLowerCase()).filter(Boolean))];
  if (correos.length === 0) return new Set();
  const { data, error } = await db().from("miembros").select("email").in("email", correos);
  if (error) return new Set(); // sin comunidad creada o sin acceso: simplemente no se marca
  return new Set((data ?? []).map((m: Fila) => String(m.email).toLowerCase()));
}

const limpiarBusqueda = (q: string) => q.replace(/[,()%*\\_]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

function aplicarFiltro(consulta: any, f: FiltroContactos) {
  let c = consulta;
  if (f.etapa) c = c.eq("etapa", f.etapa);
  if (f.origen) c = c.eq("origen", f.origen);
  if (f.etiqueta) c = c.contains("etiquetas", [f.etiqueta]);
  if (f.ciudad) c = c.eq("ciudad", f.ciudad);
  if (f.sinConsentimiento) c = c.eq("acepta_comunicaciones", false);
  const q = f.q ? limpiarBusqueda(f.q) : "";
  if (q) c = c.or(`nombre.ilike.%${q}%,email.ilike.%${q}%,telefono.ilike.%${q}%,ciudad.ilike.%${q}%`);
  return c;
}

export async function listarContactos(portalId: string, f: FiltroContactos = {}): Promise<{ contactos: Contacto[]; total: number; pagina: number; porPagina: number }> {
  const porPagina = Math.min(Math.max(f.porPagina ?? 50, 1), 200);
  const pagina = Math.max(f.pagina ?? 1, 1);
  const desde = (pagina - 1) * porPagina;
  const consulta = aplicarFiltro(db().from("portal_contactos").select("*", { count: "exact" }).eq("portal_id", portalId), f)
    .order("creado_en", { ascending: false })
    .range(desde, desde + porPagina - 1);
  const { data, error, count } = await consulta;
  if (error) throw fallo(error);
  const filas = (data ?? []) as Fila[];
  const afiliados = await afiliadosEntre(filas);
  return { contactos: filas.map((x) => aContacto(x, afiliados.has(String(x.email ?? "").toLowerCase()))), total: count ?? filas.length, pagina, porPagina };
}

async function contar(portalId: string, filtro: (c: any) => any): Promise<number> {
  const { count, error } = await filtro(db().from("portal_contactos").select("id", { count: "exact", head: true }).eq("portal_id", portalId));
  if (error) throw fallo(error);
  return count ?? 0;
}

export async function resumenCrm(portalId: string): Promise<ResumenCrm> {
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [total, nuevos30d, conConsentimiento, ...etapas] = await Promise.all([
    contar(portalId, (c) => c),
    contar(portalId, (c) => c.gte("creado_en", hace30)),
    contar(portalId, (c) => c.eq("acepta_comunicaciones", true)),
    ...ETAPAS.map((e) => contar(portalId, (c) => c.eq("etapa", e.id))),
  ]);
  const porEtapa = { ...resumenCrmVacio.porEtapa };
  ETAPAS.forEach((e, i) => (porEtapa[e.id] = etapas[i]));
  // Origen y ciudad: se agrupan en el servidor sobre una muestra acotada (los 5.000 más recientes).
  const { data, error } = await db().from("portal_contactos").select("origen,ciudad,email,miembro_id").eq("portal_id", portalId).order("creado_en", { ascending: false }).limit(5000);
  if (error) throw fallo(error);
  const filas = (data ?? []) as Fila[];
  const origenes = new Map<string, number>();
  const ciudades = new Map<string, number>();
  for (const f of filas) {
    origenes.set(f.origen, (origenes.get(f.origen) ?? 0) + 1);
    const ciudad = String(f.ciudad ?? "").trim();
    if (ciudad) ciudades.set(ciudad, (ciudades.get(ciudad) ?? 0) + 1);
  }
  const afiliados = (await afiliadosEntre(filas)).size;
  return {
    total,
    nuevos30d,
    conConsentimiento,
    porEtapa,
    porOrigen: ORIGENES.map((o) => ({ origen: o.id as Origen, n: origenes.get(o.id) ?? 0 })).filter((o) => o.n > 0).sort((a, b) => b.n - a.n),
    ciudades: [...ciudades].map(([ciudad, n]) => ({ ciudad, n })).sort((a, b) => b.n - a.n).slice(0, 8),
    afiliados,
  };
}

const aInteraccion = (f: Fila): Interaccion => ({ id: f.id, contactoId: f.contacto_id, tipo: f.tipo, texto: f.texto, autor: f.autor ?? "", creadoEn: f.creado_en });

async function anotar(portalId: string, contactoId: string, tipo: TipoInteraccion, texto: string, autor: string) {
  const { error } = await db().from("portal_interacciones").insert({ portal_id: portalId, contacto_id: contactoId, tipo, texto: texto.slice(0, 2000), autor: autor.slice(0, 80) });
  if (error && !sinTabla(error)) console.error("[portales/crm] historial:", error.message);
}

export type FichaContacto = { contacto: Contacto; interacciones: Interaccion[]; eventos: { eventoId: string; titulo: string; iniciaEn: string; estado: EstadoInscripcion }[] };

export async function obtenerContacto(portalId: string, id: string): Promise<FichaContacto> {
  const c = db();
  const { data, error } = await c.from("portal_contactos").select("*").eq("portal_id", portalId).eq("id", id).maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "No existe esa persona.");
  const [{ data: inter, error: e2 }, { data: insc, error: e3 }, afiliados] = await Promise.all([
    c.from("portal_interacciones").select("*").eq("portal_id", portalId).eq("contacto_id", id).order("creado_en", { ascending: false }).limit(100),
    c.from("portal_inscripciones").select("estado,evento:portal_eventos(id,titulo,inicia_en)").eq("portal_id", portalId).eq("contacto_id", id),
    afiliadosEntre([data]),
  ]);
  if (e2) throw fallo(e2);
  if (e3) throw fallo(e3);
  return {
    contacto: aContacto(data, afiliados.has(String(data.email ?? "").toLowerCase())),
    interacciones: (inter ?? []).map(aInteraccion),
    eventos: ((insc ?? []) as Fila[]).filter((x) => x.evento).map((x) => ({ eventoId: x.evento.id, titulo: x.evento.titulo, iniciaEn: x.evento.inicia_en, estado: x.estado })).sort((a, b) => b.iniciaEn.localeCompare(a.iniciaEn)),
  };
}

function filaContacto(d: DatosContacto) {
  return {
    nombre: d.nombre,
    email: d.email || null,
    telefono: d.telefono,
    ciudad: d.ciudad,
    departamento: d.departamento,
    intereses: d.intereses,
    etiquetas: d.etiquetas,
    etapa: d.etapa,
    origen: d.origen,
    acepta_comunicaciones: d.aceptaComunicaciones,
    consentimiento_en: d.aceptaComunicaciones ? new Date().toISOString() : null,
    notas: d.notas,
  };
}

export async function crearContacto(portalId: string, d: DatosContacto, autor: string): Promise<Contacto> {
  const { data, error } = await db().from("portal_contactos").insert({ portal_id: portalId, ...filaContacto(d) }).select("*").single();
  if (error) throw fallo(error);
  await anotar(portalId, data.id, "sistema", "Agregado a mano al portal.", autor);
  return aContacto(data);
}

export async function actualizarContacto(portalId: string, id: string, d: DatosContacto, autor: string): Promise<Contacto> {
  const { data: antes, error: e0 } = await db().from("portal_contactos").select("*").eq("portal_id", portalId).eq("id", id).maybeSingle();
  if (e0) throw fallo(e0);
  if (!antes) throw new ErrorPortales("no_encontrado", "No existe esa persona.");
  const fila = filaContacto(d);
  // El consentimiento conserva la fecha original mientras siga dado; si ya estaba, no se vuelve a fechar.
  if (antes.acepta_comunicaciones && d.aceptaComunicaciones) fila.consentimiento_en = antes.consentimiento_en;
  const { data, error } = await db().from("portal_contactos").update({ ...fila, origen: antes.origen, actualizado_en: new Date().toISOString() }).eq("portal_id", portalId).eq("id", id).select("*").single();
  if (error) throw fallo(error);
  if (antes.etapa !== d.etapa) await anotar(portalId, id, "etapa", `Etapa: ${nombreEtapa(antes.etapa)} → ${nombreEtapa(d.etapa)}`, autor);
  return aContacto(data);
}

const nombreEtapa = (e: string) => ETAPAS.find((x) => x.id === e)?.nombre ?? e;

export async function eliminarContacto(portalId: string, id: string) {
  const { error } = await db().from("portal_contactos").delete().eq("portal_id", portalId).eq("id", id);
  if (error) throw fallo(error);
}

export async function agregarInteraccion(portalId: string, contactoId: string, tipo: "nota" | "llamada" | "mensaje" | "reunion", texto: string, autor: string): Promise<Interaccion> {
  const { data: c, error: e0 } = await db().from("portal_contactos").select("id").eq("portal_id", portalId).eq("id", contactoId).maybeSingle();
  if (e0) throw fallo(e0);
  if (!c) throw new ErrorPortales("no_encontrado", "No existe esa persona.");
  const { data, error } = await db().from("portal_interacciones").insert({ portal_id: portalId, contacto_id: contactoId, tipo, texto, autor: autor.slice(0, 80) }).select("*").single();
  if (error) throw fallo(error);
  if (tipo !== "nota") await db().from("portal_contactos").update({ ultimo_contacto: new Date().toISOString() }).eq("id", contactoId);
  return aInteraccion(data);
}

/** Cambios sobre varios contactos a la vez: etapa, etiquetas o eliminar. */
export async function cambioMasivo(portalId: string, o: { ids: string[]; etapa?: Etapa; agregarEtiquetas?: string[]; eliminar?: boolean }, autor: string): Promise<number> {
  const c = db();
  if (o.eliminar) {
    const { error, count } = await c.from("portal_contactos").delete({ count: "exact" }).eq("portal_id", portalId).in("id", o.ids);
    if (error) throw fallo(error);
    return count ?? o.ids.length;
  }
  if (o.etapa) {
    const { data, error } = await c.from("portal_contactos").update({ etapa: o.etapa, actualizado_en: new Date().toISOString() }).eq("portal_id", portalId).in("id", o.ids).select("id");
    if (error) throw fallo(error);
    await Promise.all((data ?? []).map((f: Fila) => anotar(portalId, f.id, "etapa", `Etapa cambiada a ${nombreEtapa(o.etapa!)} (acción en bloque)`, autor)));
  }
  if (o.agregarEtiquetas?.length) {
    const { data, error } = await c.from("portal_contactos").select("id,etiquetas").eq("portal_id", portalId).in("id", o.ids);
    if (error) throw fallo(error);
    for (const f of (data ?? []) as Fila[]) {
      const uniones = [...new Set([...(f.etiquetas ?? []), ...o.agregarEtiquetas])].slice(0, 12);
      const { error: e2 } = await c.from("portal_contactos").update({ etiquetas: uniones }).eq("id", f.id);
      if (e2) throw fallo(e2);
    }
  }
  return o.ids.length;
}

const reCorreo = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Importa una lista (ya autorizada por quien la sube): crea los nuevos y omite los repetidos o sin datos de contacto. */
export async function importarContactos(
  portalId: string,
  filas: { nombre: string; email: string; telefono: string; ciudad: string; etiquetas: string }[],
  autor: string
): Promise<{ creados: number; omitidos: { fila: number; motivo: string }[] }> {
  const c = db();
  const omitidos: { fila: number; motivo: string }[] = [];
  const candidatos: Fila[] = [];
  const vistos = new Set<string>();
  filas.forEach((f, i) => {
    const nombre = f.nombre.trim();
    const email = f.email.trim().toLowerCase();
    const telefono = f.telefono.trim();
    if (nombre.length < 2) return omitidos.push({ fila: i + 1, motivo: "Sin nombre." });
    if (email && !reCorreo.test(email)) return omitidos.push({ fila: i + 1, motivo: "Correo no válido." });
    if (!email && telefono.replace(/\D/g, "").length < 7) return omitidos.push({ fila: i + 1, motivo: "Sin correo ni teléfono." });
    if (email && vistos.has(email)) return omitidos.push({ fila: i + 1, motivo: "Correo repetido en la lista." });
    if (email) vistos.add(email);
    candidatos.push({
      portal_id: portalId,
      nombre: nombre.slice(0, 120),
      email: email || null,
      telefono: telefono.slice(0, 30),
      ciudad: f.ciudad.trim().slice(0, 80),
      etiquetas: f.etiquetas.split(/[;,|]/).map((x) => x.trim()).filter(Boolean).slice(0, 12),
      origen: "importado",
      // Importar no es consentimiento: quien sube la lista responde por su autorización, pero la persona queda sin la marca.
      acepta_comunicaciones: false,
      _fila: i + 1,
    });
  });
  if (candidatos.length === 0) return { creados: 0, omitidos };
  // Los que ya existen (mismo correo) se omiten.
  const correos = candidatos.map((x) => x.email).filter(Boolean);
  const existentes = new Set<string>();
  for (let i = 0; i < correos.length; i += 200) {
    const { data, error } = await c.from("portal_contactos").select("email").eq("portal_id", portalId).in("email", correos.slice(i, i + 200));
    if (error) throw fallo(error);
    (data ?? []).forEach((f: Fila) => existentes.add(String(f.email).toLowerCase()));
  }
  const nuevos = candidatos.filter((x) => {
    if (x.email && existentes.has(x.email)) {
      omitidos.push({ fila: x._fila, motivo: "Ya estaba en el portal." });
      return false;
    }
    return true;
  });
  let creados = 0;
  for (let i = 0; i < nuevos.length; i += 200) {
    const lote = nuevos.slice(i, i + 200).map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== "_fila")));
    const { data, error } = await c.from("portal_contactos").insert(lote).select("id");
    if (error) throw fallo(error);
    creados += data?.length ?? 0;
    await Promise.all((data ?? []).map((f: Fila) => anotar(portalId, f.id, "sistema", "Importado desde una lista.", autor)));
  }
  return { creados, omitidos: omitidos.sort((a, b) => a.fila - b.fila) };
}

/** CSV de los contactos que cumplen el filtro (hasta 10.000), listo para abrir en una hoja de cálculo. */
export async function exportarContactos(portalId: string, f: FiltroContactos): Promise<string> {
  const consulta = aplicarFiltro(db().from("portal_contactos").select("*").eq("portal_id", portalId), f).order("creado_en", { ascending: false }).limit(10_000);
  const { data, error } = await consulta;
  if (error) throw fallo(error);
  const celda = (v: unknown) => {
    let s = String(v ?? "");
    // Una hoja de cálculo ejecuta como fórmula lo que empieza por = + - @: se neutraliza.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cab = ["Nombre", "Correo", "Teléfono", "Ciudad", "Departamento", "Etapa", "Origen", "Autoriza comunicaciones", "Fecha de autorización", "Intereses", "Etiquetas", "Último contacto", "Creado"];
  const filas = ((data ?? []) as Fila[]).map((x) =>
    [x.nombre, x.email, x.telefono, x.ciudad, x.departamento, nombreEtapa(x.etapa), ORIGENES.find((o) => o.id === x.origen)?.nombre ?? x.origen, x.acepta_comunicaciones ? "Sí" : "No", x.consentimiento_en ?? "", (x.intereses ?? []).join("; "), (x.etiquetas ?? []).join("; "), x.ultimo_contacto ?? "", x.creado_en].map(celda).join(",")
  );
  return `﻿${[cab.map(celda).join(","), ...filas].join("\r\n")}\r\n`;
}

// ---------------------------------------------------- altas desde el sitio ---

/**
 * Una persona se suma desde el sitio público. Si su correo ya estaba, se actualiza (no se duplica) y se anota en su historial;
 * la autorización queda registrada con su fecha. Nunca baja de etapa a quien ya participa.
 */
export async function suscribir(portalId: string, d: DatosSuscripcion): Promise<{ nuevo: boolean }> {
  const c = db();
  const email = d.email.toLowerCase();
  const { data: previo, error } = await c.from("portal_contactos").select("*").eq("portal_id", portalId).eq("email", email).maybeSingle();
  if (error) throw fallo(error);
  const ahora = new Date().toISOString();
  if (previo) {
    const intereses = [...new Set([...(previo.intereses ?? []), ...d.intereses])].slice(0, 12);
    const { error: e2 } = await c
      .from("portal_contactos")
      .update({
        telefono: previo.telefono || d.telefono,
        ciudad: previo.ciudad || d.ciudad,
        intereses,
        acepta_comunicaciones: true,
        consentimiento_en: previo.acepta_comunicaciones ? previo.consentimiento_en : ahora,
        actualizado_en: ahora,
      })
      .eq("id", previo.id);
    if (e2) throw fallo(e2);
    await anotar(portalId, previo.id, "sistema", "Volvió a llenar el formulario del portal.", "");
    return { nuevo: false };
  }
  const { data, error: e3 } = await c
    .from("portal_contactos")
    .insert({ portal_id: portalId, nombre: d.nombre, email, telefono: d.telefono, ciudad: d.ciudad, intereses: d.intereses, origen: d.desde, acepta_comunicaciones: true, consentimiento_en: ahora })
    .select("id")
    .single();
  if (e3) {
    // Dos envíos a la vez del mismo correo: el segundo choca con el índice único y se trata como repetido.
    if (e3.code === "23505") return { nuevo: false };
    throw fallo(e3);
  }
  await anotar(portalId, data.id, "sistema", d.desde === "articulo" ? "Se sumó desde un artículo del portal." : "Se sumó desde el formulario del portal.", "");
  return { nuevo: true };
}

// ---------------------------------------------------------------- eventos ---

const aEvento = (f: Fila, inscritos = 0, asistentes = 0): Evento => ({
  id: f.id,
  portalId: f.portal_id,
  slug: f.slug,
  titulo: f.titulo,
  descripcion: f.descripcion ?? "",
  categoria: f.categoria ?? "",
  iniciaEn: f.inicia_en,
  terminaEn: f.termina_en ?? null,
  modalidad: f.modalidad,
  lugar: f.lugar ?? "",
  ciudad: f.ciudad ?? "",
  enlaceVirtual: f.enlace_virtual ?? "",
  cupo: f.cupo ?? null,
  estado: f.estado,
  inscritos,
  asistentes,
  creadoEn: f.creado_en,
});

async function conteos(portalId: string, ids: string[]): Promise<Map<string, { inscritos: number; asistentes: number }>> {
  const m = new Map<string, { inscritos: number; asistentes: number }>();
  if (ids.length === 0) return m;
  const { data, error } = await db().from("portal_inscripciones").select("evento_id,estado").eq("portal_id", portalId).in("evento_id", ids);
  if (error) throw fallo(error);
  for (const f of (data ?? []) as Fila[]) {
    const x = m.get(f.evento_id) ?? { inscritos: 0, asistentes: 0 };
    if (f.estado !== "cancelado") x.inscritos += 1;
    if (f.estado === "asistio") x.asistentes += 1;
    m.set(f.evento_id, x);
  }
  return m;
}

async function conInscritos(portalId: string, filas: Fila[]): Promise<Evento[]> {
  const m = await conteos(portalId, filas.map((f) => f.id));
  return filas.map((f) => aEvento(f, m.get(f.id)?.inscritos ?? 0, m.get(f.id)?.asistentes ?? 0));
}

export async function listarEventos(portalId: string): Promise<Evento[]> {
  const { data, error } = await db().from("portal_eventos").select("*").eq("portal_id", portalId).order("inicia_en", { ascending: false }).limit(300);
  if (error) throw fallo(error);
  return conInscritos(portalId, (data ?? []) as Fila[]);
}

export async function obtenerEvento(portalId: string, id: string): Promise<Evento> {
  const { data, error } = await db().from("portal_eventos").select("*").eq("portal_id", portalId).eq("id", id).maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "No existe ese evento.");
  return (await conInscritos(portalId, [data]))[0];
}

function filaEvento(d: DatosEvento) {
  return {
    titulo: d.titulo,
    descripcion: d.descripcion,
    categoria: d.categoria,
    inicia_en: new Date(d.iniciaEn).toISOString(),
    termina_en: d.terminaEn ? new Date(d.terminaEn).toISOString() : null,
    modalidad: d.modalidad,
    lugar: d.lugar,
    ciudad: d.ciudad,
    enlace_virtual: d.enlaceVirtual,
    cupo: d.cupo,
    estado: d.estado,
  };
}

async function enlacesDeEventos(portalId: string, base: string, excluirId?: string): Promise<Set<string>> {
  const { data, error } = await db().from("portal_eventos").select("id,slug").eq("portal_id", portalId).like("slug", `${base.slice(0, 80)}%`);
  if (error) throw fallo(error);
  return new Set((data ?? []).filter((f: Fila) => f.id !== excluirId).map((f: Fila) => f.slug));
}

export async function crearEvento(portalId: string, d: DatosEvento): Promise<Evento> {
  const base = d.slug ?? slugDeTitulo(d.titulo);
  const slug = slugUnico(base || "evento", await enlacesDeEventos(portalId, base));
  const { data, error } = await db().from("portal_eventos").insert({ portal_id: portalId, slug, ...filaEvento(d) }).select("*").single();
  if (error) throw fallo(error);
  return aEvento(data);
}

export async function actualizarEvento(portalId: string, id: string, d: DatosEvento): Promise<Evento> {
  const actual = await obtenerEvento(portalId, id);
  const slug = d.slug && d.slug !== actual.slug ? slugUnico(d.slug, await enlacesDeEventos(portalId, d.slug, id)) : actual.slug;
  const { data, error } = await db().from("portal_eventos").update({ slug, ...filaEvento(d), actualizado_en: new Date().toISOString() }).eq("portal_id", portalId).eq("id", id).select("*").single();
  if (error) throw fallo(error);
  return (await conInscritos(portalId, [data]))[0];
}

export async function eliminarEvento(portalId: string, id: string) {
  const { error } = await db().from("portal_eventos").delete().eq("portal_id", portalId).eq("id", id);
  if (error) throw fallo(error);
}

export async function inscripcionesDe(portalId: string, eventoId: string): Promise<Inscripcion[]> {
  const { data, error } = await db()
    .from("portal_inscripciones")
    .select("estado,creado_en,contacto:portal_contactos(id,nombre,email,telefono)")
    .eq("portal_id", portalId)
    .eq("evento_id", eventoId)
    .order("creado_en", { ascending: true })
    .limit(2000);
  if (error) throw fallo(error);
  return ((data ?? []) as Fila[]).filter((f) => f.contacto).map((f) => ({ contactoId: f.contacto.id, nombre: f.contacto.nombre, email: f.contacto.email ?? null, telefono: f.contacto.telefono ?? "", estado: f.estado, creadoEn: f.creado_en }));
}

/** El equipo marca asistió / no asistió / cancelado. Quien asiste y estaba en «nuevo» o «interesado» pasa a «activo». */
export async function marcarInscripcion(portalId: string, eventoId: string, contactoId: string, estado: EstadoInscripcion, autor: string) {
  const c = db();
  const { data, error } = await c.from("portal_inscripciones").update({ estado }).eq("portal_id", portalId).eq("evento_id", eventoId).eq("contacto_id", contactoId).select("contacto_id").maybeSingle();
  if (error) throw fallo(error);
  if (!data) throw new ErrorPortales("no_encontrado", "Esa persona no está inscrita en el evento.");
  if (estado === "asistio") {
    const { data: ev } = await c.from("portal_eventos").select("titulo").eq("id", eventoId).maybeSingle();
    await anotar(portalId, contactoId, "evento", `Asistió a «${ev?.titulo ?? "un evento"}».`, autor);
    await c.from("portal_contactos").update({ etapa: "activo", actualizado_en: new Date().toISOString() }).eq("portal_id", portalId).eq("id", contactoId).in("etapa", ["nuevo", "interesado"]);
  }
}

export async function eventosPublicados(portalId: string, o: { limite?: number; proximos?: boolean } = {}): Promise<Evento[]> {
  let q = db().from("portal_eventos").select("*").eq("portal_id", portalId).in("estado", ["publicado", "cancelado"]);
  if (o.proximos) q = q.gte("inicia_en", new Date(Date.now() - 3 * 3_600_000).toISOString());
  const { data, error } = await q.order("inicia_en", { ascending: !!o.proximos }).limit(o.limite ?? 50);
  if (error) throw fallo(error);
  return conInscritos(portalId, (data ?? []) as Fila[]);
}

export async function eventoPublicado(portalId: string, slug: string): Promise<Evento | null> {
  const { data, error } = await db().from("portal_eventos").select("*").eq("portal_id", portalId).eq("slug", slug).in("estado", ["publicado", "cancelado"]).maybeSingle();
  if (error) throw fallo(error);
  return data ? (await conInscritos(portalId, [data]))[0] : null;
}

/** Inscribe a una persona (creando o reutilizando su contacto). Respeta el cupo y los eventos cancelados o ya pasados. */
export async function inscribirAEvento(portalId: string, evento: Evento, d: DatosInscripcion): Promise<{ yaInscrito: boolean }> {
  if (evento.estado !== "publicado") throw new ErrorPortales("invalido", "Este evento fue cancelado.");
  const fin = Date.parse(evento.terminaEn ?? evento.iniciaEn);
  if (fin + 3 * 3_600_000 < Date.now()) throw new ErrorPortales("invalido", "Este evento ya terminó.");
  const c = db();
  const email = d.email.toLowerCase();
  const { data: previo, error } = await c.from("portal_contactos").select("*").eq("portal_id", portalId).eq("email", email).maybeSingle();
  if (error) throw fallo(error);
  const ahora = new Date().toISOString();
  let contactoId = "";
  if (previo) {
    contactoId = previo.id;
    const { error: e2 } = await c
      .from("portal_contactos")
      .update({ telefono: previo.telefono || d.telefono, ciudad: previo.ciudad || d.ciudad, acepta_comunicaciones: true, consentimiento_en: previo.acepta_comunicaciones ? previo.consentimiento_en : ahora, actualizado_en: ahora })
      .eq("id", contactoId);
    if (e2) throw fallo(e2);
  }
  // El cupo se revisa antes de crear nada (la persona que ya estaba inscrita no ocupa un cupo nuevo).
  if (previo) {
    const { data: ya } = await c.from("portal_inscripciones").select("estado").eq("evento_id", evento.id).eq("contacto_id", previo.id).maybeSingle();
    if (ya && ya.estado !== "cancelado") return { yaInscrito: true };
  }
  if (evento.cupo !== null && evento.inscritos >= evento.cupo) throw new ErrorPortales("invalido", "El evento ya no tiene cupos disponibles.");
  if (!previo) {
    const { data: nuevo, error: e3 } = await c
      .from("portal_contactos")
      .insert({ portal_id: portalId, nombre: d.nombre, email, telefono: d.telefono, ciudad: d.ciudad, origen: "evento", etapa: "interesado", acepta_comunicaciones: true, consentimiento_en: ahora })
      .select("id")
      .single();
    if (e3) throw fallo(e3);
    contactoId = nuevo.id;
  } else {
    await c.from("portal_contactos").update({ etapa: "interesado" }).eq("id", contactoId).eq("etapa", "nuevo");
  }
  const { error: e4 } = await c.from("portal_inscripciones").upsert({ evento_id: evento.id, contacto_id: contactoId, portal_id: portalId, estado: "inscrito" }, { onConflict: "evento_id,contacto_id" });
  if (e4) throw fallo(e4);
  await anotar(portalId, contactoId, "evento", `Se inscribió a «${evento.titulo}».`, "");
  return { yaInscrito: false };
}
