"use client";

import * as React from "react";
import type { ECharts, EChartsOption } from "echarts";

import { useTheme } from "@/components/animations/theme-provider";
import { dispersar, ubicar } from "@/lib/crm/geo";
import type { Network } from "@/lib/crm/network";
import { DIMENSION_LABEL } from "@/lib/crm/types";

import { communityColor } from "./red-crm-graph";

type Theme = "light" | "dark";
const CHROME: Record<Theme, { surface: string; ink: string; tierra: string; borde: string }> = {
  light: { surface: "#ffffff", ink: "#16170f", tierra: "#eef0ea", borde: "#c9ccc0" },
  dark: { surface: "#0e1211", ink: "#f2efe7", tierra: "#1b2220", borde: "#33403c" },
};
const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const MAX_PROBABLES = 2500;

/** Cuántas personas de la selección se pueden poner en el mapa (las demás no traen un lugar reconocible). */
export function resumenMapa(network: Network, visible: number[]) {
  const ubicadas = visible.filter((i) => ubicar(network.nodes[i]) !== null).length;
  return { ubicadas, sinLugar: visible.length - ubicadas };
}

/**
 * La red sobre el mapa de Colombia: cada persona queda en su municipio (o, si el CRM solo dice el departamento, en el centro del
 * departamento). Línea continua con flecha = referido registrado en el CRM (conexión real); línea punteada = posible conexión, deducida de lo
 * que comparten (lugar, intereses, actividades).
 */
