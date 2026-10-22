"use client";

import * as React from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";

import { titulo } from "./nombres";

type Props = { code: string; name: string };

/** Qué mapa corresponde a un lugar: el país por departamentos, un departamento por municipios, Bogotá por localidades. */
export function mapaDe(id: string, nivel: string): { url: string; idDe: (code: string) => string } | null {
  if (nivel === "pais") return { url: "/data/geo/departamentos.json", idDe: (c) => c.padStart(2, "0") };
  if (nivel === "departamento" && id !== "11") return { url: `/data/geo/municipios/${id}.json`, idDe: (c) => c.padStart(5, "0") };
  if (id === "11001") return { url: "/data/geo/bogota-localidades.json", idDe: (c) => `11001:z${c.padStart(2, "0")}` };
  return null;
}

const cache = new Map<string, Promise<FeatureCollection<Geometry, Props>>>();
const cargar = (url: string) => {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error("sin mapa");
      return r.json();
    });
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
};

const W = 720;
const H = 820;

/** Mapa para elegir un lugar con un clic: cada departamento, municipio o localidad es un botón. */
export function TerritorioMapa({ url, idDe, alElegir, valores, unidad = "votos" }: { url: string; idDe: (c: string) => string; alElegir: (id: string) => void; /** Lo que cuentan los valores (votos, leads…). */ unidad?: string; /** Votos por código del lugar: pinta más oscuro donde hay más. */ valores?: Record<string, number> | null }) {
  const [res, setRes] = React.useState<{ url: string; fc: FeatureCollection<Geometry, Props> | null } | null>(null);
  const [sobre, setSobre] = React.useState<string | null>(null);
  React.useEffect(() => {
    let viva = true;
    cargar(url).then((fc) => viva && setRes({ url, fc })).catch(() => viva && setRes({ url, fc: null }));
    return () => {
      viva = false;
    };
  }, [url]);

  const fc = res?.url === url ? res.fc : undefined;
  const formas = React.useMemo(() => {
    if (!fc) return [];
    const path = geoPath(geoMercator().fitSize([W, H], fc));
    return fc.features.map((f) => ({ code: String(f.properties.code), name: f.properties.name, d: path(f) ?? "" }));
  }, [fc]);

  if (fc === undefined) return <div className="grid h-[min(80vh,54rem)] place-items-center text-sm text-muted-foreground">Cargando el mapa…</div>;
  if (fc === null) return <p className="text-sm text-muted-foreground">No hay mapa para este lugar: usa la lista.</p>;
  const actual = formas.find((f) => f.code === sobre);
  const max = valores ? Math.max(0, ...Object.values(valores)) : 0;
  const fmt = (n: number) => n.toLocaleString("es-CO");
  const valorDe = (code: string) => (valores ? valores[idDe(code)] ?? valores[code] : undefined);
  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Mapa para elegir un lugar" className="mx-auto block h-[min(80vh,54rem)] w-full">
        {formas.map((f) => (
          <path
            key={f.code}
            d={f.d}
            role="button"
            tabIndex={0}
            aria-label={titulo(f.name)}
            onClick={() => alElegir(idDe(f.code))}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && alElegir(idDe(f.code))}
            onMouseEnter={() => setSobre(f.code)}
            onMouseLeave={() => setSobre(null)}
            onFocus={() => setSobre(f.code)}
            onBlur={() => setSobre(null)}
            style={valores ? { fillOpacity: valorDe(f.code) === undefined ? 0.06 : 0.1 + 0.85 * Math.sqrt(max > 0 ? valorDe(f.code)! / max : 0) } : { fillOpacity: 0.25 }}
            className="cursor-pointer fill-brand stroke-surface outline-none hover:stroke-foreground focus-visible:stroke-foreground"
            strokeWidth={1}
          />
        ))}
      </svg>
      <p className="mt-1 h-6 text-center text-sm font-semibold" aria-live="polite">
        {actual ? <>{titulo(actual.name)}{valores && <span className="font-normal text-muted-foreground"> · {valorDe(actual.code) === undefined ? "sin datos" : `${fmt(valorDe(actual.code)!)} ${unidad}`}</span>}</> : <span className="font-normal text-muted-foreground">Pasa el cursor sobre el mapa y haz clic para elegir.</span>}
      </p>
      {valores && max > 0 && (
        <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span>0</span>
          <span aria-hidden="true" className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(to right, color-mix(in srgb, var(--brand) 10%, transparent), var(--brand))" }} />
          <span>{fmt(max)} {unidad}</span>
        </div>
      )}
    </div>
  );
}
