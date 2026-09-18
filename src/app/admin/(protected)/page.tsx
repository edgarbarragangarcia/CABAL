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
  type Platform,
  type SentimentFilter,
} from "@/lib/social-trends-mock";

/** Fracción combinada de menciones cuando se eligen varias plataformas a
 * la vez (para comparar, ej. Instagram + Facebook). Vacío = todas. */
function multiPlatformShare(selected: Platform[]): number {
  if (selected.length === 0) return 1;
  return selected.reduce((sum, p) => sum + platformShare(p), 0);
}

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

const ALL_PLATFORMS: Platform[] = ["X", "Facebook", "Instagram", "YouTube"];

function PlatformMultiSelect({
  selected,
  onToggle,
}: {
  selected: Platform[];
  onToggle: (p: Platform) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-background p-1">
      {ALL_PLATFORMS.map((p) => {
        const active = selected.includes(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => onToggle(p)}
            className={
              active
                ? "rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground"
                : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

export default function CentroDeControlPage() {
  const [platforms, setPlatforms] = React.useState<Platform[]>([]);
  const [sentimentFilter, setSentimentFilter] = React.useState<SentimentFilter>("todos");
  const [selectedDate, setSelectedDate] = React.useState<string>("");
  const [messageFilter, setMessageFilter] = React.useState<string>("todos");
  const uniqueMessages = React.useMemo(
    () => [...new Set(samplePosts.map((p) => p.excerpt))],
    []
  );

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  // Combina las dos fracciones: filtrar por plataforma(s) Y por
  // sentimiento reduce las menciones simuladas por ambas a la vez, igual
  // que pasaría con datos reales.
  const share = multiPlatformShare(platforms) * sentimentShare(sentimentFilter);
  const dailyMentions = React.useMemo(() => {
    const base = getDailyMentions(RANGE_DAYS["30d"]);
    return base.map((d) => ({ ...d, mentions: Math.round(d.mentions * share) }));
  }, [share]);

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

  // Sin filtro de mensaje: muestra el tema con más tracción en general.
  // Con un mensaje elegido: en vez del tema, muestra en cuántas
  // plataformas se publicó ese mismo mensaje y cuánto sumó entre todas —
  // eso es lo que permite comparar Instagram vs. Facebook para un mismo
  // contenido.
  const activeTopic = trendingTopics[0];
  const activeTopicMentions = Math.round(activeTopic.mentions * share);

  const messagePosts =
    messageFilter === "todos" ? [] : samplePosts.filter((p) => p.excerpt === messageFilter);
  const messagePlatforms = [...new Set(messagePosts.map((p) => p.platform))];
  const messageTotalMentions = messagePosts.reduce((a, p) => a + p.mentions, 0);

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
      (platforms.length === 0 || platforms.includes(p.platform)) &&
      (sentimentFilter === "todos" || p.sentiment === sentimentFilter) &&
      (!selectedDate || p.date === selectedDate) &&
      (messageFilter === "todos" || p.excerpt === messageFilter)
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
            <PlatformMultiSelect selected={platforms} onToggle={togglePlatform} />
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
              value={messageFilter}
              onChange={(e) => setMessageFilter(e.target.value)}
              className="h-8 max-w-[220px] rounded-full border border-border bg-background px-3 text-xs font-medium outline-none focus:border-brand"
            >
              <option value="todos">Todos los mensajes</option>
              {uniqueMessages.map((msg) => (
                <option key={msg} value={msg}>
                  {msg.length > 60 ? `${msg.slice(0, 60)}…` : msg}
                </option>
              ))}
            </select>
            <span className="ml-auto flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
              <FlaskConical className="size-3" aria-hidden="true" />
              Datos simulados — vista previa
            </span>
          </div>
          {platforms.length > 1 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Comparando {platforms.join(" + ")}: los números de abajo suman ambas plataformas.
            </p>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={MessagesSquare}
              label={selectedDayLabel ? `Menciones (${selectedDayLabel})` : "Menciones (30 días)"}
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
            {messageFilter === "todos" ? (
              <StatCard
                icon={Hash}
                label="Iniciativa con más tracción"
                value={activeTopic.tag}
                hint={`${activeTopicMentions.toLocaleString("es-CO")} menciones`}
              />
            ) : (
              <StatCard
                icon={Hash}
                label="Mensaje comparado"
                value={
                  messagePlatforms.length > 1
                    ? `En ${messagePlatforms.length} plataformas`
                    : (messagePlatforms[0] ?? "Sin datos")
                }
                hint={`${messageTotalMentions.toLocaleString("es-CO")} menciones en total · ${messagePlatforms.join(", ")}`}
              />
            )}
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
              <li key={i} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${PLATFORM_DOT[post.platform] ?? "bg-zinc-400"}`}
                    />
                    {post.platform} · {post.date}
                  </span>
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
                </div>
                {/* El mensaje real es lo principal — el tema queda como
                    referencia secundaria, no como lo más visible. */}
                <p className="mt-1 text-foreground">{post.excerpt}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{post.topic}</p>
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
