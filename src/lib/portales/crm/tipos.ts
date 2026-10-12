import { z } from "zod";

/**
 * Tipos y validaciones del CRM de cada portal: su gente (contactos con etapa, historial y consentimiento) y su agenda de eventos
 * con inscripciones. Sin servidor: los usan el panel y las páginas públicas.
 */

// -------------------------------------------------------------- contactos ---

export const ETAPAS = [
  { id: "nuevo", nombre: "Nuevo", ayuda: "Acaba de llegar: todavía no se le ha escrito ni ha participado." },
  { id: "interesado", nombre: "Interesado", ayuda: "Respondió, abrió conversación o se inscribió a algo." },
  { id: "activo", nombre: "Activo", ayuda: "Participa: asiste a eventos o colabora con el portal." },
  { id: "lider", nombre: "Líder", ayuda: "Convoca, organiza o representa a su comunidad." },
  { id: "inactivo", nombre: "Inactivo", ayuda: "Dejó de participar o pidió no ser contactado." },
] as const;
export type Etapa = (typeof ETAPAS)[number]["id"];
export const IDS_ETAPA = ETAPAS.map((e) => e.id) as [Etapa, ...Etapa[]];

export const ORIGENES = [
  { id: "formulario", nombre: "Formulario del portal" },
  { id: "evento", nombre: "Inscripción a un evento" },
  { id: "articulo", nombre: "Desde un artículo" },
  { id: "afiliacion", nombre: "Afiliación a la comunidad" },
  { id: "importado", nombre: "Importado" },
  { id: "manual", nombre: "Agregado a mano" },
] as const;
export type Origen = (typeof ORIGENES)[number]["id"];
export const IDS_ORIGEN = ORIGENES.map((o) => o.id) as [Origen, ...Origen[]];

export const TIPOS_INTERACCION = [
  { id: "nota", nombre: "Nota" },
  { id: "llamada", nombre: "Llamada" },
  { id: "mensaje", nombre: "Mensaje" },
  { id: "reunion", nombre: "Reunión" },
] as const;
export type TipoInteraccion = "nota" | "llamada" | "mensaje" | "reunion" | "etapa" | "evento" | "sistema";

export type Contacto = {
  id: string;
  portalId: string;
  nombre: string;
  email: string | null;
  telefono: string;
  ciudad: string;
  departamento: string;
  intereses: string[];
  etiquetas: string[];
  etapa: Etapa;
  origen: Origen;
  aceptaComunicaciones: boolean;
  consentimientoEn: string | null;
  notas: string;
  ultimoContacto: string | null;
  /** La persona también es afiliada a la comunidad de María Fernanda Cabal. */
  esAfiliado: boolean;
  creadoEn: string;
  actualizadoEn: string;
};

export type Interaccion = { id: string; contactoId: string; tipo: TipoInteraccion; texto: string; autor: string; creadoEn: string };

const t = (min: number, max: number) => z.string().trim().min(min).max(max);
const correo = z.string().trim().toLowerCase().email("Correo no válido.").max(160);
const telefono = z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/, "El teléfono solo lleva números, espacios, + o guiones.");
const lista = (max: number, largo = 40) => z.array(z.string().trim().min(1).max(largo)).max(max);

/** Lo que edita el equipo del portal (a mano, desde el panel). */
export const contactoSchema = z
  .object({
    nombre: t(2, 120),
    email: z.union([z.literal(""), correo]).default(""),
    telefono: telefono.default(""),
    ciudad: z.string().trim().max(80).default(""),
    departamento: z.string().trim().max(80).default(""),
    intereses: lista(12).default([]),
    etiquetas: lista(12).default([]),
    etapa: z.enum(IDS_ETAPA).default("nuevo"),
    origen: z.enum(IDS_ORIGEN).default("manual"),
    aceptaComunicaciones: z.boolean().default(false),
    notas: z.string().trim().max(2000).default(""),
  })
  .refine((c) => c.email !== "" || c.telefono.replace(/\D/g, "").length >= 7, { message: "Falta un correo o un teléfono para poder ubicar a la persona.", path: ["email"] });
export type DatosContacto = z.infer<typeof contactoSchema>;

/** Lo que manda una persona desde el sitio público: sin etapa ni origen (los pone el servidor) y con consentimiento obligatorio. */
export const suscripcionSchema = z.object({
  nombre: t(2, 120),
  email: correo,
  telefono: telefono.default(""),
  ciudad: z.string().trim().max(80).default(""),
  intereses: lista(8).default([]),
  /** Autorización expresa para tratar sus datos y contactarla (habeas data). */
  acepta: z.literal(true, { error: "Para sumarte necesitamos tu autorización para tratar tus datos." }),
  /** Campo trampa: las personas no lo ven ni lo llenan; los programas automáticos sí. */
  web: z.string().max(0).optional(),
  desde: z.enum(["formulario", "articulo"]).default("formulario"),
});
export type DatosSuscripcion = z.infer<typeof suscripcionSchema>;

