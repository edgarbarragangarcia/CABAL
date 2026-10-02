"use client";

import * as React from "react";
import { ExternalLink, Loader2, Radio, RefreshCw, Sparkles } from "lucide-react";

import { BarList, DonutChart, TrendArea } from "@/components/admin/charts";
import type { Monitoreo } from "@/lib/monitoreo";
import type { Sentimiento } from "@/lib/monitoreo/sentimiento";

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

function SentimientoCaja({ hay }: { hay: boolean }) {
  const [s, setS] = React.useState<Sentimiento | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function clasificar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/monitoreo", { method: "POST" });
      const json = (await res.json()) as Sentimiento & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "No fue posible clasificar.");
      setS(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Tono de la prensa</h4>
        <button
          type="button"
          disabled={cargando || !hay}
          onClick={clasificar}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-50"
        >
          {cargando ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
          {s ? "Reclasificar" : "Clasificar con IA"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {s ? (
        <div className="mt-3 flex items-center gap-4">
          <DonutChart
            slices={[
              { label: "Positivo", value: s.positivo, color: "#22c58a" },
              { label: "Neutral", value: s.neutral, color: "#94a3b8" },
              { label: "Negativo", value: s.negativo, color: "#ef4444" },
            ]}
          />
          <p className="text-[11px] text-muted-foreground">
            Clasificados {s.total} titulares recientes con la IA configurada. Mide el tono de los medios, no el de las redes.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          La IA lee los titulares reales más recientes y los clasifica como positivos, neutrales o negativos.
        </p>
      )}
    </div>
  );
}

export function MonitoreoWidget({ datos, cargando, error, recargar }: ReturnType<typeof useMonitoreo>) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Datos reales — YouTube, prensa, Wikipedia
        </span>
        {datos && (
          <span className="text-[11px] text-muted-foreground">
            Actualizado {new Date(datos.generadoEn).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}
          </span>
        )}
        <button
          type="button"
          onClick={recargar}
          disabled={cargando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60"
        >
          <RefreshCw className={`size-3 ${cargando ? "animate-spin" : ""}`} aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{error}</p>}
      {!datos && cargando && <p className="mt-6 text-sm text-muted-foreground">Consultando fuentes…</p>}

      {datos && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border p-4">
            <h4 className="text-sm font-semibold">Noticias por día (30 días)</h4>
            <p className="text-2xl font-bold">
              {fmt.format(datos.noticias30d)}{" "}
              <span className="text-xs font-normal text-muted-foreground">{variacion(datos.noticias30d, datos.noticiasPrevias30d)}</span>
            </p>
            <TrendArea data={datos.mencionesPorDia.map((d) => ({ label: d.fecha, value: d.noticias }))} />
          </div>

          <div className="rounded-2xl border border-border p-4">
            <h4 className="mb-3 text-sm font-semibold">Medios que más la mencionan</h4>
            <BarList items={datos.medios.map((m) => ({ label: m.medio, value: m.noticias, hint: `${m.noticias}` }))} />
          </div>

          <div className="rounded-2xl border border-border p-4">
            <h4 className="mb-2 text-sm font-semibold">Últimas noticias</h4>
            <ul className="space-y-2">
              {datos.ultimasNoticias.slice(0, 6).map((n) => (
                <li key={n.enlace} className="text-xs">
                  <a href={n.enlace} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {n.titulo}
                  </a>
                  <span className="text-muted-foreground"> · {n.medio} · {fechaCorta(n.fecha)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <h4 className="mb-2 text-sm font-semibold">SoyCabalTV — últimos videos</h4>
            <ul className="space-y-2">
              {datos.videos.slice(0, 5).map((v) => (
                <li key={v.enlace} className="text-xs">
                  <a href={v.enlace} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {v.titulo}
                  </a>
                  <span className="text-muted-foreground">
                    {" "}· {fmt.format(v.vistas)} vistas · {fmt.format(v.likes)} me gusta · {fechaCorta(v.fecha)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {datos.wikipedia && (
            <div className="rounded-2xl border border-border p-4">
              <h4 className="text-sm font-semibold">Interés en Wikipedia (7 días)</h4>
              <p className="text-2xl font-bold">
                {fmt.format(datos.wikipedia.ultimos)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  visitas · {variacion(datos.wikipedia.ultimos, datos.wikipedia.previos)?.replace("30 días", "7 días")}
                </span>
              </p>
            </div>
          )}

          <SentimientoCaja hay={datos.ultimasNoticias.length > 0} />
        </div>
      )}

      {datos && datos.errores.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">No respondieron: {datos.errores.join(", ")}.</p>
      )}
      <p className="mt-4 rounded-xl bg-surface-muted p-3 text-[11px] text-muted-foreground">
        X, Facebook e Instagram no se pueden leer sin las credenciales de la cuenta (sus APIs son de pago o exigen sesión);
        por eso los widgets de redes de este tablero siguen siendo simulados hasta que se conecten.
      </p>
    </div>
  );
}
