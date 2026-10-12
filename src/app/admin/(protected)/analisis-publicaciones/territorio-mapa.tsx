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

const W = 640;
const H = 560;

/** Mapa para elegir un lugar con un clic: cada departamento, municipio o localidad es un botón. */
export function TerritorioMapa({ url, idDe, alElegir }: { url: string; idDe: (c: string) => string; alElegir: (id: string) => void }) {
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

  if (fc === undefined) return <div className="grid h-72 place-items-center text-sm text-muted-foreground">Cargando el mapa…</div>;
  if (fc === null) return <p className="text-sm text-muted-foreground">No hay mapa para este lugar: usa la lista.</p>;
  const actual = formas.find((f) => f.code === sobre);
  return (
    <div className="relative mx-auto max-w-xl">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Mapa para elegir un lugar" className="h-auto w-full">
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
            className="cursor-pointer fill-brand-soft stroke-surface outline-none transition-colors hover:fill-brand focus-visible:fill-brand"
            strokeWidth={1}
          />
        ))}
      </svg>
      <p className="mt-1 h-6 text-center text-sm font-semibold" aria-live="polite">
        {actual ? titulo(actual.name) : <span className="font-normal text-muted-foreground">Pasa el cursor sobre el mapa y haz clic para elegir.</span>}
      </p>
    </div>
  );
}