export function RedCrmMapa({ network, visible, selected, onSelect }: { network: Network; visible: number[]; selected: number | null; onSelect: (node: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [chart, setChart] = React.useState<ECharts | null>(null);
  const [mapaListo, setMapaListo] = React.useState(false);
  const [falloMapa, setFalloMapa] = React.useState(false);
  const { resolvedTheme } = useTheme();
  const elegir = React.useEffectEvent((n: number) => onSelect(n));

  const ubicados = React.useMemo(() => {
    const lista = visible.flatMap((i) => { const u = ubicar(network.nodes[i]); return u ? [{ id: i, ...u }] : []; });
    const pos = dispersar(lista);
    return lista.map((u) => ({ ...u, pos: pos.get(u.id)! }));
  }, [network, visible]);

  React.useEffect(() => {
    let disposed = false;
    let instance: ECharts | null = null;
    let observer: ResizeObserver | null = null;
    (async () => {
      const echarts = await import("echarts");
      if (disposed || !ref.current) return;
      try {
        const r = await fetch("/data/geo/departamentos.json");
        if (!r.ok) throw new Error("sin mapa");
        echarts.registerMap("colombia", await r.json());
      } catch {
        if (!disposed) setFalloMapa(true);
        return;
      }
      if (disposed || !ref.current) return;
      instance = echarts.init(ref.current);
      instance.on("click", (p) => { if (p.dataType === "node") elegir(Number((p.data as { id: string }).id)); });
      observer = new ResizeObserver(() => instance?.resize());
      observer.observe(ref.current);
      setChart(instance);
      setMapaListo(true);
    })();
    return () => { disposed = true; observer?.disconnect(); instance?.dispose(); };
  }, []);

  React.useEffect(() => {
    if (!chart || !mapaListo) return;
    const c = CHROME[resolvedTheme];
    const { nodes, edges } = network;
    const lugarDe = new Map(ubicados.map((u) => [u.id, u]));
    const maxFuerza = Math.max(1, ...ubicados.map((u) => nodes[u.id].strength));
    // Todas las conexiones registradas; de las posibles, las más fuertes (más de eso no se lee).
    const entre = edges.filter((e) => lugarDe.has(e.a) && lugarDe.has(e.b));
    const reales = entre.filter((e) => e.referral);
    const probables = entre.filter((e) => !e.referral).sort((x, y) => y.similarity - x.similarity).slice(0, MAX_PROBABLES);
    const lineas = [...probables, ...reales];

    const tooltip = (p: { dataType?: string; dataIndex: number; data?: { id?: string } }) => {
      if (p.dataType === "edge") {
        const e = lineas[p.dataIndex];
        const [a, b] = [esc(nodes[e.a].name), esc(nodes[e.b].name)];
        if (e.referral) return `<b>Conexión registrada</b><br/>${a} trajo a ${b}`;
        return `<b>Posible conexión</b> (no está registrada en el CRM)<br/>${a} ↔ ${b}<br/>${e.shared.map((t) => `${DIMENSION_LABEL[t.dim]}: <b>${esc(t.value)}</b>`).join("<br/>")}`;
      }
      const i = Number(p.data?.id);
      const n = nodes[i];
      return `<b>${esc(n.name)}</b><br/>${esc(lugarDe.get(i)?.lugar ?? "")}${lugarDe.get(i)?.precision === "departamento" ? " (solo se conoce el departamento)" : ""}<br/>Grupo ${n.community + 1} · ${n.degree} conexiones${n.referred.length ? `<br/>Trajo a ${n.referred.length}` : ""}`;
    };

    const option: EChartsOption = {
      tooltip: { confine: true, backgroundColor: c.surface, borderColor: withAlpha(c.ink, 0.12), textStyle: { color: c.ink, fontSize: 12 }, extraCssText: "border-radius:12px;max-width:300px;white-space:normal;", formatter: (p) => tooltip(p as never) },
      geo: { map: "colombia", roam: true, silent: true, zoom: 1, scaleLimit: { min: 0.8, max: 40 }, itemStyle: { areaColor: c.tierra, borderColor: c.borde, borderWidth: 0.7 }, label: { show: false } },
      series: [{
        type: "graph",
        coordinateSystem: "geo",
        layout: "none",
        data: ubicados.map((u) => {
          const n = nodes[u.id];
          const esElegido = u.id === selected;
          return {
            id: String(u.id), name: n.name, value: u.pos,
            symbol: n.referred.length ? "diamond" : "circle",
            symbolSize: (5 + 7 * Math.sqrt(n.strength / maxFuerza)) * (esElegido ? 1.5 : 1),
            itemStyle: { color: communityColor(n.community, resolvedTheme), borderColor: esElegido ? c.ink : c.surface, borderWidth: esElegido ? 2.5 : 1 },
          };
        }),
        links: lineas.map((e) => {
          const [ca, cb] = [nodes[e.a].community, nodes[e.b].community];
          return {
            source: String(e.a), target: String(e.b),
            symbol: e.referral ? ["none", "arrow"] : ["none", "none"],
            lineStyle: e.referral
              ? { width: 1.6, type: "solid", color: withAlpha(c.ink, 0.75), curveness: 0.12 }
              : { width: 0.7, type: "dashed", color: ca === cb ? withAlpha(communityColor(ca, resolvedTheme), 0.4) : withAlpha(c.ink, 0.16), curveness: 0 },
          };
        }),
        edgeSymbolSize: 7,
        label: { show: false },
        emphasis: { focus: "adjacency", lineStyle: { width: 2.2, color: withAlpha(c.ink, 0.85) } },
        blur: { itemStyle: { opacity: 0.15 }, lineStyle: { opacity: 0.05 } },
        animationDuration: 400,
      }],
    };
    chart.setOption(option, { notMerge: true });
  }, [chart, mapaListo, network, ubicados, selected, resolvedTheme]);

  if (falloMapa) return <p className="p-6 text-sm text-muted-foreground">No se pudo cargar el mapa de Colombia. Usa la vista «Red».</p>;
  return (
    <div className="relative">
      <div ref={ref} role="img" aria-label={`Mapa de Colombia con ${ubicados.length} personas ubicadas en su municipio y sus conexiones.`} className="h-[440px] w-full sm:h-[620px]" />
      {!mapaListo && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Cargando el mapa…</p>}
    </div>
  );
}
