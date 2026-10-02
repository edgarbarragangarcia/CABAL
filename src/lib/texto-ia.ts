/**
 * Los modelos a veces devuelven un objeto ({"riesgo": "...", "detalle": "..."})
 * donde se pidió un texto. `String(obj)` da "[object Object]": aquí se aplana
 * a texto legible, uniendo sus valores.
 */
export function aTexto(x: unknown): string {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x.trim();
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (Array.isArray(x)) return x.map(aTexto).filter(Boolean).join("; ");
  if (typeof x === "object") {
    return Object.values(x as Record<string, unknown>)
      .map(aTexto)
      .filter(Boolean)
      .join(" — ");
  }
  return "";
}

/** Lista de textos: cada elemento (aunque venga como objeto) pasa por `aTexto`. */
export function aLista(x: unknown): string[] {
  if (Array.isArray(x)) return x.map(aTexto).filter(Boolean);
  const uno = aTexto(x);
  return uno ? [uno] : [];
}
