"use client";

import * as React from "react";
import { ExternalLink, Loader2, Radio, RefreshCw, Sparkles } from "lucide-react";

import { BarList, DonutChart, TrendArea } from "@/components/admin/charts";
import type { Monitoreo } from "@/lib/monitoreo";
import type { PublicacionRed, Redes } from "@/lib/monitoreo/redes";
import type { ResultadoReaccion } from "@/lib/monitoreo/reaccion-lector";

type Estado = { datos: Monitoreo | null; cargando: boolean; error: string | null };

/** Datos reales de YouTube, prensa y Wikipedia; se refrescan solos cada 2 minutos. */
export function useMonitoreo() {
  const [estado, setEstado] = React.useState<Estado>({ datos: null, cargando: true, error: null });

  const cargar = React.useCallback(async (forzar = false) => {
    setEstado((e) => ({ ...e, cargando: true }));
    try {
      const res = await fetch(`/api/admin/monitoreo${forzar ? "?forzar=1" : ""}`, { cache: "no-store" });
      const json = (await res.json()) as Monitoreo & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "No fue posible consultar las fuentes.");
      setEstado({ datos: json, cargando: false, error: null });
    } catch (err) {
      setEstado((e) => ({ datos: e.datos, cargando: false, error: err instanceof Error ? err.message : "Error de red." }));
    }
  }, []);

  React.useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), 120_000);
    return () => clearInterval(t);
  }, [cargar]);

  return { ...estado, recargar: () => cargar(true) };
}

export function useRedes() {
  const [redes, setRedes] = React.useState<Redes | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const cargar = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/monitoreo/redes", { cache: "no-store" });
      if (res.ok) setRedes((await res.json()) as Redes);
    } finally {
      setCargando(false);
    }
  }, []);
  React.useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), 60_000);
    return () => clearInterval(t);
  }, [cargar]);
  return {
    redes,
    cargando,
    recargar: () => {
      setCargando(true);
      void cargar();
    },
  };
}

const fmt = new Intl.NumberFormat("es-CO");
const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });
const variacion = (a: number, b: number | null) =>
  b ? `${a >= b ? "+" : "−"}${Math.abs(Math.round(((a - b) / b) * 100))}% vs 30 días previos` : undefined;

