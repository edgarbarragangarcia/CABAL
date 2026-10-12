import type { Evento } from "./tipos";

/** Funciones puras del CRM y la agenda (sin red ni React). */

const GRACIA_MS = 3 * 3_600_000;

/** Un evento ya terminó si pasaron más de tres horas de su final (o de su inicio, si no tiene final). */
export function eventoTerminado(e: Pick<Evento, "iniciaEn" | "terminaEn">, ahora = Date.now()): boolean {
  return Date.parse(e.terminaEn ?? e.iniciaEn) < ahora - GRACIA_MS;
}

/** Próximos (publicados y sin terminar, el más cercano primero) y pasados o cancelados (el más reciente primero). */
export function separarEventos(eventos: Evento[], ahora = Date.now()): { proximos: Evento[]; pasados: Evento[] } {
  const proximos = eventos.filter((e) => e.estado === "publicado" && !eventoTerminado(e, ahora)).sort((a, b) => a.iniciaEn.localeCompare(b.iniciaEn));
  const pasados = eventos.filter((e) => e.estado === "cancelado" || eventoTerminado(e, ahora)).sort((a, b) => b.iniciaEn.localeCompare(a.iniciaEn));
  return { proximos, pasados };
}
