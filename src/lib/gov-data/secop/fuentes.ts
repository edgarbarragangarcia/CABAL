import "server-only";

import { querySocrataDataset, type SoqlParams } from "../socrata";
import { VALOR_MAXIMO } from "./datasets";
import { documentoSegunTipo, nitDeEntidad, parseDocumento } from "./documento";
import type { ClaseEstado, ContratoSecop, EstadoFuente, PersonaRef } from "./tipos";

/** Consulta de cada conjunto de datos y paso de sus filas, cada una con sus propias columnas, a un contrato común. */

export type Fila = Record<string, unknown>;

export const TIMEOUT_MS = 25_000;

export const SELECT_II = [
  "id_contrato", "referencia_del_contrato", "estado_contrato", "tipo_de_contrato", "modalidad_de_contratacion",
  "descripcion_del_proceso", "objeto_del_contrato", "fecha_de_firma", "fecha_de_inicio_del_contrato", "fecha_de_fin_del_contrato",
  "valor_del_contrato", "nombre_entidad", "nit_entidad", "departamento", "ciudad",
  "documento_proveedor", "tipodocproveedor", "proveedor_adjudicado",
  "nombre_representante_legal", "identificaci_n_representante_legal",
  "nombre_ordenador_del_gasto", "n_mero_de_documento_ordenador_del_gasto",
  "nombre_supervisor", "n_mero_de_documento_supervisor",
  "nombre_ordenador_de_pago", "n_mero_de_documento_ordenador_de_pago", "urlproceso",
].join(",");

export const SELECT_I = [
  "uid", "numero_de_contrato", "numero_de_proceso", "estado_del_proceso", "tipo_de_contrato", "modalidad_de_contratacion",
  "objeto_del_contrato_a_la", "detalle_del_objeto_a_contratar", "objeto_a_contratar",
  "fecha_de_firma_del_contrato", "fecha_ini_ejec_contrato", "fecha_fin_ejec_contrato", "cuantia_contrato", "valor_contrato_con_adiciones",
  "nombre_entidad", "nit_de_la_entidad", "departamento_entidad", "municipio_entidad",
  "identificacion_del_contratista", "tipo_identifi_del_contratista", "nom_razon_social_contratista",
  "identific_representante_legal", "nombre_del_represen_legal", "ruta_proceso_en_secop_i",
].join(",");

/* ---------------------------------------------------------------- consulta */

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "No fue posible consultar.").replace(/\s+/g, " ").slice(0, 180);

/** Ejecuta una consulta y devuelve las filas junto con su estado (para mostrar qué fuente respondió y cuánto tardó). */
export async function medir(titulo: string, id: string, params: SoqlParams): Promise<{ filas: Fila[]; estado: EstadoFuente }> {
  const t0 = Date.now();
  try {
    const filas = await querySocrataDataset<Fila>(id, params, { timeoutMs: TIMEOUT_MS });
    const tope = params.$limit;
    return { filas, estado: { id, titulo, ok: true, n: filas.length, ms: Date.now() - t0, ...(tope !== undefined && filas.length >= tope ? { truncado: true } : {}) } };
  } catch (e) {
    return { filas: [], estado: { id, titulo, ok: false, n: 0, ms: Date.now() - t0, error: mensaje(e) } };
  }
}

/* ----------------------------------------------------------- normalización */

const txt = (v: unknown): string => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();
const SIN_DATO = /^(no definid[oa]|sin descripci[oó]n|no aplica|no provisto|n\/a|null)$/i;
export const limpio = (v: unknown) => {
  const t = txt(v);
  return SIN_DATO.test(t) ? "" : t;
};
export const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function persona(nombre: unknown, documento: unknown): PersonaRef | null {
  const n = limpio(nombre);
  const d = parseDocumento(txt(documento))?.numero ?? null;
  return n || d ? { nombre: n, documento: d } : null;
}

/** Quien contrata, con su documento leído según el tipo que declara el contrato (un NIT con el dígito de verificación pegado queda sin él). */
function contratistaDe(nombre: unknown, documento: unknown, tipoDoc: string): PersonaRef | null {
  const p = persona(nombre, documento);
  const d = documentoSegunTipo(txt(documento), tipoDoc);
  return p && d ? { ...p, documento: d } : p;
}

export const fecha = (v: unknown): string | null => {
  const t = txt(v).slice(0, 10);
  const año = Number(t.slice(0, 4));
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && año >= 1990 && año <= 2100 ? t : null;
};

const enlace = (v: unknown): string | null => {
  const u = typeof v === "object" && v !== null ? (v as { url?: unknown }).url : v;
  return typeof u === "string" && /^https?:\/\//i.test(u) ? u : null;
};

function valorDe(v: unknown): { valor: number | null; valorAtipico: boolean } {
  const n = Number(v);
  if (v == null || v === "" || !Number.isFinite(n) || n < 0) return { valor: null, valorAtipico: false };
  return n > VALOR_MAXIMO ? { valor: null, valorAtipico: true } : { valor: n, valorAtipico: false };
}

export const lugar = (ciudad: unknown, depto: unknown) => {
  const c = limpio(ciudad);
  const d = limpio(depto);
  return !c || plano(c) === plano(d) ? c || d : `${c}, ${d}`;
};

