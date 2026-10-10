/**
 * Interpreta el texto que el OCR sacó de la foto de una cédula colombiana: número, apellidos, nombres y fecha de
 * nacimiento. Es tolerante a los errores típicos del OCR (letras por dígitos, puntos por comas). Siempre es una ayuda:
 * la persona revisa y corrige lo que se rellena.
 */
export type DatosCedula = { cedula: string; apellidos: string; nombres: string; fechaNacimiento: string | null };

const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const MESES: Record<string, string> = { ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06", JUL: "07", AGO: "08", SEP: "09", SET: "09", OCT: "10", NOV: "11", DIC: "12" };
const ETIQUETAS = /^(APELLIDOS?|NOMBRES?|NUMERO|FECHA|LUGAR|ESTATURA|G\.?\s?S|SEXO|NACIMIENTO|EXPEDICION|FIRMA|INDICE|REPUBLICA|REGISTRADURIA|CEDULA|IDENTIFICACION|COLOMBIA)/;

/** Letras que el OCR suele confundir con dígitos, dentro de un tramo que ya parece un número. */
const aDigitos = (s: string) => s.replace(/[OQD]/g, "0").replace(/[IL|!]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/Z/g, "2");

function buscarNumero(lineas: string[]): string {
  const candidatos: { num: string; peso: number }[] = [];
  lineas.forEach((l, i) => {
    const eraNumero = /NUMERO|\bNUM\b|\bNO\.?\s/.test(l) || /NUMERO/.test(lineas[i - 1] ?? "");
    const fecha = /FECHA|NACIMIENTO|EXPEDICION|\b(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\b/.test(l);
    // Con puntos o comas de miles («1.234.567.890»), o corrido («1234567890»); los tramos con letras confundibles se corrigen.
    for (const m of aDigitos(l).matchAll(/\d{1,3}(?:[.,\s]\d{3}){1,3}|\d{6,10}/g)) {
      const solo = m[0].replace(/\D/g, "").replace(/^0+/, "");
      if (solo.length < 6 || solo.length > 10) continue;
      candidatos.push({ num: solo, peso: (eraNumero ? 4 : 0) + (/[.,]/.test(m[0]) ? 2 : 0) + (solo.length >= 8 ? 1 : 0) - (fecha ? 4 : 0) });
    }
  });
  return candidatos.sort((a, b) => b.peso - a.peso)[0]?.num ?? "";
}

/** Líneas que siguen a una etiqueta («APELLIDOS») hasta la siguiente etiqueta; solo letras. */
function bloque(lineas: string[], etiqueta: RegExp, hasta: RegExp): string {
  const i = lineas.findIndex((l) => etiqueta.test(l));
  if (i < 0) return "";
  const partes: string[] = [];
  const resto = lineas[i].replace(etiqueta, "").replace(/[^A-ZÑ ]/g, " ").replace(/\s+/g, " ").trim();
  if (resto.length >= 3) partes.push(resto);
  for (let k = i + 1; k < lineas.length && partes.length < 2; k++) {
    if (hasta.test(lineas[k]) || ETIQUETAS.test(lineas[k])) break;
    const t = lineas[k].replace(/[^A-ZÑ ]/g, " ").replace(/\s+/g, " ").trim();
    if (t.length >= 3 && /[AEIOU]/.test(t)) partes.push(t);
  }
  return partes.join(" ").trim();
}

const capitalizar = (s: string) => s.toLowerCase().replace(/(^|\s)([a-zñ])/g, (_, a, b) => a + b.toUpperCase());

export function interpretarTextoCedula(texto: string): DatosCedula | null {
  const lineas = texto.split(/\r?\n/).map((l) => plano(l).replace(/\s+/g, " ").trim()).filter(Boolean);
  const cedula = buscarNumero(lineas);
  if (!cedula) return null;

  const apellidos = bloque(lineas, /^APELLIDOS?\b/, /^NOMBRES?\b/);
  const nombres = bloque(lineas, /^NOMBRES?\b/, /^(FECHA|LUGAR|ESTATURA|G\.?\s?S|SEXO|NACIMIENTO|FIRMA|INDICE)/);

  let fechaNacimiento: string | null = null;
  for (const l of lineas) {
    const m = l.match(/(\d{2})[\s.\-/]*([A-Z]{3})[A-Z]*[\s.\-/]*((?:19|20)\d{2})/);
    if (m && MESES[m[2]]) {
      fechaNacimiento = `${m[3]}-${MESES[m[2]]}-${m[1]}`;
      if (/NACIMIENTO/.test(l) || /NACIMIENTO/.test(lineas[lineas.indexOf(l) - 1] ?? "")) break; // la de «Fecha de nacimiento» manda sobre la de expedición
    }
  }
  return { cedula, apellidos: capitalizar(apellidos), nombres: capitalizar(nombres), fechaNacimiento };
}
