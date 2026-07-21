"use client";

import * as React from "react";
import { motion } from "framer-motion";

type TrendPoint = { year: number; total: number };

const CHART_WIDTH = 600;
const CHART_HEIGHT = 160;
const PADDING = { top: 12, right: 12, bottom: 24, left: 12 };

/**
 * Gráfica de línea (SVG plano, sin librería externa) para la tendencia
 * nacional de homicidios año a año. Complementa el mapa: el mapa compara
 * departamentos en un momento dado, esta gráfica muestra la evolución
 * del país en el tiempo.
 */
export function NationalTrendChart({ data }: { data: TrendPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const values = data.map((d) => d.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = PADDING.left + (i / (data.length - 1 || 1)) * innerWidth;
    const y = PADDING.top + innerHeight - ((d.total - min) / range) * innerHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${PADDING.top + innerHeight} L${points[0]?.x ?? 0},${PADDING.top + innerHeight} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label="Tendencia nacional de homicidios por año"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--destructive)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--destructive)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#trend-fill)" />
        <motion.path
          d={linePath}
          fill="none"
          stroke="var(--destructive)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />

        {points.map((p, i) => (
          <g key={p.year}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 5 : 3}
              fill="var(--surface)"
              stroke="var(--destructive)"
              strokeWidth={2}
              className="cursor-pointer transition-[r] duration-150"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
            <text
              x={p.x}
              y={CHART_HEIGHT - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {p.year}
            </text>
          </g>
        ))}
      </svg>

      {hoveredIndex !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg border border-border bg-foreground px-2.5 py-1.5 text-xs text-background shadow-xl"
          style={{
            left: `${(points[hoveredIndex].x / CHART_WIDTH) * 100}%`,
            top: `${(points[hoveredIndex].y / CHART_HEIGHT) * 100}%`,
          }}
        >
          <span className="font-semibold">{points[hoveredIndex].year}</span>:{" "}
          {points[hoveredIndex].total.toLocaleString("es-CO")} casos
        </div>
      )}
    </div>
  );
}