export const interaccionSchema = z.object({ tipo: z.enum(["nota", "llamada", "mensaje", "reunion"]), texto: t(1, 2000) });

/** Cambios masivos sobre varios contactos a la vez. */
export const masivoSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  etapa: z.enum(IDS_ETAPA).optional(),
  agregarEtiquetas: lista(8).optional(),
  eliminar: z.boolean().optional(),
});

export const importacionSchema = z.object({
  filas: z.array(z.object({ nombre: z.string().max(120), email: z.string().max(160).default(""), telefono: z.string().max(30).default(""), ciudad: z.string().max(80).default(""), etiquetas: z.string().max(200).default("") })).min(1).max(1000),
  /** La persona que sube la lista confirma que tiene autorización de cada contacto para escribirle. */
  confirmaAutorizacion: z.literal(true, { error: "Confirma que tienes autorización de estas personas." }),
});

export type FiltroContactos = { q?: string; etapa?: Etapa; origen?: Origen; etiqueta?: string; ciudad?: string; sinConsentimiento?: boolean; pagina?: number; porPagina?: number };

export type ResumenCrm = {
  total: number;
  nuevos30d: number;
  conConsentimiento: number;
  porEtapa: Record<Etapa, number>;
  porOrigen: { origen: Origen; n: number }[];
  ciudades: { ciudad: string; n: number }[];
  afiliados: number;
};

export const resumenCrmVacio: ResumenCrm = {
  total: 0,
  nuevos30d: 0,
  conConsentimiento: 0,
  porEtapa: { nuevo: 0, interesado: 0, activo: 0, lider: 0, inactivo: 0 },
  porOrigen: [],
  ciudades: [],
  afiliados: 0,
};

// ----------------------------------------------------------------- eventos ---

export const MODALIDADES = ["presencial", "virtual", "mixta"] as const;
export const ESTADOS_EVENTO = ["borrador", "publicado", "cancelado"] as const;
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number];
export const ESTADOS_INSCRIPCION = ["inscrito", "asistio", "no_asistio", "cancelado"] as const;
export type EstadoInscripcion = (typeof ESTADOS_INSCRIPCION)[number];

export type Evento = {
  id: string;
  portalId: string;
  slug: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  iniciaEn: string;
  terminaEn: string | null;
  modalidad: (typeof MODALIDADES)[number];
  lugar: string;
  ciudad: string;
  enlaceVirtual: string;
  cupo: number | null;
  estado: EstadoEvento;
  /** Inscritos que no cancelaron (para el cupo). */
  inscritos: number;
  asistentes: number;
  creadoEn: string;
};

const fechaHora = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Fecha u hora no válida.");

export const eventoSchema = z
  .object({
    titulo: t(3, 160),
    descripcion: z.string().trim().max(5000).default(""),
    categoria: z.string().trim().max(40).default(""),
    iniciaEn: fechaHora,
    terminaEn: z.union([z.literal(""), fechaHora]).default(""),
    modalidad: z.enum(MODALIDADES).default("presencial"),
    lugar: z.string().trim().max(160).default(""),
    ciudad: z.string().trim().max(80).default(""),
    enlaceVirtual: z.union([z.literal(""), z.string().trim().max(500).refine((u) => /^https?:\/\/[^\s]+$/i.test(u), "Escribe un enlace completo que empiece por http:// o https://.")]).default(""),
    cupo: z.number().int().min(1).max(100000).nullable().default(null),
    estado: z.enum(ESTADOS_EVENTO).default("borrador"),
    slug: z.string().regex(/^[a-z0-9-]{3,90}$/, "El enlace usa de 3 a 90 letras minúsculas, números o guiones.").optional(),
  })
  .superRefine((e, ctx) => {
    if (e.terminaEn && Date.parse(e.terminaEn) < Date.parse(e.iniciaEn)) ctx.addIssue({ code: "custom", path: ["terminaEn"], message: "El evento no puede terminar antes de empezar." });
    if (e.estado === "publicado" && e.modalidad !== "virtual" && !e.lugar) ctx.addIssue({ code: "custom", path: ["lugar"], message: "Para publicar un evento presencial escribe dónde será." });
    if (e.estado === "publicado" && e.modalidad !== "presencial" && !e.enlaceVirtual) ctx.addIssue({ code: "custom", path: ["enlaceVirtual"], message: "Para publicar un evento virtual agrega el enlace de la sala." });
  });
export type DatosEvento = z.infer<typeof eventoSchema>;

export type Inscripcion = {
  contactoId: string;
  nombre: string;
  email: string | null;
  telefono: string;
  estado: EstadoInscripcion;
  creadoEn: string;
};

/** Lo que manda una persona para inscribirse a un evento desde el sitio público. */
export const inscripcionSchema = suscripcionSchema.omit({ desde: true, intereses: true });
export type DatosInscripcion = z.infer<typeof inscripcionSchema>;
