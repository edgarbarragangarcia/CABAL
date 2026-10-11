import { z } from "zod";

import type { EspacioId } from "./tematicas";

/** Tipos y validaciones del CMS de los portales (artículos, anuncios y ajustes). Sin servidor: los usan el panel y las páginas públicas. */

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

// ------------------------------------------------------------- artículos ---

export const ESTADOS_ARTICULO = ["borrador", "publicado", "archivado"] as const;
export type EstadoArticulo = (typeof ESTADOS_ARTICULO)[number];

export type Articulo = {
  id: string;
  portalId: string;
  slug: string;
  titulo: string;
  resumen: string;
  /** Markdown. */
  cuerpo: string;
  categoria: string;
  tipo: string;
  etiquetas: string[];
  estado: EstadoArticulo;
  destacado: boolean;
  generadoConIa: boolean;
  revisado: boolean;
  autor: string;
  seoDescripcion: string;
  vistas: number;
  publicadoEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
};

/** Lo que trae el listado de artículos: sin el cuerpo (puede pesar decenas de miles de caracteres). */
export type ArticuloLista = Omit<Articulo, "cuerpo" | "seoDescripcion">;

export const slugArticuloSchema = z.string().regex(/^[a-z0-9-]{3,90}$/, "El enlace usa de 3 a 90 letras minúsculas, números o guiones.");

export const articuloSchema = z.object({
  titulo: texto(3, 160),
  resumen: z.string().trim().max(400).default(""),
  cuerpo: z.string().max(60_000).default(""),
  categoria: z.string().trim().max(40).default(""),
  tipo: z.string().trim().max(30).default(""),
  etiquetas: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  estado: z.enum(ESTADOS_ARTICULO).default("borrador"),
  destacado: z.boolean().default(false),
  generadoConIa: z.boolean().default(false),
  revisado: z.boolean().default(false),
  autor: z.string().trim().max(80).default(""),
  seoDescripcion: z.string().trim().max(200).default(""),
  slug: slugArticuloSchema.optional(),
});
export type DatosArticulo = z.infer<typeof articuloSchema>;

/** Para publicar: lo mínimo de un artículo, y que los generados con IA los haya leído una persona. */
export function problemaParaPublicar(a: Pick<DatosArticulo, "titulo" | "cuerpo" | "resumen" | "generadoConIa" | "revisado">): string | null {
  if (a.cuerpo.trim().length < 200) return "El artículo es muy corto para publicarlo: escribe al menos unos párrafos.";
  if (a.resumen.trim().length < 20) return "Escribe un resumen de una o dos frases: aparece en el listado y en los buscadores.";
  if (a.generadoConIa && !a.revisado) return "Este artículo lo generó la IA: léelo, corrígelo y marca «Lo revisé» antes de publicarlo.";
  return null;
}

// -------------------------------------------------------------- anuncios ---

export const ESPACIOS_IDS = ["cabecera", "lateral", "articulo", "pie"] as const satisfies readonly EspacioId[];
export const FORMATOS_ANUNCIO = ["texto", "imagen"] as const;

export type Anuncio = {
  id: string;
  portalId: string;
  espacio: EspacioId;
  nombre: string;
  anunciante: string;
  formato: (typeof FORMATOS_ANUNCIO)[number];
  titulo: string;
  texto: string;
  boton: string;
  imagenUrl: string;
  destinoUrl: string;
  desde: string | null;
  hasta: string | null;
  estado: "activo" | "pausado";
  prioridad: number;
  impresiones: number;
  clics: number;
  creadoEn: string;
};

const urlHttp = (max: number) => z.string().trim().max(max).refine((u) => /^https?:\/\/[^\s]+$/i.test(u), "Escribe un enlace completo que empiece por http:// o https://.");
const fecha = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida.")]).transform((f) => f || null);

export const anuncioSchema = z
  .object({
    espacio: z.enum(ESPACIOS_IDS),
    nombre: texto(2, 80),
    anunciante: z.string().trim().max(80).default(""),
    formato: z.enum(FORMATOS_ANUNCIO).default("texto"),
    titulo: z.string().trim().max(90).default(""),
    texto: z.string().trim().max(220).default(""),
    boton: z.string().trim().max(30).default(""),
    imagenUrl: z.union([z.literal(""), urlHttp(500)]).default(""),
    destinoUrl: urlHttp(500),
    desde: fecha.default(null),
    hasta: fecha.default(null),
    estado: z.enum(["activo", "pausado"]).default("activo"),
    prioridad: z.number().int().min(1).max(10).default(1),
  })
  .superRefine((a, ctx) => {
    if (a.formato === "imagen" && !a.imagenUrl) ctx.addIssue({ code: "custom", path: ["imagenUrl"], message: "Pega el enlace de la imagen del anuncio." });
    if (a.formato === "texto" && a.titulo.length < 3) ctx.addIssue({ code: "custom", path: ["titulo"], message: "Escribe el título del anuncio." });
    if (a.desde && a.hasta && a.desde > a.hasta) ctx.addIssue({ code: "custom", path: ["hasta"], message: "La fecha final no puede ser anterior a la inicial." });
  });
export type DatosAnuncio = z.infer<typeof anuncioSchema>;

// --------------------------------------------------------------- ajustes ---

export type AjustesPortal = {
  /** Llamado a sumarse a la comunidad de María Fernanda Cabal (cuadro de cada artículo y banda del inicio). */
  union: { titulo: string; texto: string; boton: string };
  /** Quién edita el portal: aparece en el pie y junto al llamado a sumarse. */
  editor: string;
  /** Permite que Google y otros buscadores indexen el portal. */
  buscadores: boolean;
  /** Indicaciones propias para la IA, además de las de la temática. */
  ia: { tono: string; indicaciones: string };
};

export const ajustesSchema = z.object({
  union: z.object({ titulo: texto(3, 90), texto: texto(3, 240), boton: texto(2, 30) }),
  editor: z.string().trim().max(120),
  buscadores: z.boolean(),
  ia: z.object({ tono: z.string().trim().max(160), indicaciones: z.string().trim().max(800) }),
});

export const ajustesPorDefecto = (): AjustesPortal => ({
  union: {
    titulo: "Súmate a la comunidad de María Fernanda Cabal",
    texto: "Conoce sus propuestas, conversa con otros colombianos y participa en tu municipio.",
    boton: "Quiero unirme",
  },
  editor: "Una iniciativa de la comunidad de María Fernanda Cabal",
  buscadores: false,
  ia: { tono: "", indicaciones: "" },
});

// --------------------------------------------------------------- resumen ---

export type ResumenPortal = {
  publicados: number;
  borradores: number;
  lecturas: number;
  vistas30d: number;
  cta30d: number;
  anuncioClics30d: number;
  anunciosActivos: number;
  adeptos: number;
  adeptos30d: number;
};

export const resumenVacio: ResumenPortal = { publicados: 0, borradores: 0, lecturas: 0, vistas30d: 0, cta30d: 0, anuncioClics30d: 0, anunciosActivos: 0, adeptos: 0, adeptos30d: 0 };
