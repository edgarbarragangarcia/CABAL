import { parsearMarkdown } from "./puro";

/**
 * Revisión de calidad de un artículo antes de publicarlo: lo que impide publicar («error») y lo que conviene mejorar
 * («aviso»). Función pura (sin red) para poder probarla y para que el editor la muestre en vivo.
 */

export type Hallazgo = { nivel: "error" | "aviso" | "ok"; texto: string; campo?: "titulo" | "resumen" | "cuerpo" | "portada" | "categoria" | "etiquetas" | "seo" };

export type EntradaCalidad = {
  titulo: string;
  resumen: string;
  cuerpo: string;
  categoria: string;
  etiquetas: string[];
  portadaUrl: string;
  portadaAlt: string;
  seoDescripcion: string;
  generadoConIa: boolean;
  revisado: boolean;
};

const palabras = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function revisarArticulo(a: EntradaCalidad): Hallazgo[] {
  const h: Hallazgo[] = [];
  const t = a.titulo.trim().length;
  if (t < 3) h.push({ nivel: "error", texto: "Falta el título.", campo: "titulo" });
  else if (t < 25 || t > 70) h.push({ nivel: "aviso", texto: `El título tiene ${t} caracteres: entre 25 y 70 se lee completo en buscadores.`, campo: "titulo" });
  else h.push({ nivel: "ok", texto: "Título de buen largo.", campo: "titulo" });

  const r = a.resumen.trim().length;
  if (r < 20) h.push({ nivel: "error", texto: "Escribe un resumen de una o dos frases: sale en el listado y en buscadores.", campo: "resumen" });
  else if (r < 70 || r > 220) h.push({ nivel: "aviso", texto: `El resumen tiene ${r} caracteres: entre 70 y 220 funciona mejor.`, campo: "resumen" });
  else h.push({ nivel: "ok", texto: "Resumen de buen largo.", campo: "resumen" });

  const cuerpo = a.cuerpo.trim();
  const p = palabras(cuerpo);
  const bloques = parsearMarkdown(cuerpo);
  if (cuerpo.length < 200) h.push({ nivel: "error", texto: "El texto es muy corto para publicarlo: escribe al menos unos párrafos.", campo: "cuerpo" });
  else if (p < 300) h.push({ nivel: "aviso", texto: `Tiene ${p} palabras: con 300 o más rinde mejor en buscadores.`, campo: "cuerpo" });
  else h.push({ nivel: "ok", texto: `${p} palabras.`, campo: "cuerpo" });
  if (p > 500 && !bloques.some((b) => b.tipo === "h2" || b.tipo === "h3")) h.push({ nivel: "aviso", texto: "Es un texto largo sin subtítulos: divídelo con «## Subtítulo» para que se lea mejor.", campo: "cuerpo" });
  if (/\]\(https?:\/\/\)/.test(cuerpo)) h.push({ nivel: "error", texto: "Hay un enlace sin completar («](https://)»). Complétalo o quítalo.", campo: "cuerpo" });
  const sinAlt = bloques.filter((b) => b.tipo === "img" && !b.alt.trim()).length;
  if (sinAlt > 0) h.push({ nivel: "aviso", texto: `${sinAlt} imagen${sinAlt === 1 ? "" : "es"} sin texto alternativo (accesibilidad).`, campo: "cuerpo" });

  if (!a.portadaUrl) h.push({ nivel: "aviso", texto: "Sin imagen de portada: se usará la ilustración del tema.", campo: "portada" });
  else if (!a.portadaAlt.trim()) h.push({ nivel: "aviso", texto: "La portada no tiene texto alternativo.", campo: "portada" });
  else h.push({ nivel: "ok", texto: "Portada con texto alternativo.", campo: "portada" });

  if (!a.categoria) h.push({ nivel: "aviso", texto: "Elige una categoría para que se encuentre en el listado.", campo: "categoria" });
  if (a.etiquetas.length === 0) h.push({ nivel: "aviso", texto: "Agrega al menos una etiqueta.", campo: "etiquetas" });
  if (a.seoDescripcion.length > 160) h.push({ nivel: "aviso", texto: "La descripción para buscadores pasa de 160 caracteres: se cortará.", campo: "seo" });
  if (a.generadoConIa && !a.revisado) h.push({ nivel: "error", texto: "Lo escribió la IA: léelo completo y marca «Lo revisé» antes de publicarlo." });
  return h;
}

/** ¿Hay algo que impida publicar? */
export const bloqueaPublicar = (h: Hallazgo[]) => h.some((x) => x.nivel === "error");
