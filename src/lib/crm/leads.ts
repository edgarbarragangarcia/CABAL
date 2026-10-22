import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";

import { call, normalizeWebhookUrl, toQuery } from "./bitrix24";
import { candidatos, departamentoDe } from "./geo";

/**
 * Copia de los leads de Bitrix24 a Supabase (tabla crm_leads, ver supabase/crm.sql), sin teléfonos ni correos. Se recorre por rangos de ID
 * (40 números por consulta, 50 consultas por llamada) en vez de por páginas: es mucho más rápido y se puede retomar desde cualquier ID.
 */
const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
type FieldMeta = { type: string; items?: { ID: string | number; VALUE: string }[]; formLabel?: unknown; listLabel?: unknown; title?: unknown };
const texto = (x: unknown): string => (typeof x === "string" ? x : x && typeof x === "object" ? String(Object.values(x as Record<string, unknown>)[0] ?? "") : "");
const etiqueta = (m: FieldMeta) => plano([m.formLabel, m.listLabel, m.title].map(texto).find((t) => t.trim()) ?? "");

type Mapa = { llave: string; items?: Map<string, string> };
const COLUMNAS: [string, RegExp][] = [
  ["ciudad", /^ciudad municipio$|^ciudad$|^municipio$/], ["departamento", /^departamentos?$/], ["localidad", /^localidad$/], ["barrio", /^barrio$/], ["pais", /^pais$/],
  ["gremio", /^gremio$/], ["corporacion", /^corporacion$/], ["profesion", /^profesion$/], ["origen_base", /^origen de la base$/], ["base", /^base$/], ["anio_campana", /^ano campana$/],
  ["tiene_hijos", /^tiene hijos$/], ["testigo_electoral", /^testigo electoral$/], ["electo", /^electo$/], ["voto", /^voto$/], ["microinfluenciador", /^microinfluenciador$/], ["grupo_whatsapp", /^grupo whatsapp$/],
];
const BOOLEANAS = new Set(["tiene_hijos", "testigo_electoral", "electo", "voto", "microinfluenciador", "grupo_whatsapp"]);

type CampoUF = { llave: string; etiqueta: string; items?: Map<string, string> };
let cache: { at: number; base: string; mapa: Record<string, Mapa>; uf: CampoUF[]; estados: Map<string, string> } | null = null;

async function esquema(base: string) {
  if (cache && cache.base === base && Date.now() - cache.at < 10 * 60_000) return cache;
  const { result } = await call<Record<string, FieldMeta>>(base, "crm.lead.fields");
  const mapa: Record<string, Mapa> = {};
  for (const [columna, re] of COLUMNAS) {
    const hallado = Object.entries(result).find(([k, m]) => k.startsWith("UF_") && re.test(etiqueta(m)));
    if (hallado) mapa[columna] = { llave: hallado[0], items: hallado[1].items ? new Map(hallado[1].items.map((i) => [String(i.ID), String(i.VALUE)])) : undefined };
  }
  const st = await call<{ STATUS_ID: string; NAME: string }[]>(base, "crm.status.list", { filter: { ENTITY_ID: "STATUS" } }).catch(() => null);
  // Todos los campos personalizados (UF_…), con su nombre y sus opciones: se guardan completos en `personalizados`.
  const uf: CampoUF[] = Object.entries(result)
    .filter(([k]) => k.startsWith("UF_"))
    .map(([k, m]) => ({ llave: k, etiqueta: [m.formLabel, m.listLabel, m.title].map(texto).find((t) => t.trim())?.trim() || k, items: m.items ? new Map(m.items.map((i) => [String(i.ID), String(i.VALUE)])) : undefined }));
  cache = { at: Date.now(), base, mapa, uf, estados: new Map((st?.result ?? []).map((s) => [s.STATUS_ID, s.NAME])) };
  return cache;
}

const ANCHO = 40; // IDs por consulta: nunca pasa de 40 leads, así que ninguna consulta se queda corta (Bitrix24 devuelve 50 como máximo)
const POR_LLAMADA = 50;

type Crudo = Record<string, unknown>;

