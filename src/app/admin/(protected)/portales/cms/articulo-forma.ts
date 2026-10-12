import type { Articulo, EstadoArticulo } from "@/lib/portales/cms/tipos";
import { aCampoFecha, deCampoFecha } from "./comun";

/** El artículo tal como se edita en el formulario (textos en vez de listas, fecha en hora local de Colombia). */
export type Forma = {
  titulo: string;
  resumen: string;
  cuerpo: string;
  categoria: string;
  tipo: string;
  etiquetas: string[];
  autor: string;
  seoDescripcion: string;
  estado: EstadoArticulo;
  destacado: boolean;
  generadoConIa: boolean;
  revisado: boolean;
  slug: string;
  portadaUrl: string;
  portadaAlt: string;
  /** datetime-local en hora de Colombia, o vacío. */
  publicarEn: string;
  notaRevision: string;
};

export const aForma = (a: Articulo): Forma => ({
  titulo: a.titulo, resumen: a.resumen, cuerpo: a.cuerpo, categoria: a.categoria, tipo: a.tipo, etiquetas: a.etiquetas, autor: a.autor, seoDescripcion: a.seoDescripcion,
  estado: a.estado, destacado: a.destacado, generadoConIa: a.generadoConIa, revisado: a.revisado, slug: a.slug, portadaUrl: a.portadaUrl, portadaAlt: a.portadaAlt,
  publicarEn: aCampoFecha(a.publicarEn), notaRevision: a.notaRevision,
});

export const formaVacia = (tipo: string): Forma => ({
  titulo: "", resumen: "", cuerpo: "", categoria: "", tipo, etiquetas: [], autor: "", seoDescripcion: "", estado: "borrador", destacado: false, generadoConIa: false,
  revisado: false, slug: "", portadaUrl: "", portadaAlt: "", publicarEn: "", notaRevision: "",
});

/** Lo que se manda al servidor. */
export const cuerpoApi = (f: Forma) => ({
  titulo: f.titulo.trim(),
  resumen: f.resumen.trim(),
  cuerpo: f.cuerpo,
  categoria: f.categoria,
  tipo: f.tipo,
  etiquetas: f.etiquetas.slice(0, 8),
  estado: f.estado,
  destacado: f.destacado,
  generadoConIa: f.generadoConIa,
  revisado: f.revisado,
  autor: f.autor.trim(),
  seoDescripcion: f.seoDescripcion.trim(),
  portadaUrl: f.portadaUrl,
  portadaAlt: f.portadaAlt.trim(),
  publicarEn: f.estado === "programado" ? deCampoFecha(f.publicarEn) : "",
  notaRevision: f.estado === "revision" ? f.notaRevision.trim() : "",
  ...(f.slug ? { slug: f.slug } : {}),
});

export const ESTADOS: { id: EstadoArticulo; texto: string; clase: string; ayuda: string }[] = [
  { id: "borrador", texto: "Borrador", clase: "bg-surface-muted text-muted-foreground", ayuda: "Solo lo ves tú." },
  { id: "revision", texto: "En revisión", clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300", ayuda: "Listo para que alguien lo lea antes de publicar." },
  { id: "programado", texto: "Programado", clase: "bg-violet-500/15 text-violet-700 dark:text-violet-300", ayuda: "Se publica solo a la fecha y hora que elijas." },
  { id: "publicado", texto: "Publicado", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", ayuda: "Ya se ve en el portal." },
  { id: "archivado", texto: "Archivado", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-300", ayuda: "Guardado, pero fuera del portal." },
];
export const estadoInfo = (e: EstadoArticulo) => ESTADOS.find((x) => x.id === e)!;
