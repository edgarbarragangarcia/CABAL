import { z } from "zod";

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

function mayorDeEdad(f: string) {
  const d = new Date(`${f}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - d.getUTCFullYear();
  if (hoy.getUTCMonth() < d.getUTCMonth() || (hoy.getUTCMonth() === d.getUTCMonth() && hoy.getUTCDate() < d.getUTCDate())) edad--;
  return edad >= 18 && edad <= 110;
}

export const registroSchema = z.object({
  nombres: texto(2, 80),
  apellidos: texto(2, 80),
  cedula: z.string().trim().regex(/^\d{5,10}$/, "Escribe la cédula solo con números."),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida.").refine(mayorDeEdad, "Debes ser mayor de edad para afiliarte."),
  email: z.string().trim().toLowerCase().email("Correo no válido.").max(120),
  telefono: z.string().trim().regex(/^3\d{9}$/, "Celular de 10 dígitos que empiece por 3."),
  departamento: texto(2, 60),
  municipio: texto(2, 80),
  barrio: texto(2, 80),
  direccion: texto(5, 160),
  password: z.string().min(8, "Mínimo 8 caracteres.").max(72),
  consentimiento: z.literal(true, { error: "Debes autorizar el tratamiento de tus datos." }),
  website: z.string().optional(), // trampa para bots
});
export type Registro = z.infer<typeof registroSchema>;

export const loginSchema = z.object({ acceso: texto(3, 120), password: z.string().min(1).max(72) });
export const publicarSchema = z.object({ texto: texto(1, 2000), grupo: z.string().max(80).optional() });
export const comentarSchema = z.object({ publicacionId: z.string().uuid(), texto: texto(1, 500) });
export const perfilSchema = z.object({ bio: z.string().trim().max(280) });