function aFila(c: Crudo, e: Awaited<ReturnType<typeof esquema>>) {
  const fila: Record<string, unknown> = {
    id: Number(c.ID),
    nombre: [c.NAME, c.LAST_NAME].map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).join(" ") || (typeof c.TITLE === "string" ? c.TITLE.trim() : "") || `Lead #${c.ID}`,
    estado: e.estados.get(String(c.STATUS_ID ?? "")) ?? (c.STATUS_ID ? String(c.STATUS_ID) : null),
    creado_en: typeof c.DATE_CREATE === "string" ? c.DATE_CREATE : null,
    responsable_id: Number(c.ASSIGNED_BY_ID) || null,
    actualizado_en: new Date().toISOString(),
  };
  const cad = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
  const fecha = (x: unknown) => { const t = cad(x); return t && !Number.isNaN(Date.parse(t)) ? t : null; };
  const lista = (x: unknown): { VALUE?: string; VALUE_TYPE?: string }[] => (Array.isArray(x) ? (x as { VALUE?: string; VALUE_TYPE?: string }[]) : []);
  const monto = Number(c.OPPORTUNITY);
  const nac = cad(c.BIRTHDATE)?.slice(0, 10);
  Object.assign(fila, {
    nombre_pila: cad(c.NAME), apellido: cad(c.LAST_NAME), segundo_nombre: cad(c.SECOND_NAME),
    fecha_nacimiento: nac && /^\d{4}-\d{2}-\d{2}$/.test(nac) && nac > "1900-01-01" ? nac : null,
    cargo: cad(c.POST), empresa: cad(c.COMPANY_TITLE), empresa_id: Number(c.COMPANY_ID) || null, contacto_id: Number(c.CONTACT_ID) || null,
    telefonos: lista(c.PHONE).map((t) => cad(t.VALUE)).filter((t): t is string => !!t),
    mensajeria: lista(c.IM).map((t) => ({ tipo: t.VALUE_TYPE ?? null, valor: cad(t.VALUE) })).filter((t) => t.valor),
    tiene_telefono: c.HAS_PHONE === undefined ? null : c.HAS_PHONE === "Y", tiene_correo: c.HAS_EMAIL === undefined ? null : c.HAS_EMAIL === "Y",
    comentarios: cad(c.COMMENTS), estado_descripcion: cad(c.STATUS_DESCRIPTION), fuente_id: cad(c.SOURCE_ID), fuente_descripcion: cad(c.SOURCE_DESCRIPTION),
    estado_semantico: cad(c.STATUS_SEMANTIC_ID), fecha_cierre: fecha(c.DATE_CLOSED), ultima_actividad: fecha(c.LAST_ACTIVITY_TIME), monto: Number.isFinite(monto) && monto !== 0 ? monto : null,
    direccion: cad(c.ADDRESS), direccion_ciudad: cad(c.ADDRESS_CITY), direccion_region: cad(c.ADDRESS_REGION), direccion_provincia: cad(c.ADDRESS_PROVINCE), direccion_pais: cad(c.ADDRESS_COUNTRY), direccion_postal: cad(c.ADDRESS_POSTAL_CODE),
    utm_source: cad(c.UTM_SOURCE), utm_medium: cad(c.UTM_MEDIUM), utm_campaign: cad(c.UTM_CAMPAIGN), utm_content: cad(c.UTM_CONTENT), utm_term: cad(c.UTM_TERM),
  });
  const personalizados: Record<string, unknown> = {};
  for (const u of e.uf) {
    const v = c[u.llave];
    if (v === null || v === undefined || v === "" || v === "0" || (Array.isArray(v) && v.length === 0)) continue;
    const valores = (Array.isArray(v) ? v : [v]).map((x) => (u.items ? u.items.get(String(x)) ?? String(x) : x)).filter((x) => x !== "" && x !== null && x !== undefined);
    if (valores.length) personalizados[personalizados[u.etiqueta] === undefined ? u.etiqueta : `${u.etiqueta} (${u.llave})`] = valores.length === 1 ? valores[0] : valores;
  }
  fila.personalizados = Object.keys(personalizados).length ? personalizados : null;
  for (const [columna, m] of Object.entries(e.mapa)) {
    const v = c[m.llave];
    if (BOOLEANAS.has(columna)) fila[columna] = v === null || v === undefined || v === "" ? null : v === true || v === "1" || v === 1 || v === "Y";
    else {
      const valores = (Array.isArray(v) ? v : v === null || v === undefined || v === "" || v === "0" ? [] : [v]).map((x) => (m.items ? m.items.get(String(x)) : String(x))).filter((x): x is string => !!x);
      fila[columna] = valores.length ? valores.join(", ") : null;
    }
  }
  // Municipio DANE: por el nombre de la ciudad; si el nombre se repite, el departamento del lead decide (y si no, el más poblado).
  if (typeof fila.ciudad === "string") {
    const cand = candidatos(fila.ciudad);
    const dep = typeof fila.departamento === "string" ? departamentoDe(fila.departamento)?.codigo : undefined;
    const m = cand.length > 1 ? (dep ? cand.find((x) => x.dep === dep) : undefined) ?? [...cand].sort((a, b) => b.pob - a.pob)[0] : cand[0];
    fila.dane = m?.dane ?? null;
  } else fila.dane = null;
  return fila;
}

