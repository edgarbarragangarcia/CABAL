"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FlaskConical,
  Gauge,
  GraduationCap,
  Hash,
  MessagesSquare,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { useLmsCourses } from "@/lib/lms-store";
import { BarList, DonutChart, TrendArea } from "@/components/admin/charts";
import {
  getDailyMentions,
  platformBreakdown,
  samplePosts,
  sentimentBreakdown,
  trendingTopics,
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

export default function CentroDeControlPage() {
  const { courses, ready } = useLmsCourses();

  const totalModulos = courses.reduce((acc, c) => acc + c.modules.length, 0);
  const totalLecciones = courses.reduce(
    (acc, c) => acc + c.modules.reduce((a, m) => a + m.lessons.length, 0),
    0
  );
  const publicados = courses.filter((c) => c.status === "publicado").length;

  const dailyMentions = getDailyMentions();
  const totalMentions30d = dailyMentions.reduce((a, d) => a + d.mentions, 0);
  const avgSentiment =
    dailyMentions.reduce((a, d) => a + d.sentiment, 0) / dailyMentions.length;
  const last = dailyMentions[dailyMentions.length - 1].mentions;
  const prev = dailyMentions[dailyMentions.length - 2]?.mentions ?? last;
  const dayDeltaPct = prev ? Math.round(((last - prev) / prev) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro de control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado del panel y accesos rápidos.
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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={GraduationCap}
          label="Cursos"
          value={ready ? courses.length : "—"}
          hint={`${publicados} publicados`}
        />
        <StatCard icon={Sparkles} label="Módulos" value={ready ? totalModulos : "—"} />
        <StatCard icon={CheckCircle2} label="Lecciones" value={ready ? totalLecciones : "—"} />
      </div>

      {/* Tendencia en redes sociales — SIMULADO, pendiente de fuente real */}
      <div className="relative mt-8 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-soft/60 via-surface to-surface p-6 shadow-sm">
        <div className="pointer-events-none absolute -left-10 -top-16 size-56 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 size-56 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-base font-semibold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <BarChart3 className="size-4" aria-hidden="true" />
            </span>
            Tendencia en redes sociales
          </h2>
          <span className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
            <FlaskConical className="size-3" aria-hidden="true" />
            Datos simulados — vista previa
          </span>
        </div>
        <p className="relative mt-1.5 max-w-xl text-xs text-muted-foreground">
          Maqueta del dashboard con datos de ejemplo. Aún no está conectado a
          una fuente real de social listening ni a una base de datos.
        </p>

        <div className="relative mt-5 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={MessagesSquare}
            label="Menciones (30 días)"
            value={totalMentions30d.toLocaleString("es-CO")}
            hint={`${dayDeltaPct >= 0 ? "+" : ""}${dayDeltaPct}% vs. ayer`}
          />
          <StatCard
            icon={Gauge}
            label="Sentimiento promedio"
            value={avgSentiment >= 0 ? "Positivo" : "Negativo"}
            hint={`índice ${avgSentiment.toFixed(2)} (-1 a 1)`}
            tone="accent"
          />
          <StatCard
            icon={Hash}
            label="Iniciativa con más tracción"
            value={trendingTopics[0].tag}
            hint={`${trendingTopics[0].mentions.toLocaleString("es-CO")} menciones`}
          />
        </div>

        <div className="relative mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="Menciones por día" icon={TrendingUp}>
            <TrendArea data={dailyMentions.map((d) => ({ label: d.date, value: d.mentions }))} />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{dailyMentions[0].date}</span>
              <span>{dailyMentions[dailyMentions.length - 1].date}</span>
            </div>
          </Panel>

          <Panel title="Sentimiento" icon={Gauge}>
            <DonutChart slices={sentimentBreakdown} />
          </Panel>
        </div>

        <div className="relative mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Temas en tendencia" icon={Hash}>
            <BarList
              items={trendingTopics.map((t) => ({
                label: t.tag,
                value: t.mentions,
                hint: `${t.deltaPct >= 0 ? "+" : ""}${t.deltaPct}%`,
              }))}
            />
          </Panel>

          <Panel title="Distribución por plataforma" icon={BarChart3}>
            <DonutChart slices={platformBreakdown} />
          </Panel>
        </div>

        <Panel title="Publicaciones de ejemplo" icon={MessagesSquare} className="relative mt-4">
          <ul className="-my-1 divide-y divide-border">
            {samplePosts.map((post, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${PLATFORM_DOT[post.platform] ?? "bg-zinc-400"}`}
                  />
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {post.platform}
                  </span>
                  <span className="truncate text-muted-foreground">{post.excerpt}</span>
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
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Accesos rápidos" icon={Sparkles}>
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
        </Panel>

        <Panel title="Estado del sistema" icon={CheckCircle2}>
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
        </Panel>
      </div>
    </div>
  );
}
