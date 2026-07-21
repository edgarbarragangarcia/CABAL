import { z } from "zod";

/**
 * Schema estricto para el formulario de contacto. Se reutiliza tanto en el
 * cliente (react-hook-form / validación en formulario) como en el servidor
 * (`/api/contacto`), garantizando una única fuente de verdad.
 */
export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(80, "El nombre es demasiado largo.")
    .regex(/^[\p{L}\s'.-]+$/u, "El nombre contiene caracteres no válidos."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Ingresa un correo electrónico válido.")
    .max(254),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{7,20}$/, "Ingresa un número de teléfono válido.")
    .optional()
    .or(z.literal("")),
  subject: z
    .string()
    .trim()
    .min(3, "El asunto debe tener al menos 3 caracteres.")
    .max(120, "El asunto es demasiado largo."),
  message: z
    .string()
    .trim()
    .min(10, "El mensaje debe tener al menos 10 caracteres.")
    .max(2000, "El mensaje es demasiado largo."),
  // Honeypot invisible: los bots suelen rellenar todos los campos.
  website: z.string().max(0, "Solicitud rechazada.").optional().or(z.literal("")),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresa un correo electrónico válido."),
  website: z.string().max(0).optional().or(z.literal("")),
});

export type NewsletterValues = z.infer<typeof newsletterSchema>;
