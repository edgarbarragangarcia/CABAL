"use client";

import * as React from "react";
import type { ECharts, EChartsOption } from "echarts";

import { useTheme } from "@/components/animations/theme-provider";
import { SPACING, layoutNetwork } from "@/lib/crm/layout";
import type { Network } from "@/lib/crm/network";
import { DIMENSION_LABEL } from "@/lib/crm/types";

type Theme = "light" | "dark";
type Positions = Map<number, [number, number]>;

/**
 * Colores de comunidad, validados en TODAS las parejas (en una red
 * cualquier grupo puede quedar junto a otro), en claro y en oscuro: solo
 * pasan tres tonos. Las demás comunidades van en gris; se distinguen por
 * su racimo, la lista de comunidades y al elegir una.
 */
const COMMUNITY_COLORS: Record<Theme, string[]> = {
  light: ["#2a78d6", "#eb6834", "#1baf7a"],
  dark: ["#3987e5", "#d95926", "#199e70"],
};
export const OTHER_COMMUNITY_COLOR = "#898781";

export function communityColor(community: number, theme: Theme) {
  return COMMUNITY_COLORS[theme][community] ?? OTHER_COMMUNITY_COLOR;
}

/** Los mismos --surface y --foreground de globals.css. */
const CHROME: Record<Theme, { surface: string; ink: string }> = {
  light: { surface: "#ffffff", ink: "#16170f" },
  dark: { surface: "#0e1211", ink: "#f2efe7" },
};

const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

// Los nombres vienen del CRM y el tooltip de ECharts es HTML: siempre escapados.
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Hovered = { dataType?: string; dataIndex: number };

/**
 * `size` = diámetro base en píxeles: sale del espacio que queda entre vecinos
 * una vez que la red se ajusta al lienzo, para que los puntos no se encimen.
 */
function nodeData(
  network: Network,
  visible: number[],
  theme: Theme,
  positions: Positions,
  size: number,
  selected: number | null
) {
  const { nodes, communities } = network;
  const maxStrength = Math.max(1, ...visible.map((i) => nodes[i].strength));
  // Nombre solo en el centro de cada comunidad grande: etiquetas selectivas, no una por punto.
  const labelled = new Set(communities.slice(0, 8).map((c) => c.hub));
  return visible.map((i) => {
    const node = nodes[i];
    const [x, y] = positions.get(i) ?? [0, 0];
    const isSelected = i === selected;
    return {
      id: String(i),
      name: node.name,
      x,
      y,
      symbol: node.referred.length ? "diamond" : "circle",
      symbolSize: size * (1 + 1.2 * Math.sqrt(node.strength / maxStrength)) * (isSelected ? 1.4 : 1),
      itemStyle: {
        color: communityColor(node.community, theme),
        borderColor: isSelected ? CHROME[theme].ink : CHROME[theme].surface,
        borderWidth: isSelected ? 2.5 : 1.5,
      },
      label: { show: isSelected || labelled.has(i) },
    };
  });
}

function buildOption(
  network: Network,
  visible: number[],
  theme: Theme,
  positions: Positions,
  size: number
): EChartsOption {
  const { surface, ink } = CHROME[theme];
  const { nodes, edges } = network;
  const shown = new Set(visible);
  const linkEdges = edges.flatMap((e, k) => (shown.has(e.a) && shown.has(e.b) ? [k] : []));

  const tooltip = (p: Hovered) => {
    if (p.dataType === "edge") {
      const e = edges[linkEdges[p.dataIndex]];
      const [a, b] = [esc(nodes[e.a].name), esc(nodes[e.b].name)];
      const lines = e.shared.map((t) => `${DIMENSION_LABEL[t.dim]}: <b>${esc(t.value)}</b>`);
      if (e.referral) lines.unshift(`${a} trajo a ${b}`);
      return `<b>${a}</b> ↔ <b>${b}</b><br/>${lines.join("<br/>")}`;
    }
    const node = nodes[visible[p.dataIndex]];
    const lines = [
      `Grupo ${node.community + 1} · ${node.degree} conexiones`,
      ...(node.referred.length ? [`Trajo a ${node.referred.length}`] : []),
      ...node.traits.slice(0, 3).map((t) => `${esc(t.field)}: ${esc(t.value)}`),
    ];
    return `<b>${esc(node.name)}</b><br/>${lines.join("<br/>")}`;
  };

  return {
    tooltip: {
      confine: true,
      backgroundColor: surface,
      borderColor: withAlpha(ink, 0.12),
      textStyle: { color: ink, fontSize: 12 },
      extraCssText: "border-radius:12px;max-width:280px;white-space:normal;box-shadow:0 8px 24px -8px rgba(0,0,0,.25);",
      formatter: (p) => tooltip(p as unknown as Hovered),
    },
    series: [
      {
        id: "red",
        type: "graph",
        layout: "none",
        // Sin esto, ECharts 6 estira el dibujo al lienzo y los puntos quedan ovalados.
        preserveAspect: "contain",
        roam: true,
        scaleLimit: { min: 0.4, max: 8 },
        left: 28,
        right: 28,
        top: 28,
        bottom: 28,
        animationDuration: 250,
        animationDurationUpdate: 1300,
        animationEasingUpdate: "cubicInOut",
        data: nodeData(network, visible, theme, positions, size, null),
        // Vínculos dentro de un grupo en su color; los que cruzan grupos, apenas visibles
        // (se ven completos al pasar el mouse); los referidos, con flecha.
        links: linkEdges.map((k) => {
          const e = edges[k];
          const [ca, cb] = [nodes[e.a].community, nodes[e.b].community];
          const lineStyle = e.referral
            ? { width: 1.1, color: withAlpha(ink, ca === cb ? 0.45 : 0.16) }
            : ca === cb
              ? { width: 0.6 + 1.4 * e.similarity, color: withAlpha(communityColor(ca, theme), 0.2 + 0.35 * e.similarity) }
              : { width: 0.5, color: withAlpha(ink, 0.07) };
          return {
            source: String(e.a),
            target: String(e.b),
            symbol: e.referral ? ["none", "arrow"] : ["none", "none"],
            lineStyle,
          };
        }),
        edgeSymbolSize: 6,
        label: {
          position: "right",
          fontSize: 11,
          fontWeight: 600,
          color: ink,
          textBorderColor: surface,
          textBorderWidth: 3,
        },
        emphasis: {
          focus: "adjacency",
          label: { show: true },
          lineStyle: { width: 2, color: withAlpha(ink, 0.7) },
        },
        blur: { itemStyle: { opacity: 0.12 }, lineStyle: { opacity: 0.04 }, label: { show: false } },
      },
    ],
  };
}

