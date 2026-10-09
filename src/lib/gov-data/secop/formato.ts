/** Cifras y fechas en español de Colombia. Funciones puras (las usan el servidor y el panel). */

const entero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const un = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const dos = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

/** 1234567 → «$ 1.234.567». */
export const pesos = (n: number) => `$ ${entero.format(Math.round(n))}`;

/** Para tarjetas: «$ 3,4 mil millones», «$ 850 millones», «$ 1,2 billones». */
export function pesosCorto(n: number): string {
  const v = Math.abs(n);
  if (v >= 1e12) return `$ ${dos.format(n / 1e12)} ${v >= 2e12 ? "billones" : "billón"}`;
  if (v >= 1e9) return `$ ${un.format(n / 1e9)} mil millones`;
  if (v >= 1e6) return `$ ${entero.format(n / 1e6)} millones`;
  return pesos(n);
}

/** «2026-01-20» → «20 ene 2026». */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00-05:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).replace(/\./g, "");
}

/** Hoy en Colombia (YYYY-MM-DD). */
export const hoyCO = (ahora: Date = new Date()) => ahora.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

/** Resta meses a una fecha YYYY-MM-DD. */
export function restarMeses(iso: string, meses: number): string {
  const d = new Date(`${iso}T12:00:00-05:00`);
  d.setMonth(d.getMonth() - meses);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
