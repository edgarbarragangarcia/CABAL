"use client";

import * as React from "react";
import type { ECharts } from "echarts";
import type { FeatureCollection, Geometry } from "geojson";
import { Loader2, Minus, Plus, RotateCcw } from "lucide-react";

export type RegionMapa = {
  /** Código de la región en el GeoJSON (DANE o localidad). */
  geo: string;
  /** Código de la Registraduría, para navegar al hacer clic. */
  codigo: string;
  nombre: string;
  color: string;
  /** Define la altura de la región (votos del ganador). */
  valor: number;
  /** Líneas del tooltip. */
  detalle: string[];
};

type GeoCollection = FeatureCollection<Geometry, { code: string; name: string }>;

const geoCache = new Map<string, Promise<GeoCollection>>();
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

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

const SIN_DATOS = "#d6dcd9";
/** Inclinación de la cámara (90 = cenital) y altura máxima de las regiones. */
const ALPHA = 55;
const ALTURA_MAX = 11;
const ANCHO = 100;

type Caja = { ancho: number; fondo: number; aspectScale: number };

/** Proporciones del mapa: longitud corregida por la latitud media, para que no salga aplastado. */
function cajaDe(geo: GeoCollection, quitar: Set<string>): Caja {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  for (const f of geo.features) {
    if (!quitar.has(f.properties.code) && "coordinates" in f.geometry) visit(f.geometry.coordinates);
  }
  const aspectScale = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const aspect = ((maxX - minX) / Math.max(maxY - minY, 1e-6)) * aspectScale;
  return { ancho: ANCHO, fondo: ANCHO / aspect, aspectScale };
}

/**
 * Tamaño de la cámara ortográfica para que el mapa quepa entero y centrado
 * en el contenedor: lo que más ocupe, el fondo inclinado o el ancho.
 */
function encuadre(caja: Caja, el: HTMLElement) {
  const a = (ALPHA * Math.PI) / 180;
  const alto = caja.fondo * Math.sin(a) + ALTURA_MAX * Math.cos(a);
  const proporcion = el.clientWidth / Math.max(el.clientHeight, 1);
  return Math.max(alto, caja.ancho / proporcion) * 1.08;
}

/**
 * Mapa 3D (echarts-gl): cada territorio se levanta según los votos de su
 * ganador y toma el color de su partido. Se arrastra para girar, rueda
 * para acercar, clic para entrar al territorio. WebGL necesita el
 * navegador, así que la librería se carga dentro de un efecto.
 */
