/** Funciones puras de la biblioteca de medios (sin red): qué es un archivo según sus primeros bytes. */

export const TIPOS_IMAGEN = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as const;
export type TipoImagen = keyof typeof TIPOS_IMAGEN;
/** 4 MB: el límite de una petición en Vercel es 4,5 MB. El panel comprime las fotos grandes antes de subirlas. */
export const MAX_BYTES_IMAGEN = 4 * 1024 * 1024;

const empieza = (b: Uint8Array, firma: number[], desde = 0) => firma.every((v, i) => b[desde + i] === v);

/**
 * El tipo real de la imagen por su firma (no por lo que diga el nombre o el navegador): solo JPEG, PNG, WebP y GIF.
 * El SVG se rechaza a propósito: puede llevar scripts.
 */
export function tipoPorFirma(b: Uint8Array): TipoImagen | null {
  if (b.length < 12) return null;
  if (empieza(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (empieza(b, [0x47, 0x49, 0x46, 0x38]) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return "image/gif";
  if (empieza(b, [0x52, 0x49, 0x46, 0x46]) && empieza(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Un nombre de archivo corto y seguro para mostrar (sin ruta ni caracteres raros). */
export function nombreLimpio(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? "imagen";
  const limpio = base.normalize("NFC").replace(/[\u0000-\u001f<>:"|?*]/g, "").trim();
  return (limpio || "imagen").slice(0, 120);
}

export type Medio = { id: string; portalId: string; nombre: string; url: string; tipo: string; bytes: number; alt: string; subidoPor: string; creadoEn: string };