export function BannerEnVivo({ datos }: { datos: Monitoreo | null }) {
  const [ver, setVer] = React.useState(false);
  const v = datos?.enVivo;
  if (!v?.enVivo || !v.videoId) return null;
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-red-500/40 bg-red-500/10">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          <Radio className="size-3.5 animate-pulse" aria-hidden="true" />
          En vivo ahora
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{v.titulo ?? "Transmisión en directo"}</p>
        <span className="text-xs text-muted-foreground">SoyCabalTV · YouTube</span>
        <button
          type="button"
          onClick={() => setVer((x) => !x)}
          className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          {ver ? "Ocultar" : "Ver aquí"}
        </button>
        <a
          href={v.enlace}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
        >
          Abrir en YouTube <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>
      {ver && (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${v.videoId}?autoplay=1`}
            title={v.titulo ?? "En vivo"}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="size-full"
          />
        </div>
      )}
    </section>
  );
}

const colorTono: Record<string, string> = {
  positivo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  negativo: "bg-red-500/15 text-red-700 dark:text-red-300",
  neutral: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  dividido: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h4 className="text-sm font-semibold">{titulo}</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function ReaccionPanel() {
  const [estado, setEstado] = React.useState<{ cargando?: boolean; datos?: ResultadoReaccion; error?: string }>({});

  async function investigar(forzar: boolean) {
    setEstado((e) => ({ ...e, cargando: true, error: undefined }));
    try {
      const res = await fetch("/api/admin/monitoreo/reaccion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ forzar }) });
      const json = (await res.json()) as ResultadoReaccion & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "No fue posible investigar.");
      setEstado({ datos: json });
    } catch (err) {
      setEstado((e) => ({ datos: e.datos, error: err instanceof Error ? err.message : "Error de red." }));
    }
  }

  const a = estado.datos?.analisis;
  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 @2xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <h4 className="text-sm font-semibold">Reacción pública y tono — investigación con IA</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            La IA busca en internet cómo están reaccionando la prensa y la gente (comentarios, redes, opinión) a lo que dice y hace María Fernanda Cabal en
            las últimas 3 semanas, y mide el tono. Parte de titulares reales y, si conectaste YouTube o X, de sus comentarios y publicaciones.
          </p>
        </div>
        <button
          type="button"
          disabled={estado.cargando}
          onClick={() => investigar(!!estado.datos)}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {estado.cargando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {estado.cargando ? "Investigando…" : estado.datos ? "Investigar de nuevo" : "Investigar con IA"}
        </button>
      </div>
      {estado.cargando && <p className="mt-2 text-xs text-muted-foreground">Hace varias búsquedas en la web: puede tardar uno o dos minutos.</p>}
      {estado.error && <p className="mt-2 text-xs text-red-600">{estado.error}</p>}

      {estado.datos && !a && <p className="mt-3 whitespace-pre-wrap text-sm">{estado.datos.texto}</p>}
      {estado.datos && a && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 @xl:grid-cols-[auto_1fr]">
            <div className={`items-center gap-4 rounded-2xl border border-border bg-background p-4 ${a.tono.positivo + a.tono.neutral + a.tono.negativo > 0 ? "flex" : "hidden"}`}>
              <DonutChart
                slices={[
                  { label: "Positivo", value: a.tono.positivo, color: "#22c58a" },
                  { label: "Neutral", value: a.tono.neutral, color: "#94a3b8" },
                  { label: "Negativo", value: a.tono.negativo, color: "#ef4444" },
                ]}
              />
            </div>
            <div className="rounded-2xl border border-border bg-background p-4 text-sm">
              <p>{a.resumen}</p>
              {a.tono.lectura && <p className="mt-2 text-xs font-semibold">{a.tono.lectura}</p>}
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <p>
                  <b>Prensa:</b> {a.tonoPrensa}
                </p>
                <p>
                  <b>Gente y redes:</b> {a.tonoGente}
                </p>
              </div>
              {a.muestra && <p className="mt-2 text-[11px] text-muted-foreground">Muestra: {a.muestra}</p>}
            </div>
          </div>

          {a.temas.length > 0 && (
            <div className="rounded-2xl border border-border bg-background p-4">
              <h4 className="text-sm font-semibold">De qué se habla y con qué tono</h4>
              <ul className="mt-2 space-y-2">
                {a.temas.map((t, i) => (
                  <li key={i} className="text-xs">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${colorTono[t.tono.toLowerCase()] ?? colorTono.neutral}`}>{t.tono}</span>
                    <b>{t.tema}</b> — {t.detalle}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {a.reacciones.length > 0 && (
            <div className="grid gap-3 @xl:grid-cols-2">
              {a.reacciones.map((r, i) => (
                <div key={i} className="rounded-2xl border border-border bg-background p-4">
                  <h4 className="text-sm font-semibold capitalize">{r.grupo}</h4>
                  <p className="mt-1 text-xs">{r.reaccion}</p>
                  {r.citas.length > 0 && (
                    <ul className="mt-2 space-y-1 border-l-2 border-brand/40 pl-3 text-[11px] italic text-muted-foreground">
                      {r.citas.map((c, k) => (
                        <li key={k}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {a.momentos.length > 0 && (
            <div className="rounded-2xl border border-border bg-background p-4">
              <h4 className="text-sm font-semibold">Línea de tiempo</h4>
              <ul className="mt-2 space-y-2 text-xs">
                {a.momentos.map((m, i) => (
                  <li key={i}>
                    <b>{m.fecha}</b> — {m.hecho}. <span className="text-muted-foreground">Reacción: {m.reaccion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 @xl:grid-cols-3">
            <Lista titulo="Riesgos" items={a.riesgos} />
            <Lista titulo="Oportunidades" items={a.oportunidades} />
            <Lista titulo="Qué hacer" items={a.recomendaciones} />
          </div>
        </div>
      )}

      {estado.datos && estado.datos.fuentes.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground">Fuentes consultadas por la IA ({estado.datos.fuentes.length})</summary>
          <ul className="mt-2 space-y-1">
            {estado.datos.fuentes.map((f, i) => (
              <li key={i}>
                <a href={f.url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline dark:text-emerald-300">
                  {f.titulo}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {estado.datos && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Estimación de IA sobre {estado.datos.titulares} titulares y lo que encontró en la web; no es una encuesta. Verifica las fuentes antes de decidir.
        </p>
      )}
    </div>
  );
}

const hace = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

function Publicaciones({ lista, vacio }: { lista: PublicacionRed[]; vacio: string }) {
  if (lista.length === 0) return <p className="text-xs text-muted-foreground">{vacio}</p>;
  return (
    <ul className="space-y-2.5">
      {lista.map((p) => (
        <li key={p.id} className="text-xs">
          <a href={p.enlace} target="_blank" rel="noreferrer" className="line-clamp-3 font-medium hover:underline">
            {p.texto}
          </a>
          <span className="text-muted-foreground">
            {p.autor} · {hace(p.fecha)} · {fmt.format(p.me_gusta)} me gusta
            {p.compartidos ? ` · ${fmt.format(p.compartidos)} compartidos` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Fallo({ red, error }: { red: string; error: string }) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-xs">
      <p className="text-sm font-semibold">{red}: la credencial no funcionó</p>
      <p className="mt-1 text-red-700 dark:text-red-300">{error}</p>
    </div>
  );
}

/** Una cifra con su etiqueta, para las filas de datos clave. */
function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: React.ReactNode; detalle?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-surface p-3">
      <p className="truncate text-xl font-bold tabular-nums sm:text-2xl">{valor}</p>
      <p className="truncate text-xs font-semibold">{etiqueta}</p>
      {detalle && <p className="line-clamp-2 text-[11px] text-muted-foreground">{detalle}</p>}
    </div>
  );
}

/** Pestañas para ver una sola lista a la vez, con su cantidad. */
function Pestanas<T extends string>({ valor, opciones, onCambio, etiqueta }: { valor: T; opciones: { id: T; label: string; n?: number }[]; onCambio: (id: T) => void; etiqueta: string }) {
  return (
    <div role="tablist" aria-label={etiqueta} className="flex gap-1 overflow-x-auto rounded-full bg-surface-muted p-1 [scrollbar-width:none]">
      {opciones.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={valor === o.id} onClick={() => onCambio(o.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${valor === o.id ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {o.label}
          {o.n !== undefined && <span className="ml-1 tabular-nums opacity-70">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

function Encabezado({ chip, actualizado, cargando, recargar }: { chip: string; actualizado?: string; cargando: boolean; recargar: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{chip}</span>
      {actualizado && <span className="text-[11px] text-muted-foreground">Actualizado {actualizado}</span>}
      <button type="button" onClick={recargar} disabled={cargando} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
        <RefreshCw className={`size-3 ${cargando ? "animate-spin" : ""}`} aria-hidden="true" />
        Actualizar
      </button>
    </div>
  );
}

type PestanaRedes = "youtube" | "comentarios" | "x";

export function RedesWidget({ redes, cargando, recargar }: ReturnType<typeof useRedes>) {
  const yt = redes?.youtube;
  const x = redes?.x;
  const [tab, setTab] = React.useState<PestanaRedes>("youtube");
  const estado = (e: { estado: string } | undefined) => (e?.estado === "ok" ? { t: "Conectada", c: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" } : e?.estado === "error" ? { t: "La clave falló", c: "bg-red-500/15 text-red-700 dark:text-red-300" } : { t: "Sin conectar", c: "bg-surface-muted text-muted-foreground" });
  const ytOk = yt?.estado === "ok" ? yt.datos : null;
  const xOk = x?.estado === "ok" ? x.datos : null;

  return (
    <div className="space-y-4">
      <Encabezado chip="Datos por API oficial" cargando={cargando} recargar={recargar} />
      {!redes && <p className="text-sm text-muted-foreground">Consultando redes…</p>}
      {redes && (
        <>
          <div className="rounded-2xl bg-sky-500/10 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Lo más importante</p>
            <p className="mt-1 text-sm leading-relaxed sm:text-base">
              {ytOk ? <>El canal <strong>{ytOk.canal.nombre}</strong> tiene <strong>{ytOk.canal.suscriptores === null ? "—" : fmt.format(ytOk.canal.suscriptores)}</strong> suscriptores y {fmt.format(ytOk.canal.vistas)} vistas en total.</> : <>YouTube todavía no está conectado: para ver suscriptores, comentarios y rendimiento por semana hace falta una clave API gratuita.</>}{" "}
              {xOk ? <>En X hubo <strong>{fmt.format(xOk.total7d)}</strong> publicaciones que la mencionan en 7 días.</> : <>X no está conectado: su API es de pago, por eso no se muestran menciones.</>}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[30rem] text-left text-xs sm:text-sm">
              <thead className="bg-surface-muted text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <tr><th className="px-3 py-2">Red</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Qué se ve</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr><td className="px-3 py-2.5 font-semibold">YouTube</td><td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estado(yt).c}`}>{estado(yt).t}</span></td><td className="px-3 py-2.5 text-muted-foreground">Suscriptores, vistas por semana, comentarios, en vivo</td></tr>
                <tr><td className="px-3 py-2.5 font-semibold">X</td><td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estado(x).c}`}>{estado(x).t}</span></td><td className="px-3 py-2.5 text-muted-foreground">Menciones por día, lo más reciente y lo más popular</td></tr>
                <tr><td className="px-3 py-2.5 font-semibold">Facebook · Instagram</td><td className="px-3 py-2.5"><span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">No disponible</span></td><td className="px-3 py-2.5 text-muted-foreground">Meta solo entrega datos de cuentas que administras</td></tr>
                <tr><td className="px-3 py-2.5 font-semibold">TikTok</td><td className="px-3 py-2.5"><span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">No disponible</span></td><td className="px-3 py-2.5 text-muted-foreground">No ofrece lectura pública por API</td></tr>
              </tbody>
            </table>
          </div>
          {(yt?.estado !== "ok" || x?.estado !== "ok") && (
            <p className="text-xs text-muted-foreground">Las claves se conectan en <a href="/admin/configuracion" className="font-semibold text-brand hover:underline">Configuración</a>. Mientras tanto, los videos de SoyCabalTV y la prensa se ven en la sección «Prensa sobre María Fernanda», sin necesidad de claves.</p>
          )}
          {yt?.estado === "error" && <Fallo red="YouTube" error={yt.error} />}
          {x?.estado === "error" && <Fallo red="X (Twitter)" error={x.error} />}

          {(ytOk || xOk) && (
            <div className="space-y-3">
              <Pestanas
                etiqueta="Detalle de redes"
                valor={tab}
                onCambio={setTab}
                opciones={[
                  ...(ytOk ? [{ id: "youtube" as const, label: "YouTube" }, { id: "comentarios" as const, label: "Comentarios", n: ytOk.comentarios.length }] : []),
                  ...(xOk ? [{ id: "x" as const, label: "X", n: xOk.recientes.length }] : []),
                ]}
              />
              {tab === "youtube" && ytOk && (
                <div className="rounded-2xl border border-border p-4">
                  <h4 className="text-sm font-semibold">YouTube — {ytOk.canal.nombre}</h4>
                  <p className="mt-1 text-2xl font-bold">
                    {ytOk.canal.suscriptores === null ? "—" : fmt.format(ytOk.canal.suscriptores)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">suscriptores · {fmt.format(ytOk.canal.vistas)} vistas totales</span>
                  </p>
                  {ytOk.enVivo && <p className="mt-1 text-xs font-semibold text-red-600">En vivo ahora: {ytOk.enVivo.espectadores === null ? "espectadores no disponibles" : `${fmt.format(ytOk.enVivo.espectadores)} espectadores`}</p>}
                  <p className="mt-3 text-[11px] font-semibold text-muted-foreground">Vistas por semana de publicación (últimos 50 videos)</p>
                  <TrendArea data={ytOk.porSemana.map((s) => ({ label: s.semana, value: s.vistas }))} />
                </div>
              )}
              {tab === "comentarios" && ytOk && (
                <div className="rounded-2xl border border-border p-4">
                  <h4 className="mb-2 text-sm font-semibold">Comentarios más recientes en YouTube</h4>
                  <Publicaciones lista={ytOk.comentarios.slice(0, 8)} vacio="Sin comentarios recientes." />
                </div>
              )}
              {tab === "x" && xOk && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border p-4">
                    <h4 className="text-sm font-semibold">X — menciones por día (7 días)</h4>
                    <p className="mt-1 text-2xl font-bold">{fmt.format(xOk.total7d)} <span className="text-xs font-normal text-muted-foreground">publicaciones</span></p>
                    <TrendArea data={xOk.porDia.map((d) => ({ label: d.fecha, value: d.publicaciones }))} />
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <h4 className="mb-2 text-sm font-semibold">Lo más reciente</h4>
                    <Publicaciones lista={xOk.recientes.slice(0, 6)} vacio="Sin publicaciones recientes." />
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <h4 className="mb-2 text-sm font-semibold">Lo más popular</h4>
                    <Publicaciones lista={xOk.populares.slice(0, 5)} vacio="Sin publicaciones." />
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type PestanaPrensa = "noticias" | "videos" | "medios" | "tendencia" | "reaccion";

export function MonitoreoWidget({ datos, cargando, error, recargar }: ReturnType<typeof useMonitoreo>) {
  const [tab, setTab] = React.useState<PestanaPrensa>("noticias");
  const medioTop = datos?.medios[0];
  const ultimoVideo = datos?.videos[0];
  const cambio = datos && datos.noticiasPrevias30d ? Math.round(((datos.noticias30d - datos.noticiasPrevias30d) / datos.noticiasPrevias30d) * 100) : null;
  return (
    <div className="space-y-4">
      <Encabezado
        chip="Datos reales — YouTube, prensa, Wikipedia"
        actualizado={datos ? new Date(datos.generadoEn).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }) : undefined}
        cargando={cargando}
        recargar={recargar}
      />
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{error}</p>}
      {!datos && cargando && <p className="text-sm text-muted-foreground">Consultando fuentes…</p>}

      {datos && (
        <>
          <div className="rounded-2xl bg-sky-500/10 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Lo más importante</p>
            <p className="mt-1 text-sm leading-relaxed sm:text-base">
              En los últimos 30 días la prensa publicó <strong>{fmt.format(datos.noticias30d)}</strong> noticias sobre María Fernanda
              {cambio !== null && <> ({cambio >= 0 ? "+" : "−"}{Math.abs(cambio)} % frente a los 30 días anteriores)</>}.
              {medioTop && <> El medio que más la menciona es <strong>{medioTop.medio}</strong> ({medioTop.noticias}).</>}
              {ultimoVideo && <> Su último video en SoyCabalTV fue {hace(ultimoVideo.fecha)} y lleva {ultimoVideo.aproximado ? "unas " : ""}{fmt.format(ultimoVideo.vistas)} vistas.</>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <Dato etiqueta="Noticias (30 días)" valor={fmt.format(datos.noticias30d)} detalle={cambio === null ? undefined : `${cambio >= 0 ? "+" : "−"}${Math.abs(cambio)} % vs 30 días previos`} />
            <Dato etiqueta="Medios distintos" valor={fmt.format(datos.medios.length)} detalle={medioTop ? `Más activo: ${medioTop.medio}` : undefined} />
            <Dato etiqueta="Videos recientes" valor={fmt.format(datos.videos.length)} detalle={ultimoVideo ? `Último ${hace(ultimoVideo.fecha)}` : "SoyCabalTV"} />
            <Dato etiqueta="Wikipedia (7 días)" valor={datos.wikipedia ? fmt.format(datos.wikipedia.ultimos) : "—"} detalle={datos.wikipedia ? variacion(datos.wikipedia.ultimos, datos.wikipedia.previos)?.replace("30 días", "7 días") : undefined} />
          </div>

          <Pestanas
            etiqueta="Detalle de la prensa"
            valor={tab}
            onCambio={setTab}
            opciones={[
              { id: "noticias", label: "Noticias", n: datos.ultimasNoticias.length },
              { id: "videos", label: "Videos", n: datos.videos.length },
              { id: "medios", label: "Medios", n: datos.medios.length },
              { id: "tendencia", label: "Tendencia" },
              { id: "reaccion", label: "Reacción pública (IA)" },
            ]}
          />

          {tab === "noticias" && (
            <div className="rounded-2xl border border-border p-4">
              {datos.ultimasNoticias.length === 0 ? <p className="text-xs text-muted-foreground">Sin noticias recientes.</p> : (
                <ul className="divide-y divide-border">
                  {datos.ultimasNoticias.slice(0, 10).map((n) => (
                    <li key={n.enlace} className="py-2 text-xs">
                      <a href={n.enlace} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium hover:underline">{n.titulo}</a>
                      <span className="text-[11px] text-muted-foreground">{n.medio} · {fechaCorta(n.fecha)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "videos" && (
            <div className="rounded-2xl border border-border p-4">
              <p className="mb-1 text-[11px] text-muted-foreground">Canal SoyCabalTV. Las cifras con «≈» son aproximadas (YouTube las redondea en su página pública).</p>
              <ul className="divide-y divide-border">
                {datos.videos.slice(0, 8).map((v) => (
                  <li key={v.enlace} className="py-2 text-xs">
                    <a href={v.enlace} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium hover:underline">{v.titulo}</a>
                    <span className="text-[11px] text-muted-foreground">{v.aproximado ? "≈ " : ""}{fmt.format(v.vistas)} vistas{v.likes === null ? "" : ` · ${fmt.format(v.likes)} me gusta`} · {v.aproximado ? hace(v.fecha) : fechaCorta(v.fecha)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "medios" && (
            <div className="rounded-2xl border border-border p-4">
              <h4 className="mb-3 text-sm font-semibold">Medios que más la mencionan (30 días)</h4>
              <BarList items={datos.medios.map((m) => ({ label: m.medio, value: m.noticias, hint: `${m.noticias}` }))} />
            </div>
          )}

          {tab === "tendencia" && (
            <div className="rounded-2xl border border-border p-4">
              <h4 className="text-sm font-semibold">Noticias por día (30 días)</h4>
              <TrendArea data={datos.mencionesPorDia.map((d) => ({ label: d.fecha, value: d.noticias }))} />
            </div>
          )}

          {tab === "reaccion" && <ReaccionPanel />}
        </>
      )}

      {datos && datos.errores.length > 0 && <p className="text-[11px] text-muted-foreground">No respondieron: {datos.errores.join(", ")}.</p>}
    </div>
  );
}
