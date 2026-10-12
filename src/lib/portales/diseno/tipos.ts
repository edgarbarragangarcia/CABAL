/**
 * Diseño de un portal: todo lo que su editor puede cambiar sin tocar código ni desplegar (colores por modo, tipografías,
 * tamaños, regiones, menú, cintillo, ventana emergente, estilo de cada nota y orden de las secciones del inicio).
 *
 * Principio: «todo es un ajuste». Es un JSON guardado junto a los ajustes del portal (`portal_ajustes.ajustes`), sin migración;
 * `sanearDiseno` valida cada campo y rellena lo que falte, así que lo guardado viejo o dañado nunca rompe una página.
 * Sin servidor ni React: lo usan el panel, el generador de CSS y las páginas públicas.
 */

export const REGIONES = [
  { id: "navbar", nombre: "Encabezado del sitio", ayuda: "La barra con el nombre, el menú y el botón principal." },
  { id: "hero", nombre: "Portada del inicio", ayuda: "La primera pantalla del inicio." },
  { id: "tarjetas", nombre: "Tarjetas", ayuda: "Las tarjetas de artículos y de eventos." },
  { id: "cuerpo", nombre: "Secciones y cuerpo", ayuda: "Las secciones del inicio y el cuerpo de las páginas." },
  { id: "encabezado", nombre: "Títulos de sección", ayuda: "La etiqueta, el título y el texto que abren cada sección." },
  { id: "pie", nombre: "Pie de página", ayuda: "El cierre del sitio." },
] as const;
export type RegionId = (typeof REGIONES)[number]["id"];

/** Qué controles tiene sentido mostrar en cada región. */
export type ControlRegion = "fondo" | "degradado" | "texto" | "acento" | "fuentes" | "escala" | "padding" | "radio" | "ancho" | "alinear" | "ocultar";
export const CONTROLES: Record<RegionId, ControlRegion[]> = {
  navbar: ["fondo", "texto", "acento", "fuentes", "escala", "radio", "ancho", "ocultar"],
  hero: ["fondo", "degradado", "texto", "acento", "fuentes", "escala", "padding", "alinear", "ocultar"],
  tarjetas: ["fondo", "texto", "acento", "fuentes", "escala", "radio"],
  cuerpo: ["fondo", "degradado", "texto", "acento", "fuentes", "escala", "padding", "ancho", "alinear", "ocultar"],
  encabezado: ["texto", "acento", "fuentes", "escala", "alinear"],
  pie: ["fondo", "texto", "acento", "fuentes", "escala", "padding", "ocultar"],
};

export const FUENTES = {
  plantilla: { nombre: "La de la plantilla", css: null },
  sistema: { nombre: "Sistema (limpia)", css: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" },
  moderna: { nombre: "Moderna", css: "var(--font-sans), system-ui, sans-serif" },
  elegante: { nombre: "Elegante (con serifa)", css: "var(--font-display), ui-serif, Georgia, serif" },
  periodico: { nombre: "Periódico", css: "Georgia, 'Times New Roman', Times, serif" },
  condensada: { nombre: "Condensada", css: "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif" },
  mono: { nombre: "Máquina de escribir", css: "var(--font-mono), ui-monospace, 'SFMono-Regular', Menlo, monospace" },
} as const;
export type FuenteId = keyof typeof FUENTES;
export const FUENTES_IDS = Object.keys(FUENTES) as FuenteId[];

export type Modo = "plantilla" | "claro" | "oscuro";
/** Colores de un modo (claro u oscuro). Vacío = el de la plantilla. */
export type Colores = { fondo?: string; texto?: string; alterno?: string; acento?: string; acento2?: string };
export type ColoresRegion = { fondo?: string; texto?: string; acento?: string };

export type EstiloRegion = {
  fondo?: string;
  /** Segundo color: con `fondo`, forma un degradado. */
  fondo2?: string;
  texto?: string;
  acento?: string;
  /** Colores solo para el modo claro o el oscuro (ganan sobre los de arriba en ese modo). */
  claro?: ColoresRegion;
  oscuro?: ColoresRegion;
  fuenteTitulos?: FuenteId;
  fuenteTexto?: FuenteId;
  /** Tamaño del contenido de la región, en %: 70–160. */
  escala?: number;
  padArriba?: number;
  padAbajo?: number;
  radio?: number;
  anchoMax?: number;
  alinear?: "izquierda" | "centro" | "derecha";
  oculto?: boolean;
};

export const SECCIONES_INICIO = [
  { id: "servicios", nombre: "La comunidad" },
  { id: "eventos", nombre: "Eventos" },
  { id: "articulos", nombre: "Artículos" },
  { id: "pasos", nombre: "Cómo participar" },
  { id: "suscribir", nombre: "Súmate" },
  { id: "preguntas", nombre: "Preguntas" },
] as const;
export type SeccionId = (typeof SECCIONES_INICIO)[number]["id"];

export type ItemMenu = { id: string; texto?: string; oculto?: boolean };

export type Cintillo = {
  activo: boolean;
  origen: "articulos" | "mensajes";
  /** De 3 a 12 titulares. */
  cantidad: number;
  /** De 1 (lento) a 10 (rápido). */
  velocidad: number;
  etiqueta: string;
  mensajes: string[];
};

export type Emergente = {
  activo: boolean;
  titulo: string;
  texto: string;
  boton: string;
  /** https://… o una ruta del propio sitio (/p/…). */
  enlace: string;
  retardoSeg: number;
  frecuencia: "sesion" | "dia" | "siempre";
  desde: string | null;
  hasta: string | null;
};

export type EstiloNota = {
  tamano?: "S" | "M" | "L";
  /** Tamaño del título en %: 70–200. */
  escalaTitulo?: number;
  negrita?: boolean;
  cursiva?: boolean;
  colorTitulo?: string;
  /** Alto de la imagen en px (recorta); 0/vacío = proporción de la plantilla. */
  imagenAlto?: number;
  sinImagen?: boolean;
  /** Orden manual: las notas con número salen primero, de menor a mayor. */
  fijar?: number;
  oculta?: boolean;
};

export type DisenoPortal = {
  v: 1;
  base: {
    modo: Modo;
    claro: Colores;
    oscuro: Colores;
    fuenteTitulos: FuenteId;
    fuenteTexto: FuenteId;
    /** Escala global del contenido, en %: 80–140. */
    escala: number;
    radio: number | null;
    anchoMax: number | null;
  };
  regiones: Partial<Record<RegionId, EstiloRegion>>;
  menu: ItemMenu[];
  secciones: { orden: SeccionId[]; ocultas: SeccionId[] };
  cintillo: Cintillo;
  emergente: Emergente;
  notas: Record<string, EstiloNota>;
};

export const disenoVacio = (): DisenoPortal => ({
  v: 1,
  base: { modo: "plantilla", claro: {}, oscuro: {}, fuenteTitulos: "plantilla", fuenteTexto: "plantilla", escala: 100, radio: null, anchoMax: null },
  regiones: {},
  menu: [],
  secciones: { orden: SECCIONES_INICIO.map((s) => s.id), ocultas: [] },
  cintillo: { activo: false, origen: "articulos", cantidad: 6, velocidad: 4, etiqueta: "Lo último", mensajes: [] },
  emergente: { activo: false, titulo: "", texto: "", boton: "Conocer más", enlace: "", retardoSeg: 6, frecuencia: "sesion", desde: null, hasta: null },
  notas: {},
});
