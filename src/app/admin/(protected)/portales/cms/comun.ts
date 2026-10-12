import type { AjustesPortal, Anuncio } from "@/lib/portales/cms/tipos";
import type { DatosCms } from "@/components/portales/marco";

/** Ayudas comunes de los paneles del CMS de cada portal (cliente). */

export const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";
export const campo = "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";
export const etiquetaCampo = "mb-1 block text-xs font-semibold text-muted-foreground";
export const botonPrimario = "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition hover:brightness-110 disabled:opacity-50";
export const botonSecundario = "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50";

export async function pedir<T>(url: string, metodo: "GET" | "POST" | "PUT" | "DELETE", cuerpo?: unknown): Promise<T> {
  const r = await fetch(url, { method: metodo, headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined, cache: "no-store" });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error ?? `No fue posible completar la acción (${r.status}).`);
  return b as T;
}

export function hace(iso: string | null) {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "ahora";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

export const numero = (n: number) => n.toLocaleString("es-CO");

export const mensajeDe = (e: unknown, defecto: string) => (e instanceof Error ? e.message : defecto);

/**
 * El «sitio» de un portal para las vistas previas del panel: nada navega y el anuncio que se muestra es el que se le pase.
 * Así lo que se ve al preparar un anuncio o el llamado a sumarse es lo mismo que verá la gente.
 */
export function datosVistaPrevia(ajustes: AjustesPortal, elegidos: DatosCms["elegidos"] = {}): DatosCms {
  return { urlBase: "#", articulos: false, eventos: false, paginas: [], union: ajustes.union, editor: ajustes.editor, hrefUnete: "#", hrefAnuncio: () => "#", elegidos };
}

export type AnuncioBorrador = Pick<Anuncio, "espacio" | "nombre" | "anunciante" | "formato" | "titulo" | "texto" | "boton" | "imagenUrl" | "destinoUrl" | "desde" | "hasta" | "estado" | "prioridad">;

/** De un instante UTC al valor de un campo datetime-local en hora de Colombia (UTC-5, sin horario de verano). */
export const aCampoFecha = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 16) : "");
/** Del campo datetime-local (hora de Colombia) a un instante ISO. */
export const deCampoFecha = (v: string) => (v ? new Date(`${v}:00-05:00`).toISOString() : "");
export const cuandoLargo = (iso: string) => new Date(iso).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
