"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Flame, Info, Lightbulb, Loader2, MapPin, MessageCircle, RefreshCw, TrendingDown, TrendingUp, Users } from "lucide-react";

import type { Inteligencia, Senal } from "@/lib/comunidad/inteligencia";

type Respuesta = Inteligencia & { configurada: true; error?: undefined };
type Estado = { configurada: false } | { configurada: true; error: string } | Respuesta;

const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";

/* --------------------------------------------------------------- piezas */

/** Cambio frente al periodo anterior. */
function Delta({ actual, anterior, bueno = "sube" }: { actual: number; anterior: number; bueno?: "sube" | "baja" }) {
  if (anterior === 0 && actual === 0) return <span className="text-xs text-muted-foreground">sin cambios</span>;
  if (anterior === 0) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">nuevo</span>;
  const v = Math.round(((actual - anterior) / anterior) * 100);
  if (v === 0) return <span className="text-xs text-muted-foreground">igual que antes</span>;
  const bien = (v > 0) === (bueno === "sube");
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${bien ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
      {v > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {v > 0 ? "+" : ""}{v}%
    </span>
  );
}

function Sparkline({ valores, color = "#0a4f37" }: { valores: number[]; color?: string }) {
  const max = Math.max(1, ...valores);
  const w = 120, h = 36;
  const pts = valores.map((v, i) => `${(i / Math.max(1, valores.length - 1)) * w},${h - 3 - (v / max) * (h - 8)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity="0.12" stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({ titulo, valor, sub, delta, serie, color }: { titulo: string; valor: React.ReactNode; sub?: string; delta?: React.ReactNode; serie?: number[]; color?: string }) {
  return (
    <div className={`${tarjeta} flex flex-col gap-1 p-5`}>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="font-display text-4xl leading-none font-semibold tabular-nums">{valor}</p>
        {delta}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {serie && <div className="mt-1"><Sparkline valores={serie} color={color} /></div>}
    </div>
  );
}

function Barras({ datos, color = "bg-brand" }: { datos: { etiqueta: string; sub?: string; valor: number; extra?: string }[]; color?: string }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <ul className="space-y-3">
      {datos.map((d) => (
        <li key={d.etiqueta + (d.sub ?? "")}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-semibold">{d.etiqueta}{d.sub && <span className="font-normal text-muted-foreground"> · {d.sub}</span>}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{d.extra ?? d.valor}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-muted"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, (d.valor / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Actividad diaria: barras de publicaciones y línea de interacciones (comentarios + «me gusta»). */
function SerieDias({ serie }: { serie: Inteligencia["serie"] }) {
  const w = 640, h = 190, pad = { i: 34, d: 8, a: 10, b: 26 };
  const maxP = Math.max(2, ...serie.map((s) => s.publicaciones));
  const maxI = Math.max(2, ...serie.map((s) => s.interacciones));
  const paso = (w - pad.i - pad.d) / serie.length;
  const y = (v: number, max: number) => pad.a + (1 - v / max) * (h - pad.a - pad.b);
  const linea = serie.map((s, i) => `${pad.i + paso * i + paso / 2},${y(s.interacciones, maxI)}`).join(" ");
  const cada = Math.ceil(serie.length / 8);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Actividad diaria: publicaciones e interacciones">
      {[0, 0.5, 1].map((t) => <g key={t}><line x1={pad.i} x2={w - pad.d} y1={y(maxP * t, maxP)} y2={y(maxP * t, maxP)} stroke="currentColor" strokeOpacity="0.1" /><text x={pad.i - 6} y={y(maxP * t, maxP) + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.5">{Math.round(maxP * t)}</text></g>)}
      {serie.map((s, i) => {
        const x = pad.i + paso * i + paso * 0.18;
        const alto = (h - pad.a - pad.b) * (s.publicaciones / maxP);
        return (
          <g key={s.dia}>
            <rect x={x} y={h - pad.b - alto} width={paso * 0.64} height={Math.max(alto, 0)} rx="3" fill="#0a4f37" fillOpacity="0.85"><title>{`${s.dia}: ${s.publicaciones} publicaciones, ${s.interacciones} interacciones, ${s.afiliados} afiliaciones`}</title></rect>
            {i % cada === 0 && <text x={pad.i + paso * i + paso / 2} y={h - 8} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.55">{s.dia.slice(8)}/{s.dia.slice(5, 7)}</text>}
          </g>
        );
      })}
      <polyline points={linea} fill="none" stroke="#b3893c" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {serie.map((s, i) => <circle key={s.dia} cx={pad.i + paso * i + paso / 2} cy={y(s.interacciones, maxI)} r="3" fill="#b3893c" />)}
    </svg>
  );
}

const ESTILO_SENAL: Record<Senal["nivel"], { icono: typeof Info; caja: string; chip: string; texto: string }> = {
  alerta: { icono: AlertTriangle, caja: "border-l-rose-500", chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300", texto: "Atención" },
  oportunidad: { icono: Lightbulb, caja: "border-l-emerald-600", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", texto: "Oportunidad" },
  info: { icono: Info, caja: "border-l-slate-400", chip: "bg-surface-muted text-muted-foreground", texto: "Dato" },
};

/* ---------------------------------------------------------------- pestaña */

export function DecisionTab({ irAPublicar }: { irAPublicar: () => void }) {
  const [dias, setDias] = React.useState(7);
  const [recarga, setRecarga] = React.useState(0);
  const [res, setRes] = React.useState<{ clave: string; datos: Estado; hora: Date } | null>(null);
  const clave = `${dias}-${recarga}`;

  React.useEffect(() => {
    let cancelado = false;
    fetch(`/api/admin/comunidad/inteligencia?dias=${dias}`)
      .then(async (r): Promise<Estado> => {
        const b = await r.json().catch(() => ({}));
        return r.ok ? (b as Estado) : { configurada: true, error: b.error ?? "No se pudo calcular." };
      })
      .catch((): Estado => ({ configurada: true, error: "Sin conexión." }))
      .then((datos) => { if (!cancelado) setRes({ clave, datos, hora: new Date() }); });
    return () => { cancelado = true; };
  }, [dias, recarga, clave]);

  const cargando = res?.clave !== clave;
  const datos = res?.datos ?? null;
  const hora = res?.hora ?? null;
  const cargar = () => setRecarga((n) => n + 1);

  const d = datos && datos.configurada && !("error" in datos && datos.error) ? (datos as Respuesta) : null;
  const k = d?.kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Periodo" className="inline-flex rounded-full bg-surface p-1 shadow-sm ring-1 ring-border">
          {[7, 14, 30].map((n) => <button key={n} type="button" role="tab" aria-selected={dias === n} onClick={() => setDias(n)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${dias === n ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>{n} días</button>)}
        </div>
        <button type="button" onClick={cargar} disabled={cargando} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground ring-1 ring-border transition hover:text-foreground disabled:opacity-60">{cargando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Actualizar</button>
        {hora && <span className="text-xs text-muted-foreground">Calculado a las {hora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} · compara con los {dias} días anteriores</span>}
        <Link href="/unete" target="_blank" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">Formulario público /unete <ArrowUpRight className="size-4" /></Link>
      </div>

      {datos === null && <div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}
      {datos && !datos.configurada && <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">Falta conectar Supabase: define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel.</p>}
      {datos && datos.configurada && "error" in datos && datos.error && <p className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{datos.error}</p>}

      {d && k && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi titulo="Afiliados" valor={k.afiliados.toLocaleString("es-CO")} sub={`${k.nuevos} nuevo${k.nuevos === 1 ? "" : "s"} en ${d.dias} días`} delta={<Delta actual={k.nuevos} anterior={k.nuevosAnt} />} serie={d.serie.map((s) => s.afiliados)} />
            <Kpi titulo="Publicaciones" valor={k.publicaciones} sub={`${k.publicacionesAnt} en el periodo anterior`} delta={<Delta actual={k.publicaciones} anterior={k.publicacionesAnt} />} serie={d.serie.map((s) => s.publicaciones)} />
            <Kpi titulo="Comentarios" valor={k.comentarios} sub={`${k.comentariosAnt} en el periodo anterior`} delta={<Delta actual={k.comentarios} anterior={k.comentariosAnt} />} />
            <Kpi titulo="Me gusta" valor={k.meGusta} sub="en las publicaciones del periodo" />
            <Kpi titulo="Participación" valor={`${Math.round(k.participacion * 100)}%`} sub={`${k.activos} de ${k.afiliados} publicó o comentó`} />
          </div>

          <section aria-labelledby="senales">
            <h2 id="senales" className="mb-3 flex items-center gap-2 font-display text-xl font-semibold"><Lightbulb className="size-5 text-amber-500" /> Señales para decidir</h2>
            {d.senales.length === 0 ? <p className={`${tarjeta} p-6 text-sm text-muted-foreground`}>Todavía no hay datos suficientes para generar señales. Aparecerán a medida que haya afiliados y conversación.</p> : (
              <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {d.senales.map((s) => {
                  const e = ESTILO_SENAL[s.nivel];
                  return (
                    <li key={s.id} className={`${tarjeta} border-l-4 ${e.caja} p-4`}>
                      <div className="flex items-start gap-3">
                        <e.icono className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${e.chip}`}>{e.texto}</span>
                          <p className="font-semibold leading-snug">{s.titulo}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{s.detalle}</p>
                          {s.accion === "publicar" && <button type="button" onClick={irAPublicar} className="mt-2 text-sm font-semibold text-brand hover:underline">Publicar como cuenta oficial →</button>}
                          {s.accion === "difundir" && <Link href="/unete" target="_blank" className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">Abrir el formulario /unete →</Link>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Las señales son reglas sobre los datos de la propia comunidad (conteos de afiliados, publicaciones, comentarios y grupos); cada una muestra las cifras en que se basa.</p>
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className={`${tarjeta} p-5 xl:col-span-2`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">Actividad diaria</h2>
                <p className="flex items-center gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#0a4f37]" /> Publicaciones</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#b3893c]" /> Interacciones</span></p>
              </div>
              <div className="mt-3 text-foreground"><SerieDias serie={d.serie} /></div>
            </section>
            <section className={`${tarjeta} p-5`}>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Flame className="size-5 text-amber-500" /> Temas en alza</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Palabras y #etiquetas que se repiten en publicaciones de personas distintas.</p>
              {d.temas.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Aún no hay temas que se repitan.</p> : (
                <ol className="mt-4 space-y-2.5">
                  {d.temas.slice(0, 8).map((t, i) => (
                    <li key={t.palabra} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-center font-display text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{t.hashtag ? t.palabra : t.palabra.charAt(0).toUpperCase() + t.palabra.slice(1)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{t.menciones} publ. · {t.autores} pers.</span>
                      <Delta actual={t.menciones} anterior={t.antes} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            <section className={`${tarjeta} p-5`}>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><MapPin className="size-5 text-brand" /> Dónde están</h2>
              <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Afiliados por ciudad, con los nuevos del periodo.</p>
              {d.ciudades.length === 0 ? <p className="text-sm text-muted-foreground">Sin afiliados todavía.</p> : <Barras datos={d.ciudades.map((c) => ({ etiqueta: c.municipio, valor: c.afiliados, extra: `${c.afiliados}${c.nuevos ? ` · +${c.nuevos}` : ""}` }))} />}
              {d.barrios.length > 0 && <><h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Barrios con más afiliados</h3><Barras color="bg-[#b3893c]" datos={d.barrios.slice(0, 5).map((b) => ({ etiqueta: b.barrio, sub: b.municipio, valor: b.afiliados }))} /></>}
            </section>
            <section className={`${tarjeta} p-5`}>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Users className="size-5 text-brand" /> Grupos más activos</h2>
              <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Publicaciones e interacciones en el periodo.</p>
              {d.grupos.filter((g) => g.publicaciones > 0).length === 0 ? <p className="text-sm text-muted-foreground">Ningún grupo tuvo publicaciones.</p> : <Barras datos={d.grupos.filter((g) => g.publicaciones > 0).map((g) => ({ etiqueta: g.nombre, valor: g.publicaciones + g.interacciones, extra: `${g.publicaciones} publ. · ${g.interacciones} inter.` }))} />}
            </section>
            <section className={`${tarjeta} p-5 lg:col-span-2`}>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><MessageCircle className="size-5 text-brand" /> Publicaciones más movidas</h2>
              <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Ordenadas por «me gusta» + 2 × comentarios.</p>
              {d.publicaciones.length === 0 ? <p className="text-sm text-muted-foreground">Sin publicaciones en el periodo.</p> : (
                <ol className="space-y-3">
                  {d.publicaciones.map((p, i) => (
                    <li key={p.id} className="flex gap-3 rounded-xl bg-surface-muted/60 p-3">
                      <span className="w-6 shrink-0 text-center font-display text-lg text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground"><b className="text-foreground">{p.autor.nombre}</b> · {p.autor.barrio} · {p.autor.municipio}{p.grupo && p.grupo.nombre !== p.autor.municipio && p.grupo.nombre !== `${p.autor.barrio} · ${p.autor.municipio}` ? ` · ${p.grupo.nombre}` : ""}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm">{p.texto}</p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums"><p><b className="text-foreground">{p.meGusta}</b> me gusta</p><p><b className="text-foreground">{p.comentarios}</b> comentarios</p></div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
