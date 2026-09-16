"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FlaskConical,
  Gauge,
  GraduationCap,
  Hash,
  MapPin,
  MessagesSquare,
  Plus,
  Sparkles,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

import { BarList, DonutChart, TrendArea } from "@/components/admin/charts";
import { ColombiaHeatmap } from "@/components/admin/colombia-heatmap";
import { DashboardGrid, type DashboardWidget } from "@/components/admin/dashboard-grid";
import {
  RANGE_DAYS,
  getDailyMentions,
  getDepartmentMentions,
  getDepartmentSentiment,
  getDepartmentTopTopic,
  platformBreakdown,
  platformShare,
  samplePosts,
  sentimentBreakdown,
  sentimentShare,
  trendingTopics,
  type DateRange,
  type PlatformFilter,
  type SentimentFilter,
} from "@/lib/social-trends-mock";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "brand" | "accent";
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      <div
        className={
          tone === "brand"
            ? "pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-brand/10 blur-2xl transition-transform group-hover:scale-125"
            : "pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-accent/15 blur-2xl transition-transform group-hover:scale-125"
        }
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={
              tone === "brand"
                ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"
                : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"
            }
          >
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 py-2 text-sm">
      {ok ? (
        <CheckCircle2 className="size-4 shrink-0 text-brand" aria-hidden="true" />
      ) : (
        <CircleAlert className="size-4 shrink-0 text-accent" aria-hidden="true" />
      )}
      <span className="text-foreground">{label}</span>
    </li>
  );
}

