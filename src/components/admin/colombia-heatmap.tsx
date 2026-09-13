"use client";

import * as React from "react";

import {
  COLOMBIA_MAP_HEIGHT,
  COLOMBIA_MAP_WIDTH,
  colombiaDepartments,
} from "@/lib/colombia-departments";

/** Interpola entre el verde de marca (bajo) y el ámbar/rojo (alto). */
function heatColor(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  // 0 -> superficie apagada, 0.5 -> verde marca, 1 -> ámbar intenso
  const stops: [number, [number, number, number]][] = [
    [0, [39, 42, 46]],
    [0.35, [15, 107, 76]],
    [0.7, [34, 197, 138]],
    [1, [255, 201, 74]],
  ];
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i][0] && clamped <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const span = b[0] - a[0] || 1;
  const local = (clamped - a[0]) / span;
  const mix = (x: number, y: number) => Math.round(x + (y - x) * local);
  const [r, g, bl] = [mix(a[1][0], b[1][0]), mix(a[1][1], b[1][1]), mix(a[1][2], b[1][2])];
  return `rgb(${r},${g},${bl})`;
}

export function ColombiaHeatmap({
  values,
}: {
  /** Menciones (u otra métrica) por nombre de departamento. */
  values: Record<string, number>;
}) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const max = Math.max(...Object.values(values), 1);

  const hoveredValue = hovered ? values[hovered] : undefined;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${COLOMBIA_MAP_WIDTH} ${COLOMBIA_MAP_HEIGHT}`}
        className="mx-auto h-auto w-full max-w-sm"
        role="img"
        aria-label="Mapa de menciones por departamento (datos simulados)"
      >
        {colombiaDepartments.map((dept) => {
          const value = values[dept.name] ?? 0;
          const t = value / max;
          const isHovered = hovered === dept.name;
          return (
            <path
              key={dept.name}
              d={dept.path}
              fill={heatColor(t)}
              stroke={isHovered ? "#fff" : "rgba(255,255,255,0.15)"}
              strokeWidth={isHovered ? 1.5 : 0.6}
              className="cursor-pointer transition-[stroke,filter] duration-150"
              style={isHovered ? { filter: "brightness(1.15)" } : undefined}
              onMouseEnter={() => setHovered(dept.name)}
              onMouseLeave={() => setHovered((h) => (h === dept.name ? null : h))}
            >
              <title>
                {dept.name}: {value.toLocaleString("es-CO")} menciones
              </title>
            </path>
          );
        })}
      </svg>

      {/* leyenda */}
      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
        <span>Menos</span>
        <span
          className="h-2 w-24 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.35)}, ${heatColor(0.7)}, ${heatColor(1)})`,
          }}
        />
        <span>Más</span>
      </div>

      {hovered && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium shadow-lg">
          {hovered} · {(hoveredValue ?? 0).toLocaleString("es-CO")} menciones
        </div>
      )}
    </div>
  );
}
