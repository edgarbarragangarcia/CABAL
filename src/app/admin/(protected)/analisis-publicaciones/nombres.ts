/** Palabras que van en minúscula dentro de un nombre propio. */
const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "el", "y", "e", "por", "en", "con", "para", "a", "al"]);
const SIGLAS = new Set([
  "MIRA", "AICO", "MAIS", "ASI", "PIC", "ADA", "GSC", "CITREP", "ONIC", "MOIR", "UP", "II", "III", "IV",
  // Contratación pública: entidades y sufijos societarios que se escriben en mayúsculas.
  "SAS", "SA", "ESP", "ESE", "LTDA", "SENA", "ICA", "DIAN", "DANE", "ICBF", "INVIAS", "ANI", "UNGRD", "ETB", "EPM", "IDU", "DNP",
  "ESAP", "UT", "IPS", "EPS", "USPEC", "INPEC", "UARIV", "DPS", "MINTIC", "MINSALUD", "IED", "FDL", "SDA", "TIC", "ICFES", "UAESP", "IDRD",
]);

/** "IVÁN CEPEDA CASTRO" → "Iván Cepeda Castro"; siglas ("MIRA", "P.I.C", "D.C.") se conservan. */
export function titulo(s: string) {
  return s
    .split(" ")
    .map((token, i) => {
      const [, pre, core, post] = token.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u) ?? ["", "", token, ""];
      if (!core || core.includes(".") || SIGLAS.has(core.toUpperCase())) return token;
      const w = core.toLowerCase();
      const out = i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1);
      return pre + out + post;
    })
    .join(" ");
}
