import "server-only";

import { getAntecedentesDisciplinarios, type AntecedentesDisciplinarios } from "./avales/antecedentes-disciplinarios";
import { getHistorialElectoralNacional, type HistorialElectoral } from "./elecciones/historial-electoral";

type Seccion<T> = { ok: true; data: T } | { ok: false; error: string };

export type AvalesResult = {
  cedula: string;
  nombre: string;
  disciplinario: Seccion<AntecedentesDisciplinarios>;
  electoral: Seccion<HistorialElectoral>;
};

const mensajeError = (err: unknown) => (err instanceof Error ? err.message : "No fue posible consultar esta fuente.");

/**
 * Junta las fuentes automáticas para la ficha de un candidato, salvo la hoja
 * de vida: `HojaDeVidaPanel` (candidato-ui.tsx) ya se consulta sola contra
 * `/api/admin/elecciones/hoja-de-vida`, así que duplicarla aquí solo
 * repetiría la misma consulta al SIGEP dos veces.
 * `allSettled` aísla cada fuente: que una esté caída o lenta no debe ocultar
 * la otra.
 */
export async function getAvalesData(cedula: string, nombre: string): Promise<AvalesResult> {
  const [disciplinario, electoral] = await Promise.allSettled([
    getAntecedentesDisciplinarios(cedula),
    getHistorialElectoralNacional(cedula, nombre),
  ]);

  const seccion = <T>(r: PromiseSettledResult<T>): Seccion<T> =>
    r.status === "fulfilled" ? { ok: true, data: r.value } : { ok: false, error: mensajeError(r.reason) };

  return { cedula, nombre, disciplinario: seccion(disciplinario), electoral: seccion(electoral) };
}
