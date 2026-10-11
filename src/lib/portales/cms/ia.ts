import { aLista, aTexto } from "../../texto-ia";
import type { Tematica } from "./tematicas";
import type { AjustesPortal } from "./tipos";

/**
 * Generación de artículos con IA para los portales: cómo se le pide a la IA (según la temática del portal) y cómo se lee lo que
 * devuelve. Esta parte no llama a ningún modelo: eso lo hace `generar.ts`, con el proveedor que el panel tenga configurado.
 * Lo generado siempre llega como BORRADOR marcado «generado con IA»: una persona lo lee y lo aprueba antes de publicarlo.
 */

export const EXTENSIONES = {
  corto: { etiqueta: "Corto", palabras: "350 a 450", maxTokens: 2400 },
  medio: { etiqueta: "Medio", palabras: "600 a 800", maxTokens: 3400 },
  largo: { etiqueta: "Largo", palabras: "900 a 1100", maxTokens: 4400 },
} as const;
export type Extension = keyof typeof EXTENSIONES;

export type ContextoIa = { nombre: string; ciudad: string; tematica: Tematica; ajustes: AjustesPortal };
export type PeticionArticulo = { tema: string; tipoId?: string; categoria?: string; extension: Extension; palabraClave?: string; datos?: string };

export type BorradorIa = { titulo: string; resumen: string; categoria: string; tipo: string; etiquetas: string[]; seoDescripcion: string; cuerpo: string };
export type IdeaIa = { titulo: string; enfoque: string; categoria: string; tipo: string };

const REGLAS_GENERALES = [
  "Escribe en español de Colombia, hablándole al lector de tú, con frases claras y sin tecnicismos innecesarios.",
  "Usa solo información general y bien establecida. NO inventes cifras, porcentajes, estudios, leyes, fechas, precios, citas ni testimonios. Si no estás seguro de un dato, no lo incluyas o plantéalo en términos generales.",
  "No menciones marcas, empresas ni productos concretos, ni a personas reales.",
  "El artículo es informativo y útil por sí mismo: no hagas propaganda política ni menciones partidos o candidatos.",
  "Que sea original y escrito para personas, no para buscadores: sin relleno ni repeticiones.",
];