const PLATFORM_DOT: Record<string, string> = {
  X: "bg-[#0f6b4c]",
  Facebook: "bg-[#22c58a]",
  Instagram: "bg-[#ffb020]",
  YouTube: "bg-zinc-400",
};

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
];

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={
            opt.value === value
              ? "rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
              : "rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function CentroDeControlPage() {
  const [range, setRange] = React.useState<DateRange>("30d");
  const [platform, setPlatform] = React.useState<PlatformFilter>("todas");
  const [sentimentFilter, setSentimentFilter] = React.useState<SentimentFilter>("todos");
  const [selectedDate, setSelectedDate] = React.useState<string>("");
  const [topicFilter, setTopicFilter] = React.useState<string>("todos");

  // Combina las dos fracciones: filtrar por plataforma Y por sentimiento
  // reduce las menciones simuladas por ambas a la vez, igual que pasaría
  // con datos reales — antes solo la plataforma afectaba estas cifras y
  // el filtro de sentimiento quedaba sin efecto en las tarjetas de arriba.
  const share = platformShare(platform) * sentimentShare(sentimentFilter);
  const dailyMentions = React.useMemo(() => {
    const base = getDailyMentions(RANGE_DAYS[range]);
    return base.map((d) => ({ ...d, mentions: Math.round(d.mentions * share) }));
  }, [range, share]);

  // "dd/mm" (mismo formato que dailyMentions) a partir de la fecha exacta
  // elegida en el filtro, para poder mostrar solo ese día en vez del rango.
  const selectedDayLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
      })
    : null;
  const selectedDayMentions = selectedDayLabel
    ? dailyMentions.find((d) => d.date === selectedDayLabel)
    : null;

  const totalMentions = selectedDayMentions
    ? selectedDayMentions.mentions
    : dailyMentions.reduce((a, d) => a + d.mentions, 0);
  const last = dailyMentions[dailyMentions.length - 1].mentions;
  const prev = dailyMentions[dailyMentions.length - 2]?.mentions ?? last;
  const dayDeltaPct = prev ? Math.round(((last - prev) / prev) * 100) : 0;

  // El sentimiento promedio de la serie diaria es independiente del
  // filtro de sentimiento (cada día trae un único puntaje simulado, no un
  // desglose) — si el usuario ya filtró por un sentimiento específico, la
  // tarjeta debe mostrar ESE sentimiento, no recalcular uno ajeno al filtro.
  const rawAvgSentiment =
    dailyMentions.reduce((a, d) => a + d.sentiment, 0) / dailyMentions.length;
  const sentimentLabel =
    sentimentFilter === "todos"
      ? rawAvgSentiment >= 0
        ? "Positivo"
        : "Negativo"
      : sentimentFilter[0].toUpperCase() + sentimentFilter.slice(1);
  const sentimentHint =
    sentimentFilter === "todos"
      ? `índice ${rawAvgSentiment.toFixed(2)} (-1 a 1)`
      : `${Math.round(sentimentShare(sentimentFilter) * 100)}% de las menciones`;

  const departmentValues = React.useMemo(
    () => getDepartmentMentions(totalMentions),
    [totalMentions]
  );

  // El tema en tendencia no es siempre el mismo cuando hay un filtro de
  // tema activo: se muestra ESE tema (y sus menciones, escaladas por la
  // misma fracción de plataforma que el resto del panel), no el más
  // popular en general.
  const activeTopic =
    topicFilter === "todos"
      ? trendingTopics[0]
      : (trendingTopics.find((t) => t.tag === topicFilter) ?? trendingTopics[0]);
  const activeTopicMentions = Math.round(activeTopic.mentions * share);

  const departmentsSorted = React.useMemo(
    () => Object.entries(departmentValues).sort((a, b) => b[1] - a[1]),
    [departmentValues]
  );

  const [selectedDept, setSelectedDept] = React.useState<string | null>(null);
  const selectedRank = selectedDept
    ? departmentsSorted.findIndex(([name]) => name === selectedDept) + 1
    : 0;
  const selectedMentions = selectedDept ? departmentValues[selectedDept] ?? 0 : 0;
  const selectedShareOfTotal = totalMentions
    ? Math.round((selectedMentions / totalMentions) * 100)
    : 0;

  const filteredPosts = samplePosts.filter(
    (p) =>
      (platform === "todas" || p.platform === platform) &&
      (sentimentFilter === "todos" || p.sentiment === sentimentFilter) &&
      (!selectedDate || p.date === selectedDate) &&
      (topicFilter === "todos" || p.topic === topicFilter)
  );

  const widgets: DashboardWidget[] = [
    {
      id: "resumen",
      title: "Resumen y filtros",
      icon: BarChart3,
      defaultWide: true,
      content: (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-muted p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              Filtros
            </span>
            <SegmentedControl value={range} onChange={setRange} options={RANGE_OPTIONS} />
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlatformFilter)}
              className="h-8 rounded-full border border-border bg-background px-3 text-xs font-medium outline-none focus:border-brand"
            >
              <option value="todas">Todas las plataformas</option>
              {platformBreakdown.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value as SentimentFilter)}
              className="h-8 rounded-full border border-border bg-background px-3 text-xs font-medium outline-none focus:border-brand"
            >
              <option value="todos">Todo el sentimiento</option>
              <option value="positivo">Positivo</option>
              <option value="neutral">Neutral</option>
              <option value="negativo">Negativo</option>
            </select>
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="h-8 rounded-full border border-border bg-background px-3 text-xs font-medium outline-none focus:border-brand"
            >
              <option value="todos">Todos los temas</option>
              {trendingTopics.map((t) => (
                <option key={t.tag} value={t.tag}>
                  {t.tag}
                </option>
              ))}
            </select>
            <label className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium">
              <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent outline-none [color-scheme:light] dark:[color-scheme:dark]"
                aria-label="Filtrar publicaciones por fecha exacta"
              />
            </label>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3" aria-hidden="true" />
                Quitar fecha
              </button>
            )}
            <span className="ml-auto flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
              <FlaskConical className="size-3" aria-hidden="true" />
              Datos simulados — vista previa
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={MessagesSquare}
              label={
                selectedDayLabel
                  ? `Menciones (${selectedDayLabel})`
                  : `Menciones (${RANGE_OPTIONS.find((o) => o.value === range)?.label})`
              }
              value={totalMentions.toLocaleString("es-CO")}
              hint={selectedDayLabel ? "de ese día" : `${dayDeltaPct >= 0 ? "+" : ""}${dayDeltaPct}% vs. ayer`}
            />
            <StatCard
              icon={Gauge}
              label="Sentimiento promedio"
              value={sentimentLabel}
              hint={sentimentHint}
              tone="accent"
            />
            <StatCard
              icon={Hash}
              label={topicFilter === "todos" ? "Iniciativa con más tracción" : "Tema filtrado"}
              value={activeTopic.tag}
              hint={`${activeTopicMentions.toLocaleString("es-CO")} menciones${
                topicFilter === "todos"
                  ? ""
                  : ` · ${activeTopic.deltaPct >= 0 ? "+" : ""}${activeTopic.deltaPct}% vs. semana anterior`
              }`}
            />
          </div>
        </>
      ),
    },
    {
      id: "menciones-dia",
      title: "Menciones por día",
      icon: TrendingUp,
      content: (
        <>
          <TrendArea data={dailyMentions.map((d) => ({ label: d.date, value: d.mentions }))} />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{dailyMentions[0].date}</span>
            <span>{dailyMentions[dailyMentions.length - 1].date}</span>
          </div>
        </>
      ),
    },
    {
      id: "sentimiento",
      title: "Sentimiento",
      icon: Gauge,
      content: <DonutChart slices={sentimentBreakdown} />,
    },
    {
      id: "temas-tendencia",
      title: "Temas en tendencia",
      icon: Hash,
      content: (
        <BarList
          items={trendingTopics.map((t) => ({
            label: t.tag,
            value: t.mentions,
            hint: `${t.deltaPct >= 0 ? "+" : ""}${t.deltaPct}%`,
          }))}
        />
      ),
    },
    {
      id: "distribucion-plataforma",
      title: "Distribución por plataforma",
      icon: BarChart3,
      content: <DonutChart slices={platformBreakdown} />,
    },
    {
      id: "menciones-departamento",
      title: "Menciones por departamento",
      icon: MapPin,
      defaultWide: true,
      content: (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <ColombiaHeatmap
            values={departmentValues}
            selected={selectedDept}
            onSelect={(name) => setSelectedDept((prev) => (prev === name ? null : name))}
          />

          <div className="flex flex-col gap-3">
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
              {departmentsSorted.map(([name, value]) => (
                <label
                  key={name}
                  className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-xs last:border-b-0 hover:bg-surface-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedDept === name}
                    onChange={() => setSelectedDept((prev) => (prev === name ? null : name))}
                    className="size-3.5 shrink-0 accent-brand"
                  />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {value.toLocaleString("es-CO")}
                  </span>
                </label>
              ))}
            </div>

            {selectedDept ? (
              <div className="rounded-xl border border-border bg-surface-muted p-3">
                <p className="text-sm font-semibold">{selectedDept}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  #{selectedRank} de {departmentsSorted.length} · {selectedShareOfTotal}% del
                  total nacional
                </p>

                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {selectedMentions.toLocaleString("es-CO")}
                </p>
                <p className="text-[11px] text-muted-foreground">menciones en el periodo</p>

                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sentimiento estimado
                  </p>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full">
                    {getDepartmentSentiment(selectedDept).map((s) => (
                      <span
                        key={s.label}
                        style={{ width: `${s.value}%`, backgroundColor: s.color }}
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    {getDepartmentSentiment(selectedDept).map((s) => (
                      <span key={s.label}>
                        {s.label} {s.value}%
                      </span>
                    ))}
                  </div>
                </div>

                <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Tema con más tracción aquí
                </p>
                <p className="text-xs font-medium text-brand">
                  {getDepartmentTopTopic(selectedDept).tag}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                Marca un departamento para ver su detalle.
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "publicaciones-ejemplo",
      title: "Publicaciones de ejemplo",
      icon: MessagesSquare,
      defaultWide: true,
      content: (
        <>
          {filteredPosts.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Ninguna publicación de ejemplo coincide con estos filtros.
            </p>
          )}
          <ul className="-my-1 divide-y divide-border">
            {filteredPosts.map((post, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${PLATFORM_DOT[post.platform] ?? "bg-zinc-400"}`}
                  />
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {post.platform} · {post.date}
                  </span>
                  <span className="truncate text-muted-foreground">{post.excerpt}</span>
                  <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
                    {post.topic}
                  </span>
                </div>
                <span
                  className={
                    post.sentiment === "positivo"
                      ? "flex shrink-0 items-center gap-1 text-xs font-medium text-brand"
                      : post.sentiment === "negativo"
                        ? "flex shrink-0 items-center gap-1 text-xs font-medium text-destructive"
                        : "flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground"
                  }
                >
                  {post.sentiment === "negativo" ? (
                    <TrendingDown className="size-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingUp className="size-3.5" aria-hidden="true" />
                  )}
                  {post.mentions.toLocaleString("es-CO")}
                </span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      id: "accesos-rapidos",
      title: "Accesos rápidos",
      icon: Sparkles,
      content: (
        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/admin/lms"
            className="flex items-center gap-2.5 rounded-xl border border-border p-3 text-sm font-medium transition-colors hover:border-brand hover:bg-brand-soft"
          >
            <GraduationCap className="size-4 text-brand" aria-hidden="true" />
            Gestionar el LMS
          </Link>
          <Link
            href="/admin/lms?nuevo=1"
            className="flex items-center gap-2.5 rounded-xl border border-border p-3 text-sm font-medium transition-colors hover:border-brand hover:bg-brand-soft"
          >
            <Plus className="size-4 text-brand" aria-hidden="true" />
            Crear un curso
          </Link>
        </div>
      ),
    },
    {
      id: "estado-sistema",
      title: "Estado del sistema",
      icon: CheckCircle2,
      content: (
        <>
          <ul className="-my-2 divide-y divide-border">
            <StatusRow ok label="Acceso: usuario fijo, sin base de datos" />
            <StatusRow ok={false} label="Base de datos: no configurada" />
            <StatusRow ok label="LMS: guardado local en este navegador" />
            <StatusRow ok={false} label="Tendencias de redes: datos simulados" />
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Los cursos que crees aquí solo se guardan en este navegador. Para
            compartirlos entre dispositivos o usuarios, hace falta conectar
            una base de datos real.
          </p>
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro de control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu tablero de decisiones — arrastra, achica/amplía o quita los widgets a tu gusto.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-muted"
        >
          Ver el sitio
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-6">
        <DashboardGrid widgets={widgets} storageKey="centro-control-layout-v1" />
      </div>
    </div>
  );
}
