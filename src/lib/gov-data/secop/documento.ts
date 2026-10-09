/** Cédulas, NIT y nombres tal como los escriben las personas y las entidades en el SECOP. Funciones puras. */

const PESOS_DV = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Dígito de verificación del NIT (módulo 11 de la DIAN). También lo lleva el RUT de una persona natural. */
export function digitoVerificacion(numero: string): number {
  const digitos = numero.replace(/\D/g, "").split("").reverse();
  const suma = digitos.reduce((acc, d, i) => acc + Number(d) * (PESOS_DV[i] ?? 0), 0);
  const r = suma % 11;
  return r > 1 ? 11 - r : r;
}

const miles = (n: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Lee un documento escrito a mano: «51.740.316» → 51740316; «860009578-6» → 860009578 con dv 6;
 * «1152716854 -1», «1085106550.» también. Lo que no es un número («Sin Descripcion», «No definido») da null.
 */
export function parseDocumento(crudo: string | null | undefined): { numero: string; dv: string | null } | null {
  if (!crudo) return null;
  const m = crudo.trim().match(/^(\d[\d.\s]*?)\s*\.?\s*(?:[-–]\s*(\d))?$/);
  if (!m) return null;
  const numero = m[1].replace(/[.\s]/g, "");
  if (numero.length < 5 || numero.length > 12 || /^(\d)\1+$/.test(numero)) return null;
  return { numero, dv: m[2] ?? null };
}

/**
 * Lo que teclea quien consulta. En NIT se acepta con o sin dígito de verificación («900.062.917-9»,
 * «9000629179», «900062917»); en cédula se toma el número tal cual.
 */
export function entradaDocumento(crudo: string, modo: "cedula" | "nit"): { numero: string; dv: string } | null {
  const p = parseDocumento(crudo);
  if (!p) return null;
  let numero = p.numero;
  if (modo === "nit") {
    if (p.dv !== null) numero = p.numero;
    else if (numero.length === 10 && String(digitoVerificacion(numero.slice(0, 9))) === numero[9]) numero = numero.slice(0, 9);
  }
  return { numero, dv: String(digitoVerificacion(numero)) };
}

/** «79426120» → «79.426.120»; con `nit`, además el dígito de verificación («900.062.917-9»). */
export function formatoDocumento(numero: string, nit = false): string {
  return nit ? `${miles(numero)}-${digitoVerificacion(numero)}` : miles(numero);
}

/** NIT de una entidad tal como lo trae el SECOP: a veces con el dígito de verificación pegado («8999990619»). */
export function nitDeEntidad(crudo: string | null | undefined): string | null {
  const p = parseDocumento(crudo);
  if (!p) return null;
  const n = p.numero;
  return n.length === 10 && String(digitoVerificacion(n.slice(0, 9))) === n[9] ? n.slice(0, 9) : n;
}

/**
 * Documento de quien contrata, leyendo el tipo que declara el contrato: si es NIT, el dígito de verificación pegado
 * («8999993068» → 899999306) se quita; si es cédula (o no dice), se deja el número tal cual.
 */
export function documentoSegunTipo(crudo: string | null | undefined, tipo: string | null | undefined): string | null {
  const esNit = /\bnit\b/.test((tipo ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
  return esNit ? nitDeEntidad(crudo) : (parseDocumento(crudo)?.numero ?? null);
}

/** ¿Este documento «sucio» de la base es el que se busca? */
export const mismoDocumento = (crudo: string | null | undefined, numero: string) => parseDocumento(crudo)?.numero === numero;

/**
 * Condición SoQL para encontrar un documento en una columna sin perder las variantes con las
 * que lo escribió quien cargó el contrato (con puntos, con punto final, con dígito de verificación).
 * `numero` es solo dígitos: se verifica porque va dentro de la consulta.
 * El dígito de verificación pegado («9000629179») también se busca: en el SECOP I es ~4 % de los contratos de una empresa grande.
 * Solo se reconoce como el mismo NIT si el contrato lo declara NIT (ver `documentoSegunTipo`); una cédula de 10 dígitos no se recorta.
 */
export function clausulaDocumento(columna: string, numero: string): string {
  if (!/^\d{5,12}$/.test(numero)) throw new Error("Documento no válido.");
  const dv = digitoVerificacion(numero);
  const m = miles(numero);
  const exactos = [numero, `${numero}.`, m, `${numero}-${dv}`, `${m}-${dv}`, `${numero}${dv}`].map((v) => `'${v}'`).join(",");
  const prefijos = [`${numero}-`, `${numero} -`, `${m}-`].map((p) => `${columna} like '${p}%'`).join(" OR ");
  return `(${columna} in (${exactos}) OR ${prefijos})`;
}

/* ------------------------------------------------------------------ nombres */

const PALABRAS_VACIAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "EL", "Y", "E", "SAS", "SA", "S", "A", "LTDA", "LIMITADA", "CIA", "CO", "EU", "ESP"]);

/** «Ángel  Arévalo» → «ANGEL AREVALO». */
export const normalizarNombre = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Las palabras que identifican un nombre (sin artículos ni sufijos societarios). */
export const palabrasNombre = (s: string) =>
  normalizarNombre(s)
    .split(" ")
    .filter((p) => p.length > 1 && !PALABRAS_VACIAS.has(p));

/** ¿Todas las palabras de la búsqueda están en este nombre, en cualquier orden? */
export function contieneNombre(busqueda: string, nombre: string): boolean {
  const buscadas = palabrasNombre(busqueda);
  if (buscadas.length === 0) return false;
  const tiene = new Set(palabrasNombre(nombre));
  return buscadas.every((p) => tiene.has(p));
}

/** Parte de las palabras de `a` que aparecen en `b`, de 0 a 1. */
export function parecido(a: string, b: string): number {
  const pa = palabrasNombre(a);
  if (pa.length === 0) return 0;
  const tb = new Set(palabrasNombre(b));
  return pa.filter((p) => tb.has(p)).length / pa.length;
}

/** El texto de una búsqueda por nombre, listo para el buscador de texto completo (solo letras, números y espacios). */
export const consultaNombre = (s: string) => palabrasNombre(s).slice(0, 6).join(" ");
