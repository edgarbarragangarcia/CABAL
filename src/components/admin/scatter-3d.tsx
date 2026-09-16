"use client";

import * as React from "react";
import type { ECharts } from "echarts";

export type Scatter3DPoint = {
  date: string; // "YYYY-MM-DD"
  platform: string;
  engagement: number;
  color: string;
  label: string;
};

/**
 * Dispersión 3D (tiempo × plataforma × interacción) con echarts-gl.
 * Se carga en el cliente únicamente (WebGL necesita `document`/`window`,
 * así que la librería se importa dentro de un efecto, no en el módulo).
 */
export function Scatter3D({ points, platforms }: { points: Scatter3DPoint[]; platforms: string[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const chartRef = React.useRef<ECharts | null>(null);

  React.useEffect(() => {
    let disposed = false;

    (async () => {
      const echarts = await import("echarts");
      await import("echarts-gl");
      if (disposed || !ref.current) return;

      const chart = echarts.init(ref.current);
      chartRef.current = chart;

      chart.setOption({
        tooltip: {
          formatter: (p: { data: { name: string; value: [number, number, number] } }) => {
            const [ts, platIdx, value] = p.data.value;
            const date = new Date(ts).toLocaleDateString("es-CO");
            return `${p.data.name}<br/>${date} · ${platforms[platIdx]}<br/>Interacción: ${value.toLocaleString(
              "es-CO"
            )}`;
          },
        },
        xAxis3D: { type: "time", name: "Fecha", nameTextStyle: { color: "#71717a" } },
        yAxis3D: {
          type: "category",
          data: platforms,
          name: "Plataforma",
          nameTextStyle: { color: "#71717a" },
        },
        zAxis3D: { type: "value", name: "Interacción", nameTextStyle: { color: "#71717a" } },
        grid3D: {
          viewControl: { autoRotate: true, autoRotateSpeed: 5, distance: 180 },
          light: { main: { intensity: 1.2 }, ambient: { intensity: 0.4 } },
        },
        series: [
          {
            type: "scatter3D",
            symbolSize: 10,
            data: points.map((p) => ({
              name: p.label,
              value: [new Date(`${p.date}T00:00:00`).getTime(), platforms.indexOf(p.platform), p.engagement],
              itemStyle: { color: p.color, opacity: 0.9 },
            })),
          },
        ],
      });
    })();

    const onResize = () => chartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [points, platforms]);

  return <div ref={ref} className="h-[420px] w-full" />;
}
