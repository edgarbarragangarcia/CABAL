"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { scaleSequential } from "d3-scale";
import {
  interpolateBlues,
  interpolateGreens,
  interpolateOranges,
  interpolatePurples,
  interpolateReds,
  interpolateRdPu,
} from "d3-scale-chromatic";
import {
  ExternalLink,
  GraduationCap,
  Landmark,
  Lightbulb,
  MousePointerClick,
  Palette,
  Scale,
  ShieldAlert,
  Siren,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { MAP_VIEWBOX, type ColombiaDashboardData, type DashboardTopicId } from "./types";

const TOPIC_META: Record<
  DashboardTopicId,
  { icon: React.ElementType; interpolator: (t: number) => string }
> = {
  violencia: { icon: ShieldAlert, interpolator: interpolateReds },
  economia: { icon: TrendingUp, interpolator: interpolateGreens },
  gobierno: { icon: Landmark, interpolator: interpolateBlues },
  corrupcion: { icon: Scale, interpolator: interpolatePurples },
  educacion: { icon: GraduationCap, interpolator: interpolateOranges },
  hurtos: { icon: Siren, interpolator: interpolateRdPu },
};

function formatValue(value: number, unit: string): string {
  if (unit === "casos") return `${value.toLocaleString("es-CO")} casos`;
  if (unit === "miles de millones COP")
    return `$${value.toLocaleString("es-CO", { maximumFractionDigits: 0 })} mil M`;
  if (unit === "puntos") return `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })} / 100`;
  if (unit === "%") return `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
  return value.toLocaleString("es-CO");
}

export function ColombiaDashboardClient({ shapes, topics }: ColombiaDashboardData) {
  const [activeTopicId, setActiveTopicId] = React.useState<DashboardTopicId>(topics[0].id);
  const [selectedCode, setSelectedCode] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState<{ code: string; x: number; y: number } | null>(
    null
  );

  const activeTopic = topics.find((t) => t.id === activeTopicId)!;
  const valueByCode = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const d of activeTopic.data) map.set(d.code, d.value);
    return map;
  }, [activeTopic]);

  const [min, max] = React.useMemo(() => {
    const values = activeTopic.data.map((d) => d.value);
    return [Math.min(...values, 0), Math.max(...values, 1)];
  }, [activeTopic]);

  const colorScale = React.useMemo(
    () => scaleSequential(TOPIC_META[activeTopicId].interpolator).domain([min, max]),
    [activeTopicId, min, max]
  );

  const ranked = React.useMemo(
    () => [...activeTopic.data].sort((a, b) => b.value - a.value),
    [activeTopic]
  );

  const selected = selectedCode
    ? topics.map((t) => ({
        topic: t,
        datum: t.data.find((d) => d.code === selectedCode),
      }))
    : null;
  const selectedName = selected?.find((s) => s.datum)?.datum?.name;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
        {/* Selector de tema */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {topics.map((topic) => {
            const Icon = TOPIC_META[topic.id].icon;
            const isActive = topic.id === activeTopicId;
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => setActiveTopicId(topic.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {topic.label}
              </button>
            );
          })}
        </div>

        {/* Explicación en lenguaje sencillo, cambia según el tema seleccionado */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTopicId}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mb-4 flex items-start gap-2.5 rounded-xl bg-surface-muted p-4 text-sm text-muted-foreground"
          >
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <p>{activeTopic.explainer}</p>
          </motion.div>
        </AnimatePresence>

        {/* Instrucciones de uso: siempre visibles, no cambian con el tema */}
        <div className="mb-4 grid gap-2 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <Palette className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
            Color más oscuro = valor más alto en ese tema.
          </p>
          <p className="flex items-center gap-2">
            <MousePointerClick className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
            Toca un departamento para ver su detalle completo.
          </p>
        </div>

        <div className="relative">
          <svg
            viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
            className="mx-auto w-full max-w-md"
            role="img"
            aria-label={`Mapa de Colombia por departamento — ${activeTopic.label}`}
          >
            {shapes.map((shape) => {
              const value = valueByCode.get(shape.code);
              const isSelected = shape.code === selectedCode;
              const isHovered = hovered?.code === shape.code;
              return (
                <motion.path
                  key={shape.code}
                  d={shape.d}
                  fill={value !== undefined ? colorScale(value) : "var(--surface-muted)"}
                  stroke={isSelected || isHovered ? "var(--foreground)" : "var(--background)"}
                  strokeWidth={isSelected ? 1.75 : 0.75}
                  className="cursor-pointer transition-[stroke-width] duration-150"
                  onMouseMove={(e) =>
                    setHovered({ code: shape.code, x: e.clientX, y: e.clientY })
                  }
                  onMouseLeave={() => setHovered(null)}
                  onClick={() =>
                    setSelectedCode((prev) => (prev === shape.code ? null : shape.code))
                  }
                  whileHover={{ scale: 1.01 }}
                  style={{ transformOrigin: `${shape.centroid[0]}px ${shape.centroid[1]}px` }}
                />
              );
            })}
          </svg>

          {hovered && (
            <div
              className="pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-border bg-foreground px-3 py-2 text-xs text-background shadow-xl"
              style={{ left: hovered.x, top: hovered.y }}
            >
              <p className="font-semibold">
                {shapes.find((s) => s.code === hovered.code)?.name}
              </p>
              {valueByCode.has(hovered.code) ? (
                <p className="text-background/70">
                  {formatValue(valueByCode.get(hovered.code)!, activeTopic.unit)}
                </p>
              ) : (
                <p className="text-background/70">Sin datos</p>
              )}
            </div>
          )}
        </div>

        {/* Leyenda */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{min.toLocaleString("es-CO")}</span>
          <div
            className="h-2 flex-1 rounded-full"
            style={{
              background: `linear-gradient(to right, ${TOPIC_META[activeTopicId].interpolator(0.05)}, ${TOPIC_META[
                activeTopicId
              ].interpolator(0.95)})`,
            }}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">{max.toLocaleString("es-CO")}</span>
        </div>
        <p className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground/80">
          <span>{activeTopic.lowLabel}</span>
          <span>{activeTopic.highLabel}</span>
        </p>

        <p className="mt-3 text-xs text-muted-foreground">{activeTopic.unitExplainer}</p>

        <p className="mt-4 text-xs text-muted-foreground">
          Fuente: {activeTopic.source} · Datos {activeTopic.year} ·{" "}
          <a
            href={activeTopic.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-brand hover:underline"
          >
            ver en datos.gov.co
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selectedCode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Departamento seleccionado
              </p>
              <h3 className="mt-1 text-xl font-semibold">{selectedName}</h3>
              <dl className="mt-4 flex flex-col gap-3">
                {selected.map(({ topic, datum }) => {
                  const Icon = TOPIC_META[topic.id].icon;
                  return (
                    <div
                      key={topic.id}
                      className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3"
                    >
                      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon className="size-4" aria-hidden="true" />
                        {topic.label}
                      </dt>
                      <dd className="text-sm font-semibold">
                        {datum ? formatValue(datum.value, topic.unit) : "Sin datos"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
            >
              Toca cualquier departamento en el mapa (o en la lista de abajo) para ver sus
              tres cifras en detalle.
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {activeTopic.highLabel} · {activeTopic.label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Departamentos ordenados de mayor a menor, según los datos de {activeTopic.year}.
          </p>
          <ol className="mt-4 flex flex-col gap-3">
            {ranked.slice(0, 8).map((d, i) => {
              const barWidth = ranked[0] ? Math.max((d.value / ranked[0].value) * 100, 3) : 0;
              return (
                <li key={d.code}>
                  <button
                    type="button"
                    onClick={() => setSelectedCode(d.code)}
                    className="group flex w-full flex-col gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 shrink-0 text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm">{d.name}</span>
                      <span className="shrink-0 text-sm font-semibold">
                        {formatValue(d.value, activeTopic.unit)}
                      </span>
                    </div>
                    <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: TOPIC_META[activeTopicId].interpolator(0.75) }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${barWidth}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
