"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { geoMercator, geoPath, type GeoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { ArrowLeft, Loader2 } from "lucide-react";

import { heatColor } from "@/components/admin/colombia-heatmap";
import { BOGOTA_DANE, matchMunicipio } from "@/lib/electoral-places";

type GeoProps = { code: string; name: string };
type GeoCollection = FeatureCollection<Geometry, GeoProps>;
type Bounds = [[number, number], [number, number]];
type Box = [number, number, number, number];

export type MapArea = {
  id: string;
  name: string;
  votos: number;
  geo?: string;
  /** Color propio (p. ej. el del partido ganador) en vez del mapa de calor. */
  color?: string;
  /** Qué tan fuerte se pinta ese color, de 0 a 1 (p. ej. el % del ganador). */
  intensidad?: number;
  /** Texto del recuadro al pasar el cursor, en vez de "N votos". */
  detalle?: string;
};

const W = 560;
const H = 700;
const FULL: Box = [0, 0, W, H];
const SAN_ANDRES = "88";
const CUNDINAMARCA = "25";
const SUMAPAZ = "20";
const STROKE = "rgba(10,10,12,0.28)";
const SELECTED_STROKE = "#0f6b4c";

const geoCache = new Map<string, Promise<GeoCollection>>();

/** Los GeoJSON (public/data/geo, ver scripts/build-geo.mjs) se piden una sola vez. */
function loadGeo(url: string) {
  let pending = geoCache.get(url);
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return res.json() as Promise<GeoCollection>;
    });
    geoCache.set(url, pending);
    pending.catch(() => geoCache.delete(url));
  }
  return pending;
}

function useGeo(url: string | null) {
  const [loaded, setLoaded] = React.useState<{ url: string; geo: GeoCollection } | null>(null);
  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    loadGeo(url)
      .then((geo) => {
        if (!cancelled) setLoaded({ url, geo });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);
  return loaded && loaded.url === url ? loaded.geo : null;
}

function unionBounds(path: GeoPath, features: Feature<Geometry, GeoProps>[]): Bounds {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features) {
    const [[a, b], [c, d]] = path.bounds(f);
    x0 = Math.min(x0, a);
    y0 = Math.min(y0, b);
    x1 = Math.max(x1, c);
    y1 = Math.max(y1, d);
  }
  return [
    [x0, y0],
    [x1, y1],
  ];
}

/** Caja con margen alrededor de `bounds` y la misma proporción del lienzo (el zoom no deforma). */
function fitBox([[x0, y0], [x1, y1]]: Bounds): Box {
  let w = (x1 - x0) * 1.12;
  let h = (y1 - y0) * 1.12;
  if (w / h > W / H) h = (w * H) / W;
  else w = (h * W) / H;
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}

/**
 * Anima el viewBox hacia `target`. Todo el mapa usa la misma proyección
 * (la del país), así que "hacer zoom" es solo mover la ventana: los
 * municipios encajan exactos con el contorno del departamento.
 */
