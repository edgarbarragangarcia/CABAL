"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { GOVERNMENT_PERIODS, type TrendSeries } from "./types";

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const PADDING = { top: 12, right: 12, bottom: 24, left: 12 };

/**
 * Gráfica de líneas (SVG plano, sin librería externa) que permite
 * superponer varias series (p. ej. homicidios y hurtos) sobre la misma
 * línea de tiempo, con bandas de color por periodo presidencial para
 * poder comparar el comportamiento de cada indicador por gobierno.
 */
export function NationalTrendChart({ series }: { series: TrendSeries[] }) {
  const [visibleIds, setVisibleIds] = React.useState<Set<string>>(
    () => new Set(series.map((s) => s.id))
  );
  const [hovered, setHovered] = React.useState<{ seriesId: string; index: number } | null>(
    null
  );

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const allYears = series[0]?.data.map((d) => d.year) ?? [];
  const minYear = Math.min(...allYears);
  const maxYear = Math.max(...allYears);

  const visibleSeries = series.filter((s) => visibleIds.has(s.id));
  const allValues = visibleSeries.flatMap((s) => s.data.map((d) => d.total));
  const min = allValues.length ? Math.min(...allValues, 0) : 0;
  const max = allValues.length ? Math.max(...allValues, 1) : 1;
  const range = max - min || 1;

  const yearToX = (year: number) =>
    PADDING.left + ((year - minYear) / (maxYear - minYear || 1)) * innerWidth;
  const valueToY = (value: number) =>
    PADDING.top + innerHeight - ((value - min) / range) * innerHeight;

  const seriesPoints = series.map((s) => ({
    ...s,
    points: s.data.map((d) => ({ x: yearToX(d.year), y: valueToY(d.total), ...d })),
  }));

  const activePeriods = GOVERNMENT_PERIODS.filter(
    (p) => p.endYear >= minYear && p.startYear <= maxYear
  );

  function toggleSeries(id: string) {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id) && next.size > 1) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      {/* Selector de series: permite superponer/ocultar indicadores */}
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {series.map((s) => {
            const isVisible = visibleIds.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSeries(s.id)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity"
                style={{
                  borderColor: s.color,
                  opacity: isVisible ? 1 : 0.4,
                }}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Tendencia nacional por año, con periodos presidenciales"
          preserveAspectRatio="none"
        >
          {/* Bandas de gobierno */}
          {activePeriods.map((p) => {
            const x1 = yearToX(Math.max(p.startYear, minYear));
            const x2 = yearToX(Math.min(p.endYear, maxYear));
            return (
              <rect
                key={p.label}
                x={x1}
                y={PADDING.top}
                width={Math.max(x2 - x1, 0)}
                height={innerHeight}
                fill={p.color}
                opacity={0.07}
              />
            );
          })}

          {seriesPoints.map((s) => {
            if (!visibleIds.has(s.id)) return null;
            const linePath = s.points
              .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
              .join(" ");
            return (
              <g key={s.id}>
                <motion.path
                  d={linePath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                />
                {s.points.map((p, i) => (
                  <circle
                    key={p.year}
                    cx={p.x}
                    cy={p.y}
                    r={hovered?.seriesId === s.id && hovered.index === i ? 5 : 3}
                    fill="var(--surface)"
                    stroke={s.color}
                    strokeWidth={2}
                    className="cursor-pointer transition-[r] duration-150"
                    onMouseEnter={() => setHovered({ seriesId: s.id, index: i })}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </g>
            );
          })}

          {(seriesPoints[0]?.points ?? []).map((p) => (
            <text
              key={p.year}
              x={p.x}
              y={CHART_HEIGHT - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {p.year}
            </text>
          ))}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg border border-border bg-foreground px-2.5 py-1.5 text-xs text-background shadow-xl"
            style={{
              left: `${(seriesPoints.find((s) => s.id === hovered.seriesId)!.points[hovered.index].x / CHART_WIDTH) * 100}%`,
              top: `${(seriesPoints.find((s) => s.id === hovered.seriesId)!.points[hovered.index].y / CHART_HEIGHT) * 100}%`,
            }}
          >
            <span className="font-semibold">
              {seriesPoints.find((s) => s.id === hovered.seriesId)!.points[hovered.index].year}
            </span>{" "}
            · {seriesPoints.find((s) => s.id === hovered.seriesId)!.label}:{" "}
            {seriesPoints
              .find((s) => s.id === hovered.seriesId)!
              .points[hovered.index].total.toLocaleString("es-CO")}
          </div>
        )}
      </div>

      {/* Leyenda de gobiernos con promedio por periodo de la primera serie visible */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {activePeriods.map((p) => {
          const primary = seriesPoints.find((s) => visibleIds.has(s.id));
          const periodData = primary?.points.filter(
            (pt) => pt.year >= p.startYear && pt.year < p.endYear
          );
          const avg =
            periodData && periodData.length
              ? Math.round(periodData.reduce((sum, d) => sum + d.total, 0) / periodData.length)
              : null;
          return (
            <div key={p.label} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: p.color }}
                aria-hidden="true"
              />
              <span className="font-medium text-foreground">{p.label}</span>
              <span>
                ({p.startYear}–{p.endYear}){avg !== null && `: promedio ${avg.toLocaleString("es-CO")}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
