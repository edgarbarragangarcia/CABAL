import "server-only";

import type { CrmContact, CrmField, CrmSnapshot, Dimension } from "./types";

/**
 * Lectura de contactos de Bitrix24 por webhook entrante
 * (`https://<portal>/rest/<usuario>/<clave>/`). Solo lee — crm.contact.*,
 * crm.status.list, user.get — y nunca escribe en el CRM.
 *
 * Deja cada contacto como índices a los valores de los campos que sirven
 * para relacionar personas (lugar, intereses, actividades, referidos). Los
 * datos de contacto (correos, teléfonos, direcciones, documentos) no salen
 * del servidor.
 */

const PAGE = 50; // Bitrix24 devuelve 50 registros por página
const MAX_CONTACTS = 5000;
const MAX_MISSING_REFERRERS = 500;
const CACHE_TTL_MS = 10 * 60 * 1000;

export class BitrixError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type BitrixReply<T> = { result: T; total?: number; error?: string; error_description?: string };

const KNOWN_ERRORS: Record<string, string> = {
  insufficient_scope:
    "El webhook no tiene permiso para leer el CRM. Edítalo en Bitrix24 y marca el permiso «CRM (crm)».",
  NO_AUTH_FOUND: "Bitrix24 no reconoce el webhook: puede que lo hayan borrado o que la URL esté incompleta.",
  INVALID_CREDENTIALS: "Bitrix24 no reconoce el webhook: puede que lo hayan borrado o que la URL esté incompleta.",
  invalid_token: "Bitrix24 no reconoce el webhook: puede que lo hayan borrado o que la URL esté incompleta.",
  ACCESS_DENIED: "El usuario dueño del webhook no tiene acceso a los contactos del CRM.",
  ERROR_METHOD_NOT_FOUND: "La URL no apunta a la API de Bitrix24. Copia de nuevo la URL del webhook entrante.",
};

function toBitrixError(status: number, reply: { error?: string; error_description?: string } | null) {
  const code = reply?.error ?? `HTTP_${status}`;
  return new BitrixError(
    code,
    KNOWN_ERRORS[code] ?? `Bitrix24 respondió con un error: ${reply?.error_description || code}.`
  );
}

/** Acepta la URL tal como la muestra Bitrix24, aunque traiga un método de ejemplo al final. */
export function normalizeWebhookUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BitrixError("INVALID_URL", "BITRIX24_WEBHOOK_URL no es una URL válida.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new BitrixError("INVALID_URL", "La URL del webhook de Bitrix24 debe empezar por https://.");
  }
  const path = url.pathname.replace(/\/[\w.]+\.(json|xml)$/i, "/").replace(/\/?$/, "/");
  if (!/\/rest\/\d+\/[^/]+\/$/.test(path)) {
    throw new BitrixError(
      "INVALID_URL",
      "La URL no parece un webhook entrante de Bitrix24: debe verse como https://tuempresa.bitrix24.co/rest/1/abc123/."
    );
  }
  return `${url.origin}${path}`;
}