export async function ultimoId(webhook: string): Promise<number> {
  const base = normalizeWebhookUrl(webhook);
  const r = await call<{ ID: string }[]>(base, "crm.lead.list", { select: ["ID"], order: { ID: "DESC" }, start: -1 });
  return Number(r.result[0]?.ID ?? 0);
}

/** Guarda los leads con ID desde `desde` hasta donde alcance el tiempo (`presupuestoMs`). Devuelve el ID por donde seguir. */
export async function guardarLeads(webhook: string, desde: number, presupuestoMs = 40_000) {
  const base = normalizeWebhookUrl(webhook);
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase no está conectado.");
  const [e, maxId] = await Promise.all([esquema(base), ultimoId(webhook)]);
  if (!e.mapa.ciudad || !e.mapa.departamento) throw new Error("No encontré en Bitrix24 los campos «Ciudad / Municipio» y «Departamentos» de los leads.");
  const select = [...new Set(["ID", "NAME", "SECOND_NAME", "LAST_NAME", "TITLE", "STATUS_ID", "DATE_CREATE", "ASSIGNED_BY_ID", "BIRTHDATE", "POST", "COMPANY_TITLE", "COMPANY_ID", "CONTACT_ID", "PHONE", "IM", "HAS_PHONE", "HAS_EMAIL", "COMMENTS", "STATUS_DESCRIPTION", "SOURCE_ID", "SOURCE_DESCRIPTION", "STATUS_SEMANTIC_ID", "DATE_CLOSED", "LAST_ACTIVITY_TIME", "OPPORTUNITY", "ADDRESS", "ADDRESS_CITY", "ADDRESS_REGION", "ADDRESS_PROVINCE", "ADDRESS_COUNTRY", "ADDRESS_POSTAL_CODE", "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN", "UTM_CONTENT", "UTM_TERM", ...Object.values(e.mapa).map((m) => m.llave), ...e.uf.map((u) => u.llave)])];
  const t0 = Date.now();
  let siguiente = desde;
  let guardados = 0;
  while (siguiente <= maxId && Date.now() - t0 < presupuestoMs) {
    const cmd: Record<string, string> = {};
    for (let i = 0; i < POR_LLAMADA; i++) {
      const a = siguiente + i * ANCHO;
      cmd[`w${i}`] = `crm.lead.list?${toQuery({ order: { ID: "ASC" }, select, filter: { ">=ID": a, "<ID": a + ANCHO }, start: -1 }, "").join("&")}`;
    }
    const r = await call<{ result: Record<string, Crudo[]> }>(base, "batch", { halt: 0, cmd });
    const crudos = Object.values(r.result.result ?? {}).flat();
    const filas = crudos.map((c) => aFila(c, e));
    for (let i = 0; i < filas.length; i += 1000) {
      const { error } = await supabase.from("crm_leads").upsert(filas.slice(i, i + 1000), { onConflict: "id" });
      if (error) throw new Error(error.message.includes("crm_leads") || /column/i.test(error.message) ? "Faltan columnas en crm_leads: corre supabase/crm.sql completo en el SQL Editor de Supabase (agrega los campos nuevos)." : error.message);
    }
    guardados += filas.length;
    siguiente += POR_LLAMADA * ANCHO;
  }
  return { siguiente, maxId, guardados, terminado: siguiente > maxId };
}

export async function estadoLeads() {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase no está conectado.");
  const { count, error } = await supabase.from("crm_leads").select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message.includes("crm_leads") ? "Falta crear la tabla: corre supabase/crm.sql en el SQL Editor de Supabase." : error.message);
  return { guardados: count ?? 0 };
}

export type PersonaLead = { id: number; nombre: string; estado: string | null; barrio: string | null; localidad: string | null; profesion: string | null; gremio: string | null; creado_en: string | null };

/** Las personas (leads guardados) de un municipio, de la más reciente a la más antigua. */
export async function leadsDeMunicipio(dane: string, pagina: number) {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase no está conectado.");
  const POR_PAGINA = 50;
  const { data, count, error } = await supabase.from("crm_leads").select("id, nombre, estado, barrio, localidad, profesion, gremio, creado_en", { count: "exact" }).eq("dane", dane).order("id", { ascending: false }).range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (error) throw new Error(error.message.includes("crm_leads") ? "Falta crear la tabla: corre supabase/crm.sql en el SQL Editor de Supabase." : error.message);
  return { total: count ?? 0, pagina, porPagina: POR_PAGINA, personas: (data ?? []) as PersonaLead[] };
}
