"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Eye, Loader2, Megaphone, Minus, MousePointerClick, UserPlus } from "lucide-react";

import { Kpis } from "@/components/admin/estilo-cabal";

import type { Analitica, PuntoDia } from "@/lib/portales/cms/analitica";
import type { Portal } from "@/lib/portales/store";
import { mensajeDe, numero, pedir, tarjeta } from "./comun";

/** Analítica del portal: visitas, clics en «Súmate», personas nuevas, artículos más leídos y asistencia a eventos. */

const DIAS = [7, 30, 90] as const;

function Variacion({ valor }: { valor: number | null }) {
  if (valor === null) return <span>sin periodo anterior</span>;
  if (valor === 0) return <span className="inline-flex items-center gap-0.5"><Minus className="size-3" /> igual que antes</span>;
  const sube = valor > 0;
  return <span className="inline-flex items-center gap-0.5 font-semibold">{sube ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(valor)} % {sube ? "más" : "menos"} que el periodo anterior</span>;
}

/** Barras por día (visitas) con la línea de personas nuevas encima. SVG a mano: sin librería. */
function Grafica({ serie }: { serie: PuntoDia[] }) {
  const [sobre, setSobre] = React.useState<number | null>(null);
  const W = 720;
  const H = 220;
  const m = { l: 34, r: 8, t: 12, b: 24 };
  const maxV = Math.max(1, ...serie.map((p) => p.vistas));
  const maxC = Math.max(1, ...serie.map((p) => p.contactos));
  const ancho = (W - m.l - m.r) / serie.length;
  const y = (v: number, max: number) => m.t + (1 - v / max) * (H - m.t - m.b);
  const linea = serie.map((p, i) => `${i === 0 ? "M" : "L"}${(m.l + ancho * i + ancho / 2).toFixed(1)} ${y(p.contactos, maxC).toFixed(1)}`).join(" ");
  const marcas = [0, 0.5, 1].map((t) => ({ v: Math.round(maxV * t), y: y(maxV * t, maxV) }));
  const p = sobre !== null ? serie[sobre] : null;
  const etiq = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
  const paso = Math.max(1, Math.ceil(serie.length / 8));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Visitas y personas nuevas por día" onMouseLeave={() => setSobre(null)}>
        {marcas.map((t) => (
          <g key={t.y}>
            <line x1={m.l} x2={W - m.r} y1={t.y} y2={t.y} className="stroke-border" strokeDasharray="3 4" />
            <text x={m.l - 6} y={t.y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{numero(t.v)}</text>
          </g>
        ))}
        {serie.map((s, i) => {
          const x = m.l + ancho * i;
          const h = (H - m.t - m.b) * (s.vistas / maxV);
          return (
            <g key={s.dia} onMouseEnter={() => setSobre(i)}>
              <rect x={x} y={m.t} width={ancho} height={H - m.t - m.b} fill="transparent" />
              <rect x={x + ancho * 0.18} y={H - m.b - h} width={Math.max(1, ancho * 0.64)} height={h} rx={Math.min(4, ancho * 0.3)} className={sobre === i ? "fill-brand" : "fill-brand/55"} />
              {i % paso === 0 && <text x={x + ancho / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{etiq(s.dia)}</text>}
            </g>
          );
        })}
        <path d={linea} fill="none" className="stroke-amber-500" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {serie.map((s, i) => s.contactos > 0 && <circle key={s.dia} cx={m.l + ancho * i + ancho / 2} cy={y(s.contactos, maxC)} r={3} className="fill-amber-500" />)}
      </svg>
      {p && (
        <div className="pointer-events-none absolute top-1 right-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
          <p className="font-semibold">{etiq(p.dia)}</p>
          <p className="text-muted-foreground">{numero(p.vistas)} visitas · {numero(p.cta)} clics en «Súmate» · {numero(p.contactos)} personas nuevas</p>
        </div>
      )}
      <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand/55" /> Visitas por día</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-amber-500" /> Personas nuevas en la comunidad</span></p>
    </div>
  );
}

export function AnaliticaPanel({ portal }: { portal: Portal }) {
  const [dias, setDias] = React.useState<(typeof DIAS)[number]>(30);
  const [datos, setDatos] = React.useState<Analitica | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelado = false;
    pedir<Analitica>(`/api/admin/portales/${portal.id}/analitica?dias=${dias}`, "GET")
      .then((r) => {
        if (!cancelado) {
          setDatos(r);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelado) setError(mensajeDe(e, "No se pudo leer la analítica."));
      });
    return () => {
      cancelado = true;
    };
  }, [portal.id, dias]);

  const cargando = !datos && !error;
  const conversion = datos && datos.totales.vistas > 0 ? (datos.totales.cta / datos.totales.vistas) * 100 : 0;
  const maxLecturas = Math.max(1, ...(datos?.topArticulos.map((a) => a.vistas) ?? [1]));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold">Analítica</h3>
          <p className="text-sm text-muted-foreground">Cómo va {portal.nombre}: quién llega, qué lee y cuánta gente se suma.</p>
        </div>
        <div role="tablist" aria-label="Periodo" className="inline-flex rounded-full bg-surface p-1 text-sm shadow-sm ring-1 ring-border">
          {DIAS.map((d) => <button key={d} type="button" role="tab" aria-selected={dias === d} onClick={() => setDias(d)} className={`rounded-full px-4 py-1.5 font-semibold transition ${dias === d ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>{d} días</button>)}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
      {cargando && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Calculando…</p>}

      {datos && (
        <>
          <Kpis
            items={[
              { etiqueta: "Visitas", valor: numero(datos.totales.vistas), detalle: <Variacion valor={datos.cambios.vistas} />, icono: Eye },
              { etiqueta: "Personas nuevas", valor: numero(datos.totales.contactosNuevos), detalle: <Variacion valor={datos.cambios.contactos} />, icono: UserPlus },
              { etiqueta: "Clics en «Súmate»", valor: numero(datos.totales.cta), detalle: `${conversion.toFixed(1).replace(".", ",")} % de las visitas`, icono: MousePointerClick },
              { etiqueta: "Clics en anuncios", valor: numero(datos.totales.anuncioClics), detalle: "en el periodo", icono: Megaphone },
            ]}
          />

          <section className={`${tarjeta} p-5`}>
            <h4 className="mb-3 text-sm font-semibold">Visitas y personas nuevas, día por día</h4>
            {datos.totales.vistas === 0 && datos.totales.contactosNuevos === 0 ? <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">Aún no hay movimiento en este periodo. Cuando el portal esté en línea y reciba visitas, aquí lo verás.</p> : <Grafica serie={datos.serie} />}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className={`${tarjeta} p-5`}>
              <h4 className="text-sm font-semibold">Lo más leído</h4>
              {datos.topArticulos.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aún no hay artículos publicados.</p> : (
                <ol className="mt-3 space-y-2.5">
                  {datos.topArticulos.map((a, i) => (
                    <li key={a.id}>
                      <a href={`/p/${portal.slug}/articulos/${a.slug}`} target="_blank" rel="noreferrer noopener" className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                        <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:text-brand">{a.titulo}</span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-brand" style={{ width: `${(a.vistas / maxLecturas) * 100}%` }} /></span>
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">{numero(a.vistas)}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">Lecturas de todos los tiempos; los programas de buscadores y de vista previa no cuentan.</p>
            </section>

            <section className={`${tarjeta} p-5`}>
              <h4 className="text-sm font-semibold">Eventos recientes</h4>
              {datos.eventos.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aún no hay eventos.</p> : (
                <ul className="mt-3 divide-y divide-border">
                  {datos.eventos.map((e) => {
                    const tasa = e.inscritos > 0 ? Math.round((e.asistentes / e.inscritos) * 100) : 0;
                    return (
                      <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                        <span className="min-w-0 flex-1 basis-40 truncate font-medium">{e.titulo}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{numero(e.inscritos)} inscritos</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{numero(e.asistentes)} asistieron{e.inscritos > 0 && e.asistentes > 0 ? ` (${tasa} %)` : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
