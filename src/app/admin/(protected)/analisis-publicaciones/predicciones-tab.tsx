"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Gauge, Radio, Sparkles, ThumbsUp } from "lucide-react";

import { getEngagementSummary, getSentimentBreakdown, getWeeklyPostingTrend } from "@/lib/publications-analysis";

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold tabular-nums text-brand">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand"
      />
    </div>
  );
}

function CompareCard({
  label,
  actual,
  projected,
  format,
}: {
  label: string;
  actual: number;
  projected: number;
  format: (n: number) => string;
}) {
  const deltaPct = actual ? Math.round(((projected - actual) / actual) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-sm text-muted-foreground line-through decoration-1">{format(actual)}</span>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-xl font-semibold tracking-tight tabular-nums">{format(projected)}</span>
      </div>
      <p className={`mt-1 text-[11px] font-medium ${deltaPct >= 0 ? "text-brand" : "text-destructive"}`}>
        {deltaPct >= 0 ? "+" : ""}
        {deltaPct}% vs. lo actual
      </p>
    </div>
  );
}

/**
 * Simulador "qué pasaría si": no es un modelo predictivo entrenado con
 * datos reales, ni un pronóstico oficial. Es una regla simple y
 * transparente (visible aquí mismo) sobre el promedio actual de María
 * Fernanda Cabal, para explorar el efecto direccional de publicar más,
 * con más tono positivo, o con más presupuesto de pauta. Sirve para
 * pensar escenarios, no para prometer resultados.
 */
export function PrediccionesTab() {
  const baseline = getEngagementSummary("cabal");
  const weeklyTrend = getWeeklyPostingTrend("cabal");
  const sentiment = getSentimentBreakdown("cabal");
  const baselinePositiveShare = sentiment.find((s) => s.label === "Positivo")?.value ?? 50;

  const weeksInData = Math.max(weeklyTrend.length, 1);
  const baselinePostsPerWeek = Math.round((baseline.posts / weeksInData) * 10) / 10;
  const baselineReachPerPost = baseline.posts ? baseline.reach / baseline.posts : 0;
  const baselineEngagementPerPost = baseline.posts
    ? (baseline.likes + baseline.comments + baseline.shares) / baseline.posts
    : 0;

  const [postsPerWeek, setPostsPerWeek] = React.useState(Math.max(Math.round(baselinePostsPerWeek), 1));
  const [positiveShare, setPositiveShare] = React.useState(baselinePositiveShare);
  const [adMultiplier, setAdMultiplier] = React.useState(1);
  const projectionWeeks = 4;

  // Modelo, a propósito simple y visible: la pauta amplifica ALCANCE; el
  // tono del contenido (más o menos positivo que hoy) amplifica
  // INTERACCIÓN orgánica. No hay saturación, costos ni segmentación —
  // por eso es una exploración de dirección, no una cifra para prometer.
  const sentimentMultiplier = 1 + ((positiveShare - baselinePositiveShare) / 100) * 0.6;

  // "Actual" se expresa en la MISMA ventana de tiempo que la proyección
  // (ritmo actual × 4 semanas), no como el total histórico acumulado —
  // así, si no se mueve ningún control, la comparación parte de 0%, en
  // vez de mostrar una caída falsa solo por la diferencia de ventanas.
  const actualPosts = Math.round(baselinePostsPerWeek * projectionWeeks);
  const actualReachTotal = Math.round(actualPosts * baselineReachPerPost);
  const actualEngagementTotal = Math.round(actualPosts * baselineEngagementPerPost);

  const projectedPosts = postsPerWeek * projectionWeeks;
  const projectedReach = Math.round(projectedPosts * baselineReachPerPost * adMultiplier);
  const projectedEngagement = Math.round(
    projectedPosts * baselineEngagementPerPost * sentimentMultiplier
  );
  const projectedRate = projectedReach ? (projectedEngagement / projectedReach) * 100 : 0;
  const actualRate = baseline.engagementRate;

  return (
    <div>
      <div className="flex items-start gap-2 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-xs text-accent">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          Esto es una <strong>simulación con una regla simple y visible</strong>, no un modelo predictivo
          entrenado ni un pronóstico oficial: la pauta amplifica el alcance, y publicar con más tono
          positivo que el promedio actual amplifica la interacción orgánica, de forma lineal y sin
          saturación. Sirve para explorar la dirección de una decisión, no para prometer un resultado.
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
            Ajusta el escenario ({projectionWeeks} semanas)
          </p>

          <Slider
            label="Publicaciones por semana"
            value={postsPerWeek}
            min={1}
            max={14}
            step={1}
            suffix=""
            onChange={setPostsPerWeek}
          />
          <Slider
            label="Contenido con tono positivo"
            value={positiveShare}
            min={0}
            max={100}
            step={5}
            suffix="%"
            onChange={setPositiveShare}
          />
          <Slider
            label="Inversión en pauta (multiplicador)"
            value={adMultiplier}
            min={0.5}
            max={3}
            step={0.1}
            suffix="×"
            onChange={setAdMultiplier}
          />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Hoy: ~{baselinePostsPerWeek} publicaciones/semana, {baselinePositiveShare}% de tono positivo,
            sin pauta adicional (1×).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CompareCard
            label="Publicaciones"
            actual={actualPosts}
            projected={projectedPosts}
            format={(n) => n.toLocaleString("es-CO")}
          />
          <CompareCard
            label="Alcance"
            actual={actualReachTotal}
            projected={projectedReach}
            format={(n) => n.toLocaleString("es-CO")}
          />
          <CompareCard
            label="Interacciones"
            actual={actualEngagementTotal}
            projected={projectedEngagement}
            format={(n) => n.toLocaleString("es-CO")}
          />
          <CompareCard
            label="Tasa de interacción"
            actual={actualRate}
            projected={Math.round(projectedRate * 10) / 10}
            format={(n) => `${n}%`}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
          <Radio className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden="true" />
          Más publicaciones por semana suman más ventanas de alcance, pero no mejoran por sí solas la
          tasa de interacción.
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
          <ThumbsUp className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden="true" />
          Subir el tono positivo por encima del {baselinePositiveShare}% actual es lo único que mueve la
          interacción orgánica en este modelo.
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-xs text-muted-foreground">
          <Gauge className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden="true" />
          La pauta (multiplicador) solo mueve alcance — por eso la tasa de interacción puede bajar si se
          sube la pauta sin subir también el tono positivo.
        </div>
      </div>
    </div>
  );
}
