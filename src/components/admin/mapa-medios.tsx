"use client";

import * as React from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";

import type { PuntoCobertura } from "@/lib/monitoreo/cobertura";

type Props = { code: string; name: string };
type Colec = FeatureCollection<Geometry, Props>;

const W = 560;
const H = 640;
const SAN_ANDRES = "88";
/** Recuadro de San Andrés (está muy lejos del continente): abajo a la izquierda. */
const CAJA_SAN_ANDRES = { x: 6, y: H - 120, w: 120, h: 110 };

let cargando: Promise<Colec> | null = null;
function cargarDepartamentos(): Promise<Colec> {
  cargando ??= fetch("/data/geo/departamentos.json").then((r) => {
    if (!r.ok) throw new Error("sin mapa");
    return r.json() as Promise<Colec>;
  });
  cargando.catch(() => (cargando = null));
  return cargando;
}

const fmt = (n: number) => n.toLocaleString("es-CO");

/**
 * Mapa de Colombia con una burbuja por ciudad: más grande donde hay más menciones. Cada burbuja es un botón que filtra la lista.
 * El departamento se pinta más oscuro cuanto más suma. Los puntos que solo se saben a nivel de departamento van con borde punteado.
 */
export function MapaMedios({
  puntos,
  departamentos,
  color,
  elegido,
  alElegir,
  etiqueta,
}: {
  puntos: PuntoCobertura[];
  /** Total por departamento (código de 2 dígitos), para pintar el fondo. */
  departamentos: Record<string, number>;
  /** Color de las burbujas (una variable CSS o un color). */
  color: string;
  elegido: string | null;
  alElegir: (dane: string | null) => void;
  etiqueta: string;
}) {
  const [fc, setFc] = React.useState<Colec | null | undefined>(undefined);
  const [sobre, setSobre] = React.useState<string | null>(null);
  React.useEffect(() => {
    let viva = true;
    cargarDepartamentos().then((c) => viva && setFc(c)).catch(() => viva && setFc(null));
    return () => {
      viva = false;
    };
  }, []);

  const geometria = React.useMemo(() => {
    if (!fc) return null;
    const continente: Colec = { ...fc, features: fc.features.filter((f) => String(f.properties.code).padStart(2, "0") !== SAN_ANDRES) };
    const isla: Colec = { ...fc, features: fc.features.filter((f) => String(f.properties.code).padStart(2, "0") === SAN_ANDRES) };
    const proy = geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], continente);
    const camino = geoPath(proy);
    const proyIsla = isla.features.length ? geoMercator().fitExtent([[CAJA_SAN_ANDRES.x + 8, CAJA_SAN_ANDRES.y + 22], [CAJA_SAN_ANDRES.x + CAJA_SAN_ANDRES.w - 8, CAJA_SAN_ANDRES.y + CAJA_SAN_ANDRES.h - 8]], isla) : null;
    return {
      formas: continente.features.map((f) => ({ code: String(f.properties.code).padStart(2, "0"), name: f.properties.name, d: camino(f) ?? "" })),
      isla: proyIsla ? isla.features.map((f) => ({ code: SAN_ANDRES, name: f.properties.name, d: geoPath(proyIsla)(f) ?? "" })) : [],
      punto: (lat: number, lon: number, dep: string): [number, number] | null => {
        const p = (dep === SAN_ANDRES && proyIsla ? proyIsla : proy)([lon, lat]);
        return p ? [p[0], p[1]] : null;
      },
    };
  }, [fc]);

  if (fc === undefined) return <div className="grid h-72 place-items-center text-sm text-muted-foreground">Cargando el mapa…</div>;
  if (fc === null || !geometria) return <p className="text-sm text-muted-foreground">No se pudo cargar el mapa: usa la lista.</p>;

  const maxDep = Math.max(1, ...Object.values(departamentos));
  const max = Math.max(1, ...puntos.map((p) => p.total));
  const radio = (n: number) => 4 + 20 * Math.sqrt(n / max);
  const actual = puntos.find((p) => p.dane === sobre);
  const ubicados = puntos
    .map((p) => ({ p, xy: geometria.punto(p.lat, p.lon, p.dane.slice(0, 2)) }))
    .filter((x): x is { p: PuntoCobertura; xy: [number, number] } => x.xy !== null)
    .sort((a, b) => b.p.total - a.p.total); // las grandes al fondo, las pequeñas encima

  return (
    <div className="relative mx-auto w-full max-w-md">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={etiqueta} className="h-auto w-full">
        {[...geometria.formas, ...geometria.isla].map((f) => {
          const n = departamentos[f.code] ?? 0;
          return <path key={f.code} d={f.d} className="fill-brand stroke-surface" strokeWidth={0.8} style={{ fillOpacity: n > 0 ? 0.1 + 0.4 * Math.sqrt(n / maxDep) : 0.06 }} />;
        })}
        <rect x={CAJA_SAN_ANDRES.x} y={CAJA_SAN_ANDRES.y + 14} width={CAJA_SAN_ANDRES.w} height={CAJA_SAN_ANDRES.h - 14} rx={8} className="fill-none stroke-border" strokeDasharray="3 3" />
        <text x={CAJA_SAN_ANDRES.x + 6} y={CAJA_SAN_ANDRES.y + 10} className="fill-muted-foreground" fontSize={10}>San Andrés</text>
        {ubicados.map(({ p, xy }) => {
          const esDep = p.dane.length === 2;
          const activo = elegido === p.dane;
          return (
            <circle
              key={p.dane}
              cx={xy[0]}
              cy={xy[1]}
              r={radio(p.total)}
              role="button"
              tabIndex={0}
              aria-label={`${p.nombre}: ${p.total}`}
              aria-pressed={activo}
              onClick={() => alElegir(activo ? null : p.dane)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), alElegir(activo ? null : p.dane))}
              onMouseEnter={() => setSobre(p.dane)}
              onMouseLeave={() => setSobre(null)}
              onFocus={() => setSobre(p.dane)}
              onBlur={() => setSobre(null)}
              className="cursor-pointer outline-none"
              style={{ fill: color, fillOpacity: esDep ? 0.18 : 0.55, stroke: activo ? "var(--foreground)" : color, strokeWidth: activo ? 3 : 1.5, strokeDasharray: esDep ? "4 3" : undefined }}
            />
          );
        })}
      </svg>
      <p className="mt-1 min-h-10 text-center text-sm font-semibold" aria-live="polite">
        {actual ? (
          <>
            {actual.nombre}
            <span className="font-normal text-muted-foreground"> · {fmt(actual.total)} {actual.total === 1 ? "mención" : "menciones"}</span>
            {actual.medios.length > 0 && <span className="block text-xs font-normal text-muted-foreground">{actual.medios.slice(0, 3).map((m) => `${m.nombre} ${m.total}`).join(" · ")}</span>}
          </>
        ) : (
          <span className="font-normal text-muted-foreground">Pasa el cursor por una burbuja; haz clic para ver solo lo de ese lugar.</span>
        )}
      </p>
    </div>
  );
}
