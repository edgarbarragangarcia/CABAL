import { nombreValido, type DatosCedula } from "./cedula-ocr";

/**
 * Lee el código de barras (PDF417) del reverso de la cédula de ciudadanía colombiana. El texto decodificado tiene campos
 * de ancho fijo: número en 48-58, apellidos en 58-104, nombres en 104-150 y fecha de nacimiento (AAAAMMDD) en 152-160.
 * Solo se acepta si todo cuadra (letras donde van letras): si no, se devuelve nada antes que datos corridos.
 */
const limpio = (s: string) => s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, " ").replace(/\s+/g, " ").trim();
const mayus = (s: string) => limpio(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const capitalizar = (s: string) => s.toLowerCase().replace(/(^|\s)([a-zñ])/g, (_, a, b) => a + b.toUpperCase());

export function leerCedulaPdf417(raw: string): DatosCedula | null {
  const numero = raw.slice(48, 58).replace(/\D/g, "").replace(/^0+/, "");
  if (numero.length < 5 || numero.length > 10) return null;
  const apellidos = limpio(`${raw.slice(58, 81)} ${raw.slice(81, 104)}`);
  const nombres = limpio(`${raw.slice(104, 127)} ${raw.slice(127, 150)}`);
  if (!nombreValido(mayus(apellidos), 5) || !nombreValido(mayus(nombres), 4)) return null;
  const f = raw.slice(152, 160);
  return { cedula: numero, apellidos: capitalizar(apellidos), nombres: capitalizar(nombres), fechaNacimiento: /^(19|20)\d{6}$/.test(f) ? `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}` : null };
}
