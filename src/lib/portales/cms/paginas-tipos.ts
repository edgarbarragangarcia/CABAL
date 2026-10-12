import { z } from "zod";

/** Páginas fijas de un portal (Quiénes somos, Cómo participar…): tipos y validaciones, sin servidor. */

export type Pagina = {
  id: string;
  portalId: string;
  slug: string;
  titulo: string;
  resumen: string;
  /** Markdown. */
  cuerpo: string;
  estado: "borrador" | "publicado";
  /** Aparece en el menú y en el pie del portal. */
  enMenu: boolean;
  orden: number;
  portadaUrl: string;
  creadoEn: string;
  actualizadoEn: string;
};

/** Slugs que el portal ya usa en su propio sitio: una página no puede llamarse así. */
export const SLUGS_RESERVADOS = new Set(["articulos", "eventos", "unete", "anuncio", "pagina", "baja", "feed", "sitemap", "demo"]);

export const paginaSchema = z.object({
  titulo: z.string().trim().min(3).max(120),
  resumen: z.string().trim().max(300).default(""),
  cuerpo: z.string().max(60_000).default(""),
  estado: z.enum(["borrador", "publicado"]).default("borrador"),
  enMenu: z.boolean().default(false),
  orden: z.number().int().min(0).max(99).default(0),
  portadaUrl: z.union([z.literal(""), z.string().trim().max(600).refine((u) => /^https:\/\/[^\s]+$/i.test(u), "La portada debe ser un enlace https.")]).default(""),
  slug: z.string().regex(/^[a-z0-9-]{3,60}$/, "El enlace usa de 3 a 60 letras minúsculas, números o guiones.").optional(),
});
export type DatosPagina = z.infer<typeof paginaSchema>;