function contexto(c: ContextoIa) {
  const t = c.tematica;
  return [
    `Eres el redactor del portal «${c.nombre}»${c.ciudad ? ` (${c.ciudad})` : ""}, la sección «${t.seccion.nombre}». Escribes como un ${t.ia.voz}.`,
    `Tu público: ${t.ia.audiencia}.`,
    c.ajustes.ia.tono ? `Tono del portal: ${c.ajustes.ia.tono}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function reglas(c: ContextoIa) {
  const propias = c.ajustes.ia.indicaciones.trim();
  return [...REGLAS_GENERALES, ...c.tematica.ia.pautas, ...(propias ? [`Indicaciones del equipo editorial: ${propias}`] : [])].map((r) => `- ${r}`).join("\n");
}

export function promptArticulo(c: ContextoIa, p: PeticionArticulo): { system: string; user: string; maxTokens: number } {
  const t = c.tematica;
  const ext = EXTENSIONES[p.extension];
  const tipo = t.tipos.find((x) => x.id === p.tipoId);
  const system = [
    contexto(c),
    "",
    "REGLAS (obligatorias):",
    reglas(c),
    "",
    "FORMATO DE SALIDA: responde SOLO con un objeto JSON válido (sin texto antes ni después y sin bloques de código) con estas claves:",
    '- "titulo": claro y atractivo, máximo 90 caracteres, sin mayúsculas sostenidas ni gancho engañoso.',
    '- "resumen": una o dos frases de 120 a 220 caracteres que digan de qué trata.',
    `- "categoria": exactamente una de: ${t.categorias.map((x) => `«${x}»`).join(", ")}.`,
    '- "etiquetas": de 3 a 5 palabras clave en minúscula.',
    '- "seoDescripcion": máximo 160 caracteres, para buscadores.',
    `- "cuerpo": el artículo en markdown, de ${ext.palabras} palabras. Empieza con una introducción de 2 o 3 frases (sin título), sigue con 3 a 5 secciones con subtítulos «##», usa listas con «-» cuando ayuden y cierra con «## En resumen» con 3 a 5 viñetas. Sin HTML y sin repetir el título.`,
  ].join("\n");
  const user = [
    `Tema: ${p.tema.trim()}`,
    tipo ? `Tipo de artículo: ${tipo.nombre}. ${tipo.guia}` : "",
    p.categoria ? `Categoría preferida: ${p.categoria}` : "",
    p.palabraClave?.trim() ? `Palabra clave que debe aparecer de forma natural: ${p.palabraClave.trim()}` : "",
    p.datos?.trim() ? `Datos del equipo editorial que debes respetar (úsalos tal cual, no los cambies ni les agregues cifras):\n${p.datos.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user, maxTokens: ext.maxTokens };
}

export function promptIdeas(c: ContextoIa, cantidad: number, enfoque?: string): { system: string; user: string; maxTokens: number } {
  const t = c.tematica;
  const system = [
    contexto(c),
    "",
    "Propones ideas de artículos para el portal: útiles, concretas, que la gente busque de verdad y que se puedan escribir sin inventar datos.",
    "REGLAS:",
    reglas(c),
    "",
    `FORMATO DE SALIDA: responde SOLO con un arreglo JSON de ${cantidad} objetos, sin texto antes ni después y sin bloques de código. Cada objeto tiene: "titulo" (máximo 90 caracteres), "enfoque" (una frase que diga qué cubrirá), "categoria" (exactamente una de: ${t.categorias.map((x) => `«${x}»`).join(", ")}) y "tipo" (exactamente uno de: ${t.tipos.map((x) => `«${x.nombre}»`).join(", ")}). Que no se repitan entre sí.`,
  ].join("\n");
  return { system, user: enfoque?.trim() ? `Enfoque o necesidad actual del portal: ${enfoque.trim()}` : "Propón ideas variadas para el portal.", maxTokens: 2200 };
}

// ------------------------------------------------------------ lectura ---

/** Saca el JSON de la respuesta aunque el modelo lo haya envuelto en un bloque de código o le haya puesto texto alrededor. */
export function extraerJson(texto: string): unknown {
  const limpio = texto.replace(/```(?:json)?/gi, "");
  const inicio = limpio.search(/[{[]/);
  if (inicio < 0) throw new Error("La IA no devolvió el formato esperado.");
  const cierre = limpio[inicio] === "{" ? "}" : "]";
  const fin = limpio.lastIndexOf(cierre);
  if (fin <= inicio) throw new Error("La IA no devolvió el formato esperado.");
  try {
    return JSON.parse(limpio.slice(inicio, fin + 1));
  } catch {
    throw new Error("La IA devolvió el artículo incompleto o mal formado. Vuelve a intentarlo.");
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const recortar = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…`);
const sinComillas = (s: string) => s.replace(/^[«"“'\s]+|[»"”'\s]+$/g, "");

function categoriaValida(valor: string, validas: string[]) {
  const v = norm(valor);
  return validas.find((c) => norm(c) === v) ?? validas.find((c) => v && (norm(c).includes(v) || v.includes(norm(c)))) ?? "";
}

/** Lo que devolvió la IA convertido en un borrador que cumple las reglas de la base de datos. */
export function leerArticuloIa(respuesta: string, t: Tematica): BorradorIa {
  const j = extraerJson(respuesta) as Record<string, unknown>;
  if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("La IA no devolvió un artículo.");
  const titulo = recortar(sinComillas(aTexto(j.titulo)), 160);
  let cuerpo = aTexto(j.cuerpo).replace(/\r\n?/g, "\n").trim();
  if (titulo.length < 3 || cuerpo.length < 200) throw new Error("La IA devolvió un artículo demasiado corto o sin título. Vuelve a intentarlo.");
  // Si repite el título como encabezado, se quita: el portal ya lo muestra arriba.
  cuerpo = cuerpo.replace(/^#{1,2}\s+.+\n+/, (m) => (norm(m.replace(/^#+\s+/, "")) === norm(titulo) ? "" : m));
  // El aviso de la temática cierra el artículo, escrito por nosotros y no por el modelo.
  if (t.ia.aviso && !cuerpo.includes(t.ia.aviso)) cuerpo += `\n\n> ${t.ia.aviso}`;
  const etiquetas = [...new Set(aLista(j.etiquetas).map((e) => norm(e).replace(/^#/, "").slice(0, 30)).filter((e) => e.length >= 2))].slice(0, 5);
  const resumen = recortar(aTexto(j.resumen).replace(/\s+/g, " "), 400);
  const seoBruto = aTexto(j.seoDescripcion).replace(/\s+/g, " ");
  return {
    titulo,
    resumen,
    categoria: categoriaValida(aTexto(j.categoria), t.categorias),
    tipo: "",
    etiquetas,
    seoDescripcion: recortar(seoBruto || resumen, 160),
    cuerpo,
  };
}

export function leerIdeasIa(respuesta: string, t: Tematica): IdeaIa[] {
  const j = extraerJson(respuesta);
  const lista = Array.isArray(j) ? j : Array.isArray((j as { ideas?: unknown })?.ideas) ? (j as { ideas: unknown[] }).ideas : [];
  const ideas = lista
    .map((x): IdeaIa => {
      const o = (x ?? {}) as Record<string, unknown>;
      const tipoNombre = norm(aTexto(o.tipo));
      return {
        titulo: recortar(sinComillas(aTexto(o.titulo)), 90),
        enfoque: recortar(aTexto(o.enfoque), 220),
        categoria: categoriaValida(aTexto(o.categoria), t.categorias),
        tipo: t.tipos.find((k) => norm(k.nombre) === tipoNombre || k.id === tipoNombre)?.id ?? "",
      };
    })
    .filter((i) => i.titulo.length >= 3);
  if (ideas.length === 0) throw new Error("La IA no devolvió ideas. Vuelve a intentarlo.");
  return ideas;
}