export function MapaElectoral3D({
  geoUrl,
  regiones,
  destacado,
  excluir = [],
  onSelect,
}: {
  geoUrl: string;
  regiones: RegionMapa[];
  destacado?: string;
  excluir?: string[];
  onSelect?: (codigo: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<ECharts | null>(null);
  const cajaRef = React.useRef<Caja | null>(null);
  const tamanoRef = React.useRef(150);
  const onSelectRef = React.useRef(onSelect);
  React.useEffect(() => {
    onSelectRef.current = onSelect;
  });

  const excluirKey = excluir.join(",");
  // El indicador de carga solo aparece al cambiar de geometría, no al actualizar colores.
  const geoKey = `${geoUrl}|${excluirKey}`;
  const [statusSel, setStatusSel] = React.useState<{ key: string; s: "ready" | "error" }>({ key: "", s: "ready" });
  const status = statusSel.key === geoKey ? statusSel.s : "loading";

  React.useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const [echarts, geo] = await Promise.all([import("echarts"), loadGeo(geoUrl)]);
        await import("echarts-gl");
        if (disposed || !ref.current) return;

        // Se registra con el código como nombre: los nombres se repiten entre departamentos.
        const quitar = new Set(excluirKey ? excluirKey.split(",") : []);
        const mapName = `${geoUrl}|${excluirKey}`;
        echarts.registerMap(mapName, {
          type: "FeatureCollection",
          features: geo.features
            .filter((f) => !quitar.has(f.properties.code))
            .map((f) => ({ ...f, properties: { ...f.properties, name: f.properties.code } })),
        } as never);

        const caja = cajaDe(geo, quitar);
        cajaRef.current = caja;
        const tamano = encuadre(caja, ref.current);
        tamanoRef.current = tamano;

        const byGeo = new Map(regiones.map((r) => [r.geo, r]));
        const max = Math.max(1, ...regiones.map((r) => r.valor));
        const nombres = new Map(geo.features.map((f) => [f.properties.code, f.properties.name]));
        const data = geo.features
          .filter((f) => !quitar.has(f.properties.code))
          .map((f) => {
            const code = f.properties.code;
            const r = byGeo.get(code);
            const isSel = destacado === code;
            return {
              name: code,
              value: r?.valor ?? 0,
              height: r ? 1.2 + 7 * Math.sqrt(r.valor / max) + (isSel ? 2.5 : 0) : 0.6,
              itemStyle: {
                color: r?.color ?? SIN_DATOS,
                opacity: destacado && !isSel ? 0.72 : 1,
                borderWidth: isSel ? 2 : 0.6,
                borderColor: isSel ? "#fbbf24" : "rgba(255,255,255,0.85)",
              },
            };
          });

        const chart = chartRef.current ?? echarts.init(ref.current);
        chartRef.current = chart;
        chart.off("click");
        chart.on("click", (p: { name?: string }) => {
          const r = p.name ? byGeo.get(p.name) : undefined;
          if (r) onSelectRef.current?.(r.codigo);
        });

        chart.setOption(
          {
            backgroundColor: "transparent",
            tooltip: {
              show: true,
              backgroundColor: "rgba(15,23,20,0.92)",
              borderWidth: 0,
              padding: [8, 12],
              textStyle: { color: "#f8fafc", fontSize: 12 },
              formatter: (p: { name: string }) => {
                const r = byGeo.get(p.name);
                const title = esc(r?.nombre ?? nombres.get(p.name) ?? p.name);
                if (!r) return `<b>${title}</b><br/><span style="opacity:.7">Sin datos</span>`;
                return [
                  `<span style="display:inline-block;width:9px;height:9px;border-radius:9px;background:${r.color};margin-right:6px"></span><b>${title}</b>`,
                  ...r.detalle.map(esc),
                ].join("<br/>");
              },
            },
            series: [
              {
                type: "map3D",
                map: mapName,
                boxWidth: caja.ancho,
                boxDepth: caja.fondo,
                aspectScale: caja.aspectScale,
                regionHeight: 1,
                shading: "realistic",
                realisticMaterial: { roughness: 0.55, metalness: 0.05 },
                light: {
                  main: { intensity: 1.35, shadow: true, shadowQuality: "high", alpha: 48, beta: 28 },
                  ambient: { intensity: 0.45 },
                },
                postEffect: {
                  enable: true,
                  SSAO: { enable: true, radius: 3, intensity: 1.1 },
                  bloom: { enable: false },
                },
                temporalSuperSampling: { enable: true },
                viewControl: {
                  projection: "orthographic",
                  orthographicSize: tamano,
                  minOrthographicSize: tamano * 0.3,
                  maxOrthographicSize: tamano * 2.2,
                  alpha: ALPHA,
                  beta: 0,
                  center: [0, ALTURA_MAX / 4, 0],
                  distance: 250,
                  // Sin paneo: el mapa siempre queda centrado.
                  panSensitivity: 0,
                  // La rueda sigue desplazando la página (el zoom va en botones), y
                  // en pantallas táctiles arrastrar también desplaza en vez de girar.
                  rotateSensitivity: window.matchMedia("(pointer: coarse)").matches ? 0 : 1.2,
                  zoomSensitivity: 0,
                  animationDurationUpdate: 600,
                },
                groundPlane: { show: false },
                label: { show: false },
                emphasis: {
                  label: { show: false },
                  itemStyle: { color: "#fbbf24" },
                },
                data,
              },
            ],
          },
          true
        );
        setStatusSel({ key: `${geoUrl}|${excluirKey}`, s: "ready" });
      } catch {
        if (!disposed) setStatusSel({ key: `${geoUrl}|${excluirKey}`, s: "error" });
      }
    })();

    return () => {
      disposed = true;
    };
  }, [geoUrl, regiones, destacado, excluirKey]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Al cambiar el tamaño del contenedor, el mapa se vuelve a encuadrar.
    const observer = new ResizeObserver(() => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.resize();
      if (cajaRef.current) {
        tamanoRef.current = encuadre(cajaRef.current, el);
        const t = tamanoRef.current;
        chart.setOption({
          series: [{ viewControl: { orthographicSize: t, minOrthographicSize: t * 0.3, maxOrthographicSize: t * 2.2 } }],
        });
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  const zoomActual = React.useRef<number | null>(null);
  const resetView = () => {
    zoomActual.current = null;
    chartRef.current?.setOption({
      series: [{ viewControl: { alpha: ALPHA, beta: 0, orthographicSize: tamanoRef.current } }],
    });
  };
  const zoom = (factor: number) => {
    const base = tamanoRef.current;
    const next = Math.min(base * 2.2, Math.max(base * 0.3, (zoomActual.current ?? base) * factor));
    zoomActual.current = next;
    chartRef.current?.setOption({ series: [{ viewControl: { orthographicSize: next } }] });
  };

  return (
    <div className="relative">
      <div ref={ref} className="h-[440px] w-full sm:h-[520px]" />
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <Loader2 className="size-6 animate-spin text-emerald-600" aria-label="Cargando mapa" />
        </div>
      )}
      {status === "error" && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
          No se pudo dibujar el mapa 3D en este navegador.
        </p>
      )}
      {status === "ready" && (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoom(0.8)}
            aria-label="Acercar"
            title="Acercar"
            className="grid size-7 place-items-center rounded-full bg-surface/90 text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur transition hover:text-foreground"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => zoom(1.25)}
            aria-label="Alejar"
            title="Alejar"
            className="grid size-7 place-items-center rounded-full bg-surface/90 text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur transition hover:text-foreground"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur transition hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Vista inicial
          </button>
        </div>
      )}
      <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground">
        Arrastra para girar · + / − para acercar · clic para entrar
      </p>
    </div>
  );
}