async function call<T>(base: string, method: string, params: object = {}, attempt = 0): Promise<BitrixReply<T>> {
  let res: Response;
  try {
    res = await fetch(`${base}${method}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new BitrixError("NETWORK", "No fue posible conectar con Bitrix24. Revisa la URL del webhook.");
  }
  const reply = (await res.json().catch(() => null)) as BitrixReply<T> | null;
  if (reply?.error === "QUERY_LIMIT_EXCEEDED" && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    return call(base, method, params, attempt + 1);
  }
  if (!res.ok || !reply || reply.error) throw toBitrixError(res.status, reply);
  return reply;
}

/** Parámetros como query string al estilo PHP (`select[0]=ID&order[ID]=DESC`), que es lo que espera `batch`. */
function toQuery(value: unknown, prefix: string): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => toQuery(v, `${prefix}[${i}]`));
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => toQuery(v, prefix ? `${prefix}[${k}]` : k));
  }
  return [`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`];
}

type BatchReply<T> = {
  result: Record<string, T> | T[];
  result_error: Record<string, { error?: string; error_description?: string }> | unknown[];
};

/** Hasta 50 llamadas en una sola petición. */
async function batch<T>(base: string, cmd: Record<string, [string, object]>, tolerateErrors = false) {
  const payload = Object.fromEntries(
    Object.entries(cmd).map(([key, [method, params]]) => [key, `${method}?${toQuery(params, "").join("&")}`])
  );
  const { result } = await call<BatchReply<T>>(base, "batch", { halt: 0, cmd: payload });
  const errors = Array.isArray(result.result_error) ? [] : Object.values(result.result_error);
  if (errors.length && !tolerateErrors) throw toBitrixError(200, errors[0]);
  return Array.isArray(result.result) ? {} : result.result;
}

async function listAll<T>(base: string, method: string, params: object, cap: number) {
  const first = await call<T[]>(base, method, { ...params, start: 0 });
  const items = [...first.result];
  const total = first.total ?? items.length;
  const starts: number[] = [];
  for (let s = PAGE; s < Math.min(total, cap); s += PAGE) starts.push(s);
  for (let i = 0; i < starts.length; i += 50) {
    const chunk = starts.slice(i, i + 50);
    const pages = await batch<T[]>(
      base,
      Object.fromEntries(chunk.map((start) => [`p${start}`, [method, { ...params, start }]]))
    );
    for (const start of chunk) items.push(...(pages[`p${start}`] ?? []));
  }
  return { items: items.slice(0, cap), total };
}

// ── Qué campos sirven y para qué relación ─────────────────────────────────

type Kind = "string" | "enum" | "status" | "contact" | "employee" | "boolean";

type FieldSpec = {
  key: string;
  label: string;
  auto: Dimension | null;
  kind: Kind;
  items?: Map<string, string>;
  statusType?: string;
};

type FieldMeta = {
  type: string;
  title?: unknown;
  listLabel?: unknown;
  formLabel?: unknown;
  filterLabel?: unknown;
  statusType?: string;
  items?: { ID: string | number; VALUE: string }[];
  settings?: Record<string, unknown>;
};

/** Campos estándar del contacto que sirven para relacionar. */
const STANDARD_FIELDS: [string, string, Dimension | null, Kind, string?][] = [
  ["ADDRESS_CITY", "Ciudad", "lugar", "string"],
  ["ADDRESS_PROVINCE", "Departamento", "lugar", "string"],
  ["ADDRESS_REGION", "Región", "lugar", "string"],
  ["ADDRESS_COUNTRY", "País", "lugar", "string"],
  ["TYPE_ID", "Tipo de contacto", "intereses", "status", "CONTACT_TYPE"],
  ["SOURCE_ID", "Origen", "actividades", "status", "SOURCE"],
  ["UTM_CAMPAIGN", "Campaña (UTM)", "actividades", "string"],
  ["UTM_SOURCE", "Fuente (UTM)", null, "string"],
  ["POST", "Cargo", null, "string"],
  ["ASSIGNED_BY_ID", "Responsable en Bitrix24", null, "employee"],
];

// Se evalúan sin tildes y en minúsculas, en este orden: "Líder de zona" es un referido.
const DIMENSION_PATTERNS: [Dimension, RegExp][] = [
  ["referidos", /(referid|referente|refirio|recomendad|recomendo|invitad|invito|trajo|lider|padrino|madrina|contacto de|presentad|captad|coordinador)/],
  ["lugar", /\b(departamento|depto|municipio|ciudad|barrio|localidad|comuna|vereda|corregimiento|provincia|region|zona|pais|puesto de votacion|lugar de votacion|mesa de votacion|residencia|ubicacion)\b/],
  ["actividades", /(evento|curso|capacitacion|taller|foro|campana|actividad|asistencia|asistio|participa|programa|webinar|seminario|diplomado|reunion|convocatoria|voluntari|brigada|jornada|encuentro|congreso|cohorte|clase|inscripcion|inscrito)/],
  ["intereses", /(interes|tema|preferencia|afinidad|causa|etiqueta|\btags?\b|segmento|categoria|perfil|profesion|ocupacion|area de)/],
];

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function detectDimension(label: string): Dimension | null {
  const text = plain(label);
  return DIMENSION_PATTERNS.find(([, re]) => re.test(text))?.[0] ?? null;
}

/** Las etiquetas de campos personalizados pueden venir como texto o por idioma. */
function labelText(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const byLang = x as Record<string, unknown>;
    return String(byLang.es ?? byLang.en ?? Object.values(byLang)[0] ?? "");
  }
  return "";
}

function detectFields(meta: Record<string, FieldMeta>): FieldSpec[] {
  const specs: FieldSpec[] = STANDARD_FIELDS.filter(([key]) => key in meta).map(
    ([key, label, auto, kind, statusType]) => ({
      key,
      label,
      auto,
      kind,
      statusType: meta[key].statusType ?? statusType,
    })
  );

  for (const [key, m] of Object.entries(meta)) {
    if (!key.startsWith("UF_")) continue;
    const label =
      [m.formLabel, m.listLabel, m.filterLabel, m.title].map(labelText).find((l) => l.trim())?.trim() ?? key;
    const auto = detectDimension(label);
    let kind: Kind | null = null;
    if (m.type === "string") kind = "string";
    else if (m.type === "enumeration") kind = "enum";
    else if (m.type === "employee") kind = "employee";
    else if (m.type === "crm" && m.settings?.CONTACT === "Y") kind = "contact";
    else if (m.type === "crm_status" && typeof m.settings?.ENTITY_TYPE === "string") kind = "status";
    // Casillas tipo "¿Asistió al foro?": solo sirven si el nombre dice qué son.
    else if (m.type === "boolean" && auto) kind = "boolean";
    if (!kind) continue;

    specs.push({
      key,
      label,
      auto,
      kind,
      items: m.items ? new Map(m.items.map((it) => [String(it.ID), it.VALUE])) : undefined,
      statusType: kind === "status" ? String(m.settings?.ENTITY_TYPE) : undefined,
    });
  }
  return specs;
}

// ── Contactos ─────────────────────────────────────────────────────────────

type RawContact = Record<string, unknown> & { ID: string | number };

const contactName = (c: RawContact) =>
  [c.NAME, c.SECOND_NAME, c.LAST_NAME]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(" ") || `Contacto #${c.ID}`;

const asList = (x: unknown): unknown[] => (Array.isArray(x) ? x : x === null || x === undefined || x === "" ? [] : [x]);

async function fetchStatuses(base: string, types: string[]) {
  const out = new Map<string, Map<string, string>>();
  if (!types.length) return out;
  const lists = await batch<{ STATUS_ID: string; NAME: string }[]>(
    base,
    Object.fromEntries(types.map((t, i) => [`s${i}`, ["crm.status.list", { filter: { ENTITY_ID: t } }]])),
    true
  );
  types.forEach((t, i) => out.set(t, new Map((lists[`s${i}`] ?? []).map((s) => [s.STATUS_ID, s.NAME]))));
  return out;
}

/** Nombres de usuarios de Bitrix24; si el webhook no tiene permiso de usuarios, se muestran por número. */
async function fetchUserNames(base: string, ids: string[]) {
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const users = await batch<{ NAME?: string; LAST_NAME?: string }[]>(
        base,
        Object.fromEntries(chunk.map((id) => [`u${id}`, ["user.get", { ID: id }]])),
        true
      );
      for (const id of chunk) {
        const u = users[`u${id}`]?.[0];
        const name = [u?.NAME, u?.LAST_NAME].filter(Boolean).join(" ").trim();
        if (name) names.set(id, name);
      }
    } catch {
      break;
    }
  }
  return names;
}

async function fetchSnapshot(base: string): Promise<CrmSnapshot> {
  const { result: meta } = await call<Record<string, FieldMeta>>(base, "crm.contact.fields");
  const specs = detectFields(meta);
  const select = ["ID", "NAME", "SECOND_NAME", "LAST_NAME", ...specs.map((s) => s.key)];

  const [statuses, { items: raw, total }] = await Promise.all([
    fetchStatuses(base, [...new Set(specs.flatMap((s) => (s.statusType ? [s.statusType] : [])))]),
    listAll<RawContact>(base, "crm.contact.list", { order: { ID: "DESC" }, select }, MAX_CONTACTS),
  ]);

  // Referentes enlazados que quedaron fuera del tope de contactos: se traen también.
  const contactId = (x: unknown) => /^(?:C_)?(\d+)$/.exec(String(x))?.[1] ?? null;
  const known = new Set(raw.map((c) => String(c.ID)));
  const missing = [
    ...new Set(
      raw.flatMap((c) =>
        specs.filter((s) => s.kind === "contact").flatMap((s) => asList(c[s.key]).map(contactId))
      )
    ),
  ].filter((id): id is string => id !== null && !known.has(id));
  if (missing.length) {
    const chunks: string[][] = [];
    for (let i = 0; i < Math.min(missing.length, MAX_MISSING_REFERRERS); i += 50) chunks.push(missing.slice(i, i + 50));
    const pages = await batch<RawContact[]>(
      base,
      Object.fromEntries(chunks.map((ids, i) => [`m${i}`, ["crm.contact.list", { filter: { "@ID": ids }, select }]]))
    );
    chunks.forEach((_, i) => raw.push(...(pages[`m${i}`] ?? [])));
  }

  const employeeIds = [
    ...new Set(
      raw.flatMap((c) =>
        specs.filter((s) => s.kind === "employee").flatMap((s) => asList(c[s.key]).map(String))
      )
    ),
  ].filter((id) => id !== "0");
  const users = await fetchUserNames(base, employeeIds);
  const names = new Map(raw.map((c) => [String(c.ID), contactName(c)]));

  // Diccionario de valores por campo; cada contacto guarda índices.
  const dicts = specs.map(() => ({
    index: new Map<string, number>(),
    values: [] as string[],
    refs: [] as (string | null)[],
    counts: [] as number[],
    filled: 0,
  }));
  const perContact = raw.map((c) => {
    const v: [number, number[]][] = [];
    specs.forEach((spec, fi) => {
      const dict = dicts[fi];
      const idxs = new Set<number>();
      for (const x of asList(c[spec.key])) {
        let key: string | null = null;
        let label = "";
        let ref: string | null = null;
        const s = String(x).trim();
        if (spec.kind === "string") [key, label] = s ? [plain(s), s] : [null, ""];
        else if (spec.kind === "enum") [key, label] = spec.items?.has(s) ? [s, spec.items.get(s)!] : [null, ""];
        else if (spec.kind === "status") [key, label] = s ? [s, statuses.get(spec.statusType!)?.get(s) ?? s] : [null, ""];
        else if (spec.kind === "employee") [key, label] = s && s !== "0" ? [s, users.get(s) ?? `Usuario #${s}`] : [null, ""];
        else if (spec.kind === "boolean") [key, label] = x === true || s === "1" || s === "Y" ? ["1", spec.label] : [null, ""];
        else if (spec.kind === "contact") {
          ref = contactId(s);
          [key, label] = ref ? [ref, names.get(ref) ?? `Contacto #${ref}`] : [null, ""];
        }
        if (key === null || !label) continue;
        let vi = dict.index.get(key);
        if (vi === undefined) {
          vi = dict.values.length;
          dict.index.set(key, vi);
          dict.values.push(label);
          dict.refs.push(ref);
          dict.counts.push(0);
        }
        if (!idxs.has(vi)) {
          idxs.add(vi);
          dict.counts[vi]++;
        }
      }
      if (idxs.size) {
        dict.filled++;
        v.push([fi, [...idxs]]);
      }
    });
    return v;
  });

  // Se descartan campos que no relacionan a nadie: vacíos, o texto donde casi
  // cada valor es único (nombres, documentos, direcciones).
  const keepField = specs.map((spec, fi) => {
    const d = dicts[fi];
    if (!d.filled) return false;
    if (spec.auto === "referidos" || spec.kind === "contact" || spec.kind === "employee") return true;
    const shared = Math.max(0, ...d.counts) >= 2;
    return spec.kind === "string" ? shared && d.values.length / d.filled <= 0.9 : shared;
  });
  const newIndex = new Map<number, number>();
  const fields: CrmField[] = [];
  specs.forEach((spec, fi) => {
    if (!keepField[fi]) return;
    newIndex.set(fi, fields.length);
    const d = dicts[fi];
    fields.push({
      key: spec.key,
      label: spec.label,
      type: spec.kind,
      auto: spec.auto,
      values: d.values,
      ...(spec.kind === "contact" ? { contactRefs: d.refs } : {}),
      filled: d.filled,
    });
  });

  const contacts: CrmContact[] = raw.map((c, i) => ({
    id: String(c.ID),
    name: names.get(String(c.ID))!,
    v: perContact[i].filter(([fi]) => newIndex.has(fi)).map(([fi, idxs]) => [newIndex.get(fi)!, idxs]),
  }));

  return { portal: new URL(base).host, fetchedAt: new Date().toISOString(), total, fields, contacts };
}

const cache = new Map<string, { at: number; snapshot: CrmSnapshot }>();

/** Contactos del CRM; se guardan 10 minutos en memoria para no consultar Bitrix24 en cada visita. */
export async function getCrmSnapshot(webhookUrl: string, { refresh = false } = {}): Promise<CrmSnapshot> {
  const base = normalizeWebhookUrl(webhookUrl);
  const cached = cache.get(base);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.snapshot;
  const snapshot = await fetchSnapshot(base);
  cache.set(base, { at: Date.now(), snapshot });
  return snapshot;
}
