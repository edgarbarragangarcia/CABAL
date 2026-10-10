import { z } from "zod";

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

export const plantillaSchema = z.enum(["salud", "belleza", "motos-autos", "hogar-cuidado"]);
export const slugSchema = z.string().regex(/^[a-z0-9-]{3,40}$/, "El enlace usa de 3 a 40 letras minúsculas, números o guiones.");

export const configSchema = z.object({
  nombre: texto(2, 80),
  ciudad: z.string().trim().max(60),
  titulo: texto(3, 120),
  eslogan: texto(3, 260),
  cta: texto(2, 40),
  colorPrimario: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido."),
  whatsapp: z.string().trim().regex(/^(\d{10,15})?$/, "Solo números con el indicativo (por ejemplo 573001234567)."),
  correo: z.union([z.literal(""), z.string().trim().toLowerCase().email("Correo no válido.").max(120)]),
  secciones: z.object({ servicios: z.boolean(), pasos: z.boolean(), proveedores: z.boolean(), testimonios: z.boolean(), preguntas: z.boolean(), contacto: z.boolean() }),
});

export const crearSchema = z.object({ nombre: texto(2, 80), slug: slugSchema, plantilla: plantillaSchema, config: configSchema });

export const cambioSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("guardar"), nombre: texto(2, 80).optional(), slug: slugSchema.optional(), config: configSchema.optional() }),
  z.object({ accion: z.enum(["desplegar", "pausar", "reanudar", "duplicar"]) }),
]);
