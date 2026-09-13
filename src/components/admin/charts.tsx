"use client";

import * as React from "react";

/** Área + línea, sin librerías — SVG a mano, escalado por viewBox. */
export function TrendArea({
  data,
  width = 640,
  height = 160,
  color = "#22c58a",
}: {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const pad = 8;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (data.length - 1 || 1);

  const points = data.map((d, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (d.value - min) / range);
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0]},${height - pad} L${points[0][0]},${height - pad} Z`;

  const gradId = React.useId();

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-40 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Tendencia de menciones en los últimos 30 días"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Donut simple a partir de porcentajes que suman ~100. */
export function DonutChart({
  slices,
  size = 128,
  thickness = 16,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  // Offset acumulado de cada porción, calculado sin mutar nada en el render.
  const withOffsets = slices.reduce<{ offset: number; len: number; slice: (typeof slices)[number] }[]>(
    (acc, s) => {
      const len = (s.value / total) * c;
      const prevOffset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].len : 0;
      return [...acc, { offset: prevOffset, len, slice: s }];
    },
    []
  );

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribución">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-border" strokeWidth={thickness} />
          {withOffsets.map(({ offset, len, slice: s }) => (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          ))}
        </g>
      </svg>
      <ul className="space-y-1.5 text-xs">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium text-foreground">{s.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lista de barras horizontales proporcionales al máximo. */
export function BarList({
  items,
  color = "#22c58a",
}: {
  items: { label: string; value: number; hint?: string }[];
  color?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-medium text-foreground">{item.label}</span>
            <span className="shrink-0 text-muted-foreground">{item.hint}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
