/**
 * Lee el código de barras (PDF417) de la cédula de ciudadanía colombiana. El texto decodificado tiene campos de
 * ancho fijo: número en 48-58, apellidos en 58-104, nombres en 104-150 y fecha de nacimiento (AAAAMMDD) en 152-160.
 * Es una lectura de ayuda: la persona siempre revisa y corrige lo que se rellena.
 */
export type DatosCedula = { cedula: string; apellidos: string; nombres: string; fechaNacimiento: string | null };

const limpio = (s: string) => s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, " ").replace(/\s+/g, " ").trim();

export function leerCedulaPdf417(raw: string): DatosCedula | null {
  const numero = raw.slice(48, 58).replace(/\D/g, "").replace(/^0+/, "");
  if (numero.length >= 5 && numero.length <= 10) {
    const apellidos = limpio(`${raw.slice(58, 81)} ${raw.slice(81, 104)}`);
    const nombres = limpio(`${raw.slice(104, 127)} ${raw.slice(127, 150)}`);
    const f = raw.slice(152, 160);
    if (apellidos && nombres) {
      return { cedula: numero, apellidos, nombres, fechaNacimiento: /^(19|20)\d{6}$/.test(f) ? `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}` : null };
    }
  }
  // Respaldo: un número largo seguido de texto en mayúsculas. Solo se rescata la cédula; lo demás lo escribe la persona.
  const m = raw.match(/0*(\d{6,10})\s*[A-ZÁÉÍÓÚÑ]{3,}/);
  return m ? { cedula: m[1], apellidos: "", nombres: "", fechaNacimiento: null } : null;
}
