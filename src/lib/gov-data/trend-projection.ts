export type TrendPoint = { year: number; total: number };

/**
 * Extrapola una serie histórica con una regresión lineal simple
 * (mínimos cuadrados). Es una proyección puramente estadística de la
 * tendencia pasada — NO es un pronóstico oficial, no incorpora
 * variables externas (política, economía, eventos) y no debe
 * interpretarse como el efecto de ninguna decisión de gobierno.
 */
export function projectLinearTrend(data: TrendPoint[], yearsAhead: number): TrendPoint[] {
  if (data.length < 2) return [];

  const n = data.length;
  const meanX = data.reduce((sum, d) => sum + d.year, 0) / n;
  const meanY = data.reduce((sum, d) => sum + d.total, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (const d of data) {
    numerator += (d.year - meanX) * (d.total - meanY);
    denominator += (d.year - meanX) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  const lastYear = data[data.length - 1].year;
  const projected: TrendPoint[] = [];
  for (let i = 1; i <= yearsAhead; i++) {
    const year = lastYear + i;
    const total = Math.max(0, Math.round(slope * year + intercept));
    projected.push({ year, total });
  }
  return projected;
}