function claseII(estado: string, fin: string | null, hoy: string): ClaseEstado {
  const e = plano(estado);
  if (/cancelad|descartad/.test(e)) return "cancelado";
  if (/borrador|aprobacion|enviado|pendiente/.test(e)) return "no_firmado";
  if (/terminad|cerrad|liquidad|cedid/.test(e)) return "terminado";
  return fin && fin < hoy ? "por_cerrar" : "vigente";
}

function claseI(estado: string, fin: string | null, hoy: string): ClaseEstado {
  const e = plano(estado);
  if (/descartad|anormalmente/.test(e)) return "cancelado";
  if (/convocad|borrador|adjudicad/.test(e)) return "no_firmado";
  if (/liquidad|terminad/.test(e)) return "terminado";
  // «Celebrado»: SECOP I casi nunca lo actualiza, así que un plazo vencido se lee como terminado.
  return fin && fin < hoy ? "terminado" : "vigente";
}

const sinContratista: PersonaRef = { nombre: "", documento: null };

export function deSecopII(r: Fila, hoy: string): ContratoSecop {
  const fin = fecha(r.fecha_de_fin_del_contrato);
  const estado = txt(r.estado_contrato);
  return {
    id: txt(r.id_contrato),
    fuente: "SECOP II",
    roles: [],
    entidad: txt(r.nombre_entidad),
    nitEntidad: nitDeEntidad(txt(r.nit_entidad)),
    ubicacion: lugar(r.ciudad, r.departamento),
    contratista: contratistaDe(r.proveedor_adjudicado, r.documento_proveedor, txt(r.tipodocproveedor)) ?? sinContratista,
    tipoDocContratista: limpio(r.tipodocproveedor),
    representante: persona(r.nombre_representante_legal, r.identificaci_n_representante_legal),
    supervisor: persona(r.nombre_supervisor, r.n_mero_de_documento_supervisor),
    ordenadorGasto: persona(r.nombre_ordenador_del_gasto, r.n_mero_de_documento_ordenador_del_gasto),
    ordenadorPago: persona(r.nombre_ordenador_de_pago, r.n_mero_de_documento_ordenador_de_pago),
    objeto: (limpio(r.objeto_del_contrato) || limpio(r.descripcion_del_proceso)).slice(0, 400),
    tipo: limpio(r.tipo_de_contrato),
    modalidad: limpio(r.modalidad_de_contratacion),
    estado,
    clase: claseII(estado, fin, hoy),
    fechaFirma: fecha(r.fecha_de_firma),
    fechaInicio: fecha(r.fecha_de_inicio_del_contrato),
    fechaFin: fin,
    ...valorDe(r.valor_del_contrato),
    referencia: limpio(r.referencia_del_contrato),
    url: enlace(r.urlproceso),
  };
}

export function deSecopI(r: Fila, hoy: string): ContratoSecop {
  const fin = fecha(r.fecha_fin_ejec_contrato);
  const estado = txt(r.estado_del_proceso);
  const conAdiciones = Number(r.valor_contrato_con_adiciones);
  return {
    id: txt(r.uid),
    fuente: "SECOP I",
    roles: [],
    entidad: txt(r.nombre_entidad),
    nitEntidad: nitDeEntidad(txt(r.nit_de_la_entidad)),
    ubicacion: lugar(r.municipio_entidad, r.departamento_entidad),
    contratista: contratistaDe(r.nom_razon_social_contratista, r.identificacion_del_contratista, txt(r.tipo_identifi_del_contratista)) ?? sinContratista,
    tipoDocContratista: limpio(r.tipo_identifi_del_contratista),
    representante: persona(r.nombre_del_represen_legal, r.identific_representante_legal),
    supervisor: null,
    ordenadorGasto: null,
    ordenadorPago: null,
    objeto: (limpio(r.objeto_del_contrato_a_la) || limpio(r.detalle_del_objeto_a_contratar) || limpio(r.objeto_a_contratar)).slice(0, 400),
    tipo: limpio(r.tipo_de_contrato),
    modalidad: limpio(r.modalidad_de_contratacion),
    estado,
    clase: claseI(estado, fin, hoy),
    fechaFirma: fecha(r.fecha_de_firma_del_contrato),
    fechaInicio: fecha(r.fecha_ini_ejec_contrato),
    fechaFin: fin,
    // Con adiciones cuando las hay; si no, la cuantía original.
    ...valorDe(Number.isFinite(conAdiciones) && conAdiciones > 0 ? conAdiciones : r.cuantia_contrato),
    referencia: limpio(r.numero_de_contrato) || limpio(r.numero_de_proceso),
    url: enlace(r.ruta_proceso_en_secop_i),
  };
}

/** SECOP I repite el contrato una vez por rubro presupuestal: queda uno por `uid`. */
export function sinRepetidos(lista: ContratoSecop[]): ContratoSecop[] {
  const vistos = new Set<string>();
  return lista.filter((c) => (c.id && vistos.has(`${c.fuente}:${c.id}`) ? false : (vistos.add(`${c.fuente}:${c.id}`), true)));
}