/** Diámetro base: ~70% del espacio entre vecinos una vez ajustada la red al lienzo (entre 4 y 11 px). */
function baseSize(positions: Positions, width: number, height: number) {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of positions.values()) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const unit = Math.min((width - 56) / Math.max(maxX - minX, 1), (height - 56) / Math.max(maxY - minY, 1));
  return Math.max(4, Math.min(11, SPACING * unit * 0.7));
}

/**
 * La red dibujada con ECharts. Cada comunidad es un racimo; al cargar,
 * cada persona sale del centro de su racimo hacia su lugar y la red "se
 * forma" en pantalla. Clic en un punto = elegir a esa persona.
 */
export function RedCrmGraph({
  network,
  visible,
  selected,
  onSelect,
}: {
  network: Network;
  /** Índices de `network.nodes` que se dibujan. */
  visible: number[];
  selected: number | null;
  onSelect: (node: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [chart, setChart] = React.useState<ECharts | null>(null);
  const { resolvedTheme } = useTheme();
  const placed = React.useRef<{ final: Positions; size: number } | null>(null);
  const select = React.useEffectEvent((node: number) => onSelect(node));
  // Nodos en su lugar final, con la persona elegida marcada y sus vínculos resaltados.
  const settle = React.useEffectEvent(() => {
    if (!chart || !placed.current) return;
    const { final, size } = placed.current;
    chart.setOption({ series: [{ id: "red", data: nodeData(network, visible, resolvedTheme, final, size, selected) }] });
    chart.dispatchAction({ type: "downplay", seriesIndex: 0 });
    const pos = selected === null ? -1 : visible.indexOf(selected);
    if (pos >= 0) chart.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex: pos });
  });

  React.useEffect(() => {
    let disposed = false;
    let instance: ECharts | null = null;
    let observer: ResizeObserver | null = null;
    (async () => {
      const echarts = await import("echarts");
      if (disposed || !ref.current) return;
      instance = echarts.init(ref.current);
      instance.on("click", (p) => {
        if (p.dataType === "node") select(Number((p.data as { id: string }).id));
      });
      observer = new ResizeObserver(() => instance?.resize());
      observer.observe(ref.current);
      setChart(instance);
    })();
    return () => {
      disposed = true;
      observer?.disconnect();
      instance?.dispose();
    };
  }, []);

  React.useEffect(() => {
    if (!chart || !ref.current) return;
    const { clientWidth, clientHeight } = ref.current;
    const { start, final } = layoutNetwork(network, visible, clientHeight ? clientWidth / clientHeight : 1.6);
    const size = baseSize(final, clientWidth, clientHeight);
    placed.current = { final, size };
    // Primero todos en el centro de su racimo; enseguida, cada uno a su lugar (animado).
    chart.setOption(buildOption(network, visible, resolvedTheme, start, size), { notMerge: true });
    const timer = setTimeout(settle, 80);
    return () => clearTimeout(timer);
  }, [chart, network, visible, resolvedTheme]);

  React.useEffect(() => {
    settle();
  }, [chart, selected]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Red de ${visible.length} contactos. La lista de comunidades y el detalle de cada persona están al lado.`}
      className="h-[440px] w-full sm:h-[560px]"
    />
  );
}
