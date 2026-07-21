/**
 * Cliente mínimo para la API SODA (Socrata Open Data API) que expone
 * datos.gov.co, el portal oficial de datos abiertos del Estado colombiano.
 * Todas las cifras del Observatorio provienen de esta API en tiempo real —
 * no hay datos hardcodeados ni de ejemplo.
 *
 * Docs: https://dev.socrata.com/docs/queries/
 */

const DATOS_GOV_CO_BASE = "https://www.datos.gov.co/resource";

/** Un token de aplicación evita el throttling agresivo del límite anónimo. */
const APP_TOKEN = process.env.SOCRATA_APP_TOKEN;

export type SoqlParams = {
  $select?: string;
  $where?: string;
  $group?: string;
  $order?: string;
  $limit?: number;
};

/**
 * Ejecuta una consulta SoQL contra un dataset de datos.gov.co.
 * Cachea la respuesta 1 hora en el lado del servidor (Next.js `fetch`
 * cache) para no exceder los límites de la API pública en cada request.
 */
export async function querySocrataDataset<T>(
  datasetId: string,
  params: SoqlParams
): Promise<T[]> {
  const url = new URL(`${DATOS_GOV_CO_BASE}/${datasetId}.json`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    headers: APP_TOKEN ? { "X-App-Token": APP_TOKEN } : undefined,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(
      `datos.gov.co (${datasetId}) respondió ${res.status}: ${await res.text()}`
    );
  }

  return res.json();
}

/** Normaliza un código DIVIPOLA de departamento a 2 dígitos (p. ej. "5" -> "05"). */
export function normalizeDeptCode(code: string): string {
  return code.trim().padStart(2, "0");
}
