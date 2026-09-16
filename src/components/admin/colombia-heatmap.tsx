"use client";

import * as React from "react";

import {
  COLOMBIA_MAP_HEIGHT,
  COLOMBIA_MAP_WIDTH,
  colombiaDepartments,
} from "@/lib/colombia-departments";

/** Interpola de una superficie clara (bajo) a verde de marca y ámbar (alto). */
function heatColor(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  // 0 -> gris muy claro (casi sin dato), 0.7 -> verde marca, 1 -> ámbar intenso.
  // Pensado para tarjetas claras: el extremo bajo no puede ser oscuro o el
  // mapa se ve como una mancha negra cuando un solo departamento domina.
  const stops: [number, [number, number, number]][] = [
    [0, [228, 231, 229]],
    [0.35, [134, 209, 178]],
    [0.7, [15, 107, 76]],
    [1, [255, 176, 32]],
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
  selected,
  onSelect,
}: {
  /** Menciones (u otra métrica) por nombre de departamento. */
  values: Record<string, number>;
  /** Departamento seleccionado (clic) — se resalta con borde fijo. */
  selected?: string | null;
  onSelect?: (name: string) => void;
}) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const max = Math.max(...Object.values(values), 1);

  const activeName = hovered ?? selected ?? null;
  const activeValue = activeName ? values[activeName] : undefined;

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
          // Raíz cuadrada en vez de lineal: cuando un departamento concentra
          // la mayoría del total (p. ej. el bastión de un candidato), una
          // escala lineal deja a casi todos los demás pegados al mínimo. La
          // raíz cuadrada separa mejor los valores medios y bajos entre sí.
          const t = Math.sqrt(value / max);
          const isHovered = hovered === dept.name;
          const isSelected = selected === dept.name;
          return (
            <path
              key={dept.name}
              d={dept.path}
              fill={heatColor(t)}
              stroke={isSelected ? "#0f6b4c" : isHovered ? "#0a0a0c" : "rgba(10,10,12,0.12)"}
              strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0.6}
              className="cursor-pointer transition-[stroke,filter] duration-150"
              style={isHovered || isSelected ? { filter: "brightness(1.15)" } : undefined}
              aria-label={`${dept.name}: ${value.toLocaleString("es-CO")} menciones`}
              onMouseEnter={() => setHovered(dept.name)}
              onMouseLeave={() => setHovered((h) => (h === dept.name ? null : h))}
              onClick={() => onSelect?.(dept.name)}
            />
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

      {activeName && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium shadow-lg">
          {activeName} · {(activeValue ?? 0).toLocaleString("es-CO")} menciones
        </div>
      )}
    </div>
  );
}
