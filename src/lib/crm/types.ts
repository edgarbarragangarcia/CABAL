/**
 * Tipos compartidos de la red de relaciones del CRM (servidor y cliente).
 * El servidor trae los contactos de Bitrix24 ya "aplanados" en campos y
 * valores; el navegador decide con qué campos relacionar y arma la red.
 */

/** Las cuatro formas de relación que se buscan entre contactos. */
export type Dimension = "lugar" | "intereses" | "actividades" | "referidos";

export const DIMENSIONS: readonly Dimension[] = ["lugar", "intereses", "actividades", "referidos"];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  lugar: "Mismo lugar",
  intereses: "Intereses en común",
  actividades: "Mismas actividades",
  referidos: "Referidos",
};

/** Un campo del contacto en el CRM que sirve para relacionar personas. */
export type CrmField = {
  /** Código del campo en Bitrix24, p. ej. `ADDRESS_CITY` o `UF_CRM_1712345678`. */
  key: string;
  label: string;
  /** Tipo de Bitrix24: `string`, `enumeration`, `crm`, `employee`, `boolean`, `crm_status`... */
  type: string;
  /** Relación asignada automáticamente por el nombre del campo; `null` = no se usa salvo que se elija. */
  auto: Dimension | null;
  /** Valores legibles; los contactos guardan índices a esta lista. */
  values: string[];
  /** Solo en campos que enlazan a otro contacto: id del contacto al que apunta cada valor. */
  contactRefs?: (string | null)[];
  /** Cuántos contactos tienen algún valor en este campo. */
  filled: number;
};

export type CrmContact = {
  id: string;
  name: string;
  /** Pares [índice del campo en `fields`, índices de sus valores]. */
  v: [number, number[]][];
};

export type CrmSnapshot = {
  /** Dominio del portal de Bitrix24. */
  portal: string;
  fetchedAt: string;
  /** Contactos que hay en el CRM (pueden ser más que los analizados). */
  total: number;
  fields: CrmField[];
  contacts: CrmContact[];
};

export type RedCrmResponse =
  | { status: "ok"; snapshot: CrmSnapshot }
  | { status: "configurar"; falta: { admin: boolean; bitrix: boolean } }
  | { status: "error"; message: string };
