import "server-only";

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { respuestaError } from "../respuesta";

/** Ayudas comunes de las rutas del administrador del CMS de portales. `/api/admin/*` ya exige la sesión del panel (src/proxy.ts). */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idNoValido = () => NextResponse.json({ error: "Identificador no válido." }, { status: 400 });

const CAMPOS: Record<string, string> = {
  titulo: "el título", resumen: "el resumen", cuerpo: "el texto", categoria: "la categoría", tipo: "el tipo", etiquetas: "las etiquetas",
  autor: "el autor", seoDescripcion: "la descripción para buscadores", slug: "el enlace", nombre: "el nombre", anunciante: "el anunciante",
  texto: "el texto", boton: "el botón", imagenUrl: "la imagen", destinoUrl: "el enlace de destino", prioridad: "la prioridad",
  espacio: "el espacio", editor: "el editor", titulo_union: "el título", tema: "el tema", datos: "los datos",
};

/** El primer problema de un formulario en palabras de la persona, no del validador. */
export function mensajeValidacion(e: ZodError): string {
  const i = e.issues[0];
  if (!i) return "Datos no válidos.";
  if (i.code === "custom" || /[áéíóúñ¿«]/i.test(i.message) || /^(Escribe|Pega|Color|Fecha|El |La |Solo )/.test(i.message)) return i.message;
  const campo = CAMPOS[String(i.path.at(-1) ?? "")] ?? "uno de los datos";
  if (i.code === "too_small") return `Revisa ${campo}: es muy corto o está vacío.`;
  if (i.code === "too_big") return `Revisa ${campo}: es demasiado largo.`;
  return `Revisa ${campo}.`;
}

export const sinCuerpo = () => NextResponse.json({ error: "Faltan los datos." }, { status: 400 });

export { respuestaError };
