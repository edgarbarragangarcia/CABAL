"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  FlaskConical,
  Gauge,
  Heart,
  MessagesSquare,
  Radar,
  Share2,
  Sparkles,
  Trophy,
} from "lucide-react";

import { BarList, DonutChart, TrendArea } from "@/components/admin/charts";
import { Scatter3D } from "@/components/admin/scatter-3d";
import {
  compareByMetric,
  getEngagementSummary,
  getPostingFrequency,
  getPublicationsByPolitician,
  getSentimentBreakdown,
  getTopicBreakdown,
  getWeeklyPostingTrend,
  POLITICIANS,
  type Platform,
  type PoliticianId,
} from "@/lib/publications-analysis";

const PLATFORMS: Platform[] = ["X", "Facebook", "Instagram", "YouTube"];
const SENTIMENT_COLOR: Record<string, string> = {
  positivo: "#22c58a",
  neutral: "#94a3b8",
  negativo: "#f97066",
};

function Panel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-5 shadow-sm ${className ?? ""}`}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 text-brand" aria-hidden="true" />
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="size-3.5 text-brand" aria-hidden="true" />
      </div>
      <p className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

const METRIC_OPTIONS = [
  { value: "engagementRate" as const, label: "Tasa de interacción" },
  { value: "reach" as const, label: "Alcance total" },
  { value: "likes" as const, label: "Me gusta" },
  { value: "posts" as const, label: "Publicaciones" },
];

export function AnalisisPublicacionesClient() {
  const [selected, setSelected] = React.useState<PoliticianId>("cabal");
  const [metric, setMetric] = React.useState<(typeof METRIC_OPTIONS)[number]["value"]>(
    "engagementRate"
  );

  const politician = POLITICIANS.find((p) => p.id === selected)!;
  const summary = getEngagementSummary(selected);
  const posts = getPublicationsByPolitician(selected);
  const platformFreq = getPostingFrequency(selected);
  const weeklyTrend = getWeeklyPostingTrend(selected);
  const topics = getTopicBreakdown(selected);
  const sentiment = getSentimentBreakdown(selected);
  const comparison = compareByMetric(metric);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Publicaciones en redes: engagement, temas y sentimiento
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Por político, con comparación entre ellos.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
          <FlaskConical className="size-3" aria-hidden="true" />
          Datos simulados — MVP
        </span>
      </div>

      <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
        Los "otros políticos" son roles ilustrativos (oficialista / oposición / independiente), no
        personas reales — para no atribuir publicaciones ni cifras inventadas a alguien
        identificable. Al conectar una base de datos real, se reemplaza{" "}
        <code className="rounded bg-surface-muted px-1 py-0.5">src/lib/publications-analysis.ts</code>{" "}
        sin tocar esta pantalla.
      </p>

      {/* Selector de político */}
      <div className="mt-6 flex flex-wrap gap-2">
        {POLITICIANS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            className={
              p.id === selected
                ? "rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
                : "rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Resumen de engagement del político seleccionado */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Publicaciones" value={summary.posts.toLocaleString("es-CO")} icon={Sparkles} />
        <StatCard label="Me gusta" value={summary.likes.toLocaleString("es-CO")} icon={Heart} />
        <StatCard
          label="Comentarios"
          value={summary.comments.toLocaleString("es-CO")}
          icon={MessagesSquare}
        />
        <StatCard label="Compartidos" value={summary.shares.toLocaleString("es-CO")} icon={Share2} />
        <StatCard label="Tasa de interacción" value={`${summary.engagementRate}%`} icon={Gauge} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Publicaciones por semana" icon={Calendar}>
          {weeklyTrend.length > 0 ? (
            <>
              <TrendArea data={weeklyTrend} color={politician.color} />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>{weeklyTrend[0]?.label}</span>
                <span>{weeklyTrend[weeklyTrend.length - 1]?.label}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sin publicaciones en este periodo.</p>
          )}
        </Panel>

        <Panel title="Publicaciones por plataforma" icon={Radar}>
          <BarList items={platformFreq} color={politician.color} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Temas más tratados" icon={Sparkles}>
          {topics.length > 0 ? (
            <DonutChart slices={topics} />
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Panel>

        <Panel title="Sentimiento de las publicaciones" icon={Gauge}>
          {sentiment.length > 0 ? (
            <DonutChart slices={sentiment} />
          ) : (
            <p className="text-xs text-muted-foreground">Sin datos.</p>
          )}
        </Panel>
      </div>

      <Panel title="Publicaciones recientes" icon={MessagesSquare} className="mt-4">
        <ul className="-my-1 divide-y divide-border">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {post.platform} · {post.date}
                </span>
                <span className="truncate text-muted-foreground">{post.excerpt}</span>
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {post.likes.toLocaleString("es-CO")} likes
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Alcance en 3D: tiempo × plataforma × interacción" icon={Sparkles} className="mt-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Cada punto es una publicación de {politician.name}. Arrastra para rotar. Color = sentimiento
          (verde positivo, gris neutral, rojo negativo).
        </p>
        {posts.length > 0 ? (
          <Scatter3D
            points={posts.map((p) => ({
              date: p.date,
              platform: p.platform,
              engagement: p.likes + p.comments + p.shares,
              color: SENTIMENT_COLOR[p.sentiment],
              label: p.topic,
            }))}
            platforms={PLATFORMS}
          />
        ) : (
          <p className="text-xs text-muted-foreground">Sin publicaciones para graficar.</p>
        )}
      </Panel>

      {/* Comparación entre políticos */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Trophy className="size-4 text-brand" aria-hidden="true" />
          Comparación entre políticos
        </p>
        <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full border border-border bg-background p-0.5">
          {METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMetric(opt.value)}
              className={
                opt.value === metric
                  ? "rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
                  : "rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Panel title="Ranking" icon={Trophy} className="mt-3">
        <ol className="space-y-3">
          {comparison.map((row, i) => (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium">
                  <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                  {row.label}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{row.hint}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max((row.value / (comparison[0]?.value || 1)) * 100, 2)}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
