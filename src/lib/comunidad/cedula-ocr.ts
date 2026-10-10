/**
 * Interpreta lo que un OCR sacó de la foto de una cédula colombiana: número, apellidos, nombres y fecha de nacimiento.
 * Una cédula real tiene hologramas y dibujos de fondo que el OCR lee como letras sueltas, así que aquí se prefiere
 * dejar un campo VACÍO a rellenarlo con basura: cada dato se busca por posición (debajo de su etiqueta) y se valida.
 * Siempre es una ayuda: la persona revisa y corrige lo que se rellena.
 */
export type DatosCedula = { cedula: string; apellidos: string; nombres: string; fechaNacimiento: string | null };

/** Una línea de texto con su caja en la imagen (píxeles) y la confianza del OCR (0-100). */
export type LineaOcr = { texto: string; conf: number; x0: number; y0: number; x1: number; y1: number };

const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const MESES: Record<string, string> = { ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06", JUL: "07", AGO: "08", SEP: "09", SET: "09", OCT: "10", NOV: "11", DIC: "12" };
const ETIQUETA = /\b(APELLIDOS?|NOMBRES?|NUMERO|NUIP|FECHA|LUGAR|ESTATURA|SEXO|NACIMIENTO|EXPEDICION|FIRMA|INDICE|REPUBLICA|REGISTRADURIA|CEDULA|CIUDADANIA|IDENTIFICACION|COLOMBIA|PERSONAL|NACIONAL|DERECHO)\b/;
const PARTICULAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y", "SAN", "VAN", "VON", "DA", "DI"]);

/* ------------------------------------------------------------- validación */

function palabraValida(p: string) {
  return /^[A-ZÑ]{2,22}$/.test(p) && /[AEIOUY]/.test(p) && !/[^AEIOUY]{5,}/.test(p) && !/(.)\1{2,}/.test(p);
}

/** ¿Parece de verdad un nombre o apellido? (letras, con vocales, sin rachas imposibles, y no una etiqueta de la cédula) */
export function nombreValido(s: string, maxPalabras: number) {
  const ps = s.split(" ").filter(Boolean);
  if (ps.length === 0 || ps.length > maxPalabras || ETIQUETA.test(s)) return false;
  return ps.some((p) => !PARTICULAS.has(p)) && ps.every((p) => PARTICULAS.has(p) || palabraValida(p));
}

const capitalizar = (s: string) => s.toLowerCase().replace(/(^|\s)([a-zñ])/g, (_, a, b) => a + b.toUpperCase());

/** Solo letras y espacios; lo demás (puntos, rayas del fondo) se descarta. */
const soloLetras = (s: string) => s.replace(/[^A-ZÑ ]/g, " ").replace(/\s+/g, " ").trim();

/** Letras que el OCR confunde con dígitos, dentro de un tramo que ya parece un número. */
const aDigitos = (s: string) => s.replace(/[OQD]/g, "0").replace(/[IL|!]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/Z/g, "2");

function fechaDe(t: string): string | null {
  const m = t.match(/(\d{2})[\s.\-/]*([A-Z]{3})[A-Z]*[\s.\-/]*((?:19|20)\d{2})/);
  return m && MESES[m[2]] ? `${m[3]}-${MESES[m[2]]}-${m[1]}` : null;
}

/** Palabras propias de una cédula (con la raíz, para tolerar errores del OCR): sin al menos dos, la foto no es una cédula. */
const SENALES = [/APELLID/, /NOMBRE/, /CIUDADAN/, /REPUBLIC/, /IDENTIFIC/, /NACIMIEN/, /\bNUMER|NUIP/, /CEDULA|CÉDULA/, /ESTATURA/, /EXPEDIC/, /REGISTRAD/];
export const pareceCedula = (textos: string[]) => SENALES.filter((re) => textos.some((t) => re.test(t))).length >= 2;

/* -------------------------------------------------------- por geometría */

export function interpretarLineas(entrada: LineaOcr[]): DatosCedula | null {
  const L = entrada.map((l) => ({ ...l, t: plano(l.texto).replace(/\s+/g, " ").trim(), alto: l.y1 - l.y0 })).filter((l) => l.t && l.conf >= 35);
  if (L.length === 0 || !pareceCedula(L.map((l) => l.t))) return null;
  const altos = L.map((l) => l.alto).sort((a, b) => a - b);
  const h = altos[Math.floor(altos.length / 2)] || 20; // altura típica de una línea

  /** Líneas de valor bajo una etiqueta: por debajo, alineadas a la izquierda, y antes de otra etiqueta. */
  const bajo = (et: (typeof L)[number], max: number) => {
    const out: typeof L = [];
    let limite = et.y1 + h * 4.5;
    const siguientes = L.filter((l) => l !== et && l.y0 >= et.y0 + h * 0.6).sort((a, b) => a.y0 - b.y0);
    for (const l of siguientes) {
      if (l.y0 > limite) break;
      if (l.x0 < et.x0 - h * 2 || l.x0 > et.x0 + h * 9) continue; // otra columna (la foto, la huella…)
      if (ETIQUETA.test(l.t)) break;
      if (l.conf < 55) continue;
      out.push(l);
      limite = l.y1 + h * 2.2;
      if (out.length >= max) break;
    }
    return out;
  };
  const etiqueta = (re: RegExp) => L.filter((l) => re.test(l.t) && l.t.length <= 48).sort((a, b) => a.y0 - b.y0)[0];

  /* número: el texto más grande con formato de cédula, de preferencia junto a «NÚMERO / NUIP». Debe estar COMPLETO:
     si la línea trae restos pegados («1.098.765 .42>») se descarta antes que entregar un número a medias. */
  const etNum = etiqueta(/\b(NUMERO|NUIP)\b/);
  const candidatos: { num: string; peso: number }[] = [];
  for (const l of L) {
    if (l.conf < 60) continue;
    const fecha = /FECHA|NACIMIENTO|EXPEDICION|\b(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)\b/.test(l.t);
    for (const m of l.t.matchAll(/(?<![A-Z0-9])[0-9OQDIL|!SBZ][0-9OQDIL|!SBZ.,\s]{4,18}[0-9OQDIL|!SBZ](?![A-Z])/g)) {
      if ((m[0].match(/[0-9]/g) ?? []).length < 4) continue; // casi todo letras: no es un número
      const corrida = aDigitos(m[0]).trim();
      if (!/^\d{1,3}(?:[.,\s]\d{3}){1,3}$/.test(corrida) && !/^\d{6,10}$/.test(corrida)) continue;
      const solo = corrida.replace(/\D/g, "").replace(/^0+/, "");
      if (solo.length < 6 || solo.length > 10) continue;
      const cerca = etNum ? Math.abs(l.y0 - etNum.y0) < h * 3 : false;
      candidatos.push({ num: solo, peso: (l.alto / h) * 2 + (/[.,]/.test(corrida) ? 2 : 0) + (solo.length >= 8 ? 1 : 0) + (cerca ? 4 : 0) + (l.conf >= 80 ? 1 : 0) - (fecha ? 6 : 0) });
    }
  }
  candidatos.sort((a, b) => b.peso - a.peso);
  const cedula = candidatos[0] && candidatos[0].peso >= 3 ? candidatos[0].num : "";

  /* apellidos y nombres: debajo de su etiqueta (o a continuación en la misma línea) */
  const campo = (re: RegExp, max: number, palabras: number) => {
    const et = etiqueta(re);
    if (!et) return "";
    const mismo = soloLetras(et.t.replace(/^.*?\b(APELLIDOS?|NOMBRES?)\b/, ""));
    const partes = [...(mismo.length >= 3 ? [mismo] : []), ...bajo(et, max).map((l) => soloLetras(l.t))].filter((p) => p.length >= 2);
    const texto = partes.join(" ").trim();
    return nombreValido(texto, palabras) ? capitalizar(texto) : "";
  };
  const apellidos = campo(/\bAPELLIDOS?\b/, 2, 5);
  const nombres = campo(/\bNOMBRES?\b/, 2, 4);

  /* fecha de nacimiento: en la línea de la etiqueta o en la siguiente */
  let fechaNacimiento: string | null = null;
  const etFecha = etiqueta(/NACIMIENTO/);
  if (etFecha) fechaNacimiento = fechaDe(etFecha.t) ?? bajo(etFecha, 1).map((l) => fechaDe(l.t)).find(Boolean) ?? null;

  // Sin nada fiable no se devuelve nada; con apellidos o nombres válidos se entrega lo que hay y la persona completa el resto.
  if (!cedula && !apellidos && !nombres) return null;
  return { cedula, apellidos, nombres, fechaNacimiento };
}

/* ------------------------------------------------------- solo con texto */

/** Cuando no hay cajas (p. ej. en pruebas): el texto en bruto, línea por línea, con la misma validación estricta. */
export function interpretarTextoCedula(texto: string): DatosCedula | null {
  const lineas = texto.split(/\r?\n/).map((l, i) => ({ texto: l, conf: 90, x0: 0, x1: 100, y0: i * 30, y1: i * 30 + 24 }));
  return interpretarLineas(lineas);
}