function useAnimatedBox(target: Box) {
  const [box, setBox] = React.useState<Box>(target);
  const current = React.useRef<Box>(target);
  React.useEffect(() => {
    const from = current.current;
    if (from.every((v, i) => v === target[i])) return;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 750);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const next = from.map((v, i) => v + (target[i] - v) * eased) as Box;
      current.current = next;
      setBox(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return box;
}

export function CabalMap({
  dept,
  areas,
  selectedId,
  loading,
  onSelect,
  onBack,
  onOpenBogota,
  ariaLabel = "Mapa de calor de votos de María Fernanda Cabal",
}: {
  ariaLabel?: string;
  /** Código DANE del departamento abierto; null muestra el país. */
  dept: string | null;
  /** Datos del nivel visible: departamentos, o municipios/localidades del departamento abierto. */
  areas: MapArea[];
  selectedId?: string | null;
  loading?: boolean;
  onSelect: (area: MapArea) => void;
  onBack: () => void;
  /** Bogotá no es parte de Cundinamarca en los datos, pero sí en el mapa: se ofrece como acceso. */
  onOpenBogota?: () => void;
}) {
  const departamentos = useGeo("/data/geo/departamentos.json");
  const subGeo = useGeo(
    dept === null
      ? null
      : dept === BOGOTA_DANE
        ? "/data/geo/bogota-localidades.json"
        : `/data/geo/municipios/${dept}.json`
  );
  // El hover se guarda junto al departamento: al cambiar de nivel la forma
  // bajo el cursor desaparece sin disparar mouseleave.
  const [hover, setHover] = React.useState<{ dept: string | null; key: string } | null>(null);
  const hovered = hover?.dept === dept ? hover.key : null;
  const setHovered = (update: (key: string | null) => string | null) =>
    setHover((h) => {
      const key = update(h?.dept === dept ? h.key : null);
      return key ? { dept, key } : null;
    });

  // Proyección ajustada al territorio continental: San Andrés va en un recuadro aparte.
  const path = React.useMemo(() => {
    if (!departamentos) return null;
    const continental = {
      ...departamentos,
      features: departamentos.features.filter((f) => f.properties.code !== SAN_ANDRES),
    };
    return geoPath(geoMercator().fitExtent([[16, 16], [W - 16, H - 16]], continental));
  }, [departamentos]);

  const deptShapes = React.useMemo(
    () =>
      path && departamentos
        ? departamentos.features.map((f) => ({ ...f.properties, d: path(f) ?? "", feature: f }))
        : [],
    [path, departamentos]
  );

  const subShapes = React.useMemo(
    () =>
      path && subGeo ? subGeo.features.map((f) => ({ ...f.properties, d: path(f) ?? "" })) : [],
    [path, subGeo]
  );

  const sanAndres = React.useMemo(() => {
    const feature = departamentos?.features.find((f) => f.properties.code === SAN_ANDRES);
    return feature ? geoPath(geoMercator().fitExtent([[20, 30], [92, 102]], feature))(feature) : null;
  }, [departamentos]);

  // Qué dato corresponde a cada forma: por código (departamentos y
  // localidades) o por nombre del municipio (la Registraduría no usa DANE).
  const areaByCode = React.useMemo(() => {
    const out = new Map<string, MapArea>();
    if (dept === null || dept === BOGOTA_DANE) {
      for (const a of areas) if (a.geo) out.set(a.geo, a);
    } else if (subGeo) {
      const candidates = subGeo.features.map((f) => f.properties);
      for (const a of areas) {
        const code = a.geo ?? matchMunicipio(a.name, candidates);
        if (code) out.set(code, a);
      }
    }
    return out;
  }, [areas, dept, subGeo]);

  const target = React.useMemo<Box>(() => {
    if (dept === null || !path) return FULL;
    // Bogotá: encuadre urbano; Sumapaz (rural) es casi toda el área del distrito.
    if (dept === BOGOTA_DANE && subGeo) {
      return fitBox(unionBounds(path, subGeo.features.filter((f) => f.properties.code !== SUMAPAZ)));
    }
    const feature = deptShapes.find((s) => s.code === dept)?.feature;
    return feature ? fitBox(path.bounds(feature)) : FULL;
  }, [dept, path, subGeo, deptShapes]);

  const box = useAnimatedBox(target);

  const max = Math.max(1, ...areas.map((a) => a.votos));
  const colores = areas.some((a) => a.color);
  const fill = (code: string) => {
    const area = areaByCode.get(code);
    if (colores) {
      if (!area?.color) return "#e5e7e6";
      const t = Math.max(0, Math.min(1, area.intensidad ?? 1));
      return `color-mix(in oklab, ${area.color} ${Math.round(45 + 55 * t)}%, white)`;
    }
    return heatColor(area ? Math.sqrt(area.votos / max) : 0);
  };
  const selectedCode = [...areaByCode].find(([, a]) => a.id === selectedId)?.[0];

  const hoverInfo = (() => {
    if (!hovered) return null;
    const [layer, code] = hovered.split(":");
    if (layer === "bogota") return { name: "Bogotá D.C.", text: "ver localidades" };
    const shapes = layer === "d" ? deptShapes : subShapes;
    const shape = shapes.find((s) => s.code === code);
    if (!shape) return null;
    const area = areaByCode.get(code);
    return {
      // Departamentos y localidades con el nombre de los datos; municipios
      // con el del DANE, que lleva tildes.
      name: layer === "d" || dept === BOGOTA_DANE ? (area?.name ?? shape.name) : shape.name,
      // Sin dato a nivel país es falta de datos (Cesar en 2018); en un
      // departamento, que no obtuvo votos allí.
      text: area
        ? (area.detalle ?? `${area.votos.toLocaleString("es-CO")} votos`)
        : layer === "d"
          ? "sin datos"
          : "0 votos",
    };
  })();

  const handlers = (key: string, area: MapArea | undefined) => ({
    onMouseEnter: () => setHovered(() => key),
    onMouseLeave: () => setHovered((h) => (h === key ? null : h)),
    onClick: () => area && onSelect(area),
  });

  const bogota = dept === CUNDINAMARCA ? deptShapes.find((s) => s.code === BOGOTA_DANE) : undefined;

  return (
    <div className="relative">
      <svg
        viewBox={box.join(" ")}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* País. Al abrir un departamento, los demás se desvanecen. */}
        <g>
          {deptShapes.map((s) => {
            const open = dept !== null;
            const key = `d:${s.code}`;
            return (
              <path
                key={s.code}
                d={s.d}
                style={{
                  fill: open ? "rgba(10,10,12,0.06)" : fill(s.code),
                  // El contorno del departamento abierto queda de fondo mientras
                  // aparecen sus municipios. En Bogotá no: las localidades son de
                  // otra fuente (Planeación distrital) y no calzan exacto con el DANE.
                  opacity: !open || (s.code === dept && dept !== BOGOTA_DANE) ? 1 : 0,
                  transition: "opacity 450ms ease, fill 400ms ease",
                  filter: hovered === key ? "brightness(1.12)" : undefined,
                }}
                stroke={hovered === key ? "#0a0a0c" : STROKE}
                strokeWidth={hovered === key ? 1.4 : 0.6}
                vectorEffect="non-scaling-stroke"
                pointerEvents={open ? "none" : "auto"}
                className="cursor-pointer"
                {...handlers(key, areaByCode.get(s.code))}
              />
            );
          })}
        </g>

        {/* Departamento abierto: municipios (o localidades en Bogotá) con su mapa de calor. */}
        {dept !== null && subShapes.length > 0 && (
          <motion.g
            key={dept}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            {subShapes.map((s) => {
              const key = `s:${s.code}`;
              const isSelected = s.code === selectedCode;
              return (
                <path
                  key={s.code}
                  d={s.d}
                  style={{
                    fill: fill(s.code),
                    transition: "fill 400ms ease",
                    filter: hovered === key || isSelected ? "brightness(1.12)" : undefined,
                  }}
                  stroke={isSelected ? SELECTED_STROKE : hovered === key ? "#0a0a0c" : STROKE}
                  strokeWidth={isSelected ? 2.5 : hovered === key ? 1.4 : 0.6}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-pointer"
                  {...handlers(key, areaByCode.get(s.code))}
                />
              );
            })}
            {bogota && (
              <path
                d={bogota.d}
                style={{ fill: "rgba(15,107,76,0.18)" }}
                stroke={SELECTED_STROKE}
                strokeWidth={1.2}
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onMouseEnter={() => setHovered(() => "bogota:11")}
                onMouseLeave={() => setHovered((h) => (h === "bogota:11" ? null : h))}
                onClick={onOpenBogota}
              />
            )}
          </motion.g>
        )}

        {/* San Andrés y Providencia, en recuadro (a escala quedaría fuera del mapa). */}
        {sanAndres && (
          <g
            style={{ opacity: dept === null ? 1 : 0, transition: "opacity 300ms ease" }}
            pointerEvents={dept === null ? "auto" : "none"}
          >
            <rect x={12} y={12} width={88} height={98} rx={8} fill="none" stroke={STROKE} strokeDasharray="3 3" />
            <text x={56} y={26} textAnchor="middle" fontSize={8} className="fill-muted-foreground">
              San Andrés
            </text>
            <path
              d={sanAndres}
              style={{ fill: fill(SAN_ANDRES) }}
              stroke={STROKE}
              strokeWidth={0.6}
              className="cursor-pointer"
              {...handlers(`d:${SAN_ANDRES}`, areaByCode.get(SAN_ANDRES))}
            />
          </g>
        )}
      </svg>

      {dept !== null && (
        <button
          type="button"
          onClick={onBack}
          className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-surface-muted"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Colombia
        </button>
      )}

      {hoverInfo && (
        <div className="pointer-events-none absolute right-2 top-2 max-w-[60%] rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium shadow-lg">
          {hoverInfo.name} · {hoverInfo.text}
        </div>
      )}

      {(loading || !path) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-brand" aria-label="Cargando" />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
        {colores ? (
          <span>Color del partido ganador · más intenso, más amplia la victoria</span>
        ) : (
          <>
            <span>Menos votos</span>
            <span
              className="h-2 w-28 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${heatColor(0)}, ${heatColor(0.35)}, ${heatColor(0.7)}, ${heatColor(1)})`,
              }}
            />
            <span>Más votos</span>
          </>
        )}
        {dept === BOGOTA_DANE && <span className="w-full text-center">Sumapaz (rural) continúa al sur del encuadre.</span>}
        {dept === CUNDINAMARCA && <span className="w-full text-center">Bogotá (punteado) abre sus localidades.</span>}
      </div>
    </div>
  );
}
