"use client";

import * as React from "react";
import { ExternalLink, Newspaper, RefreshCw, Share2, Users } from "lucide-react";

import { BannerEnVivo, MonitoreoWidget, RedesWidget, useMonitoreo, useRedes } from "@/components/admin/monitoreo-panel";
import { usePeticion } from "@/app/admin/(protected)/analisis-publicaciones/peticion";
import type { RespuestaPersonajes } from "@/lib/monitoreo/personajes";

type Seccion = "prensa" | "redes" | "politicos";
const SECCIONES: { id: Seccion; label: string; sub: string; icon: typeof Newspaper }[] = [
  { id: "prensa", label: "Prensa sobre María Fernanda", sub: "Noticias, medios, videos y reacción pública", icon: Newspaper },
  { id: "redes", label: "Redes de María Fernanda", sub: "YouTube y X: lo que dicen de ella y sus videos", icon: Share2 },
  { id: "politicos", label: "Otros políticos", sub: "Qué publican y qué dice la prensa de ellos", icon: Users },
];

const BANDO = { oposicion: "Oposición", derecha: "Derecha", centro: "Centro" } as const;
const hace = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

function Politicos() {
  const [v, setV] = React.useState(0);
  const r = usePeticion<RespuestaPersonajes>(`/api/admin/monitoreo/personajes${v ? `?forzar=1&v=${v}` : ""}`);
  const cargando = r.estado === "cargando";
  const datos = r.estado === "listo" ? r.data : undefined;
  const error = r.estado === "error" ? r.error : undefined;
  const cargar = () => setV((n) => n + 1);
  const sinToken = datos?.personajes.every((p) => p.publicaciones.estado === "sin_clave");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">Lo último que publican en X y lo que dice la prensa de ellos esta semana.</p>
        <button type="button" onClick={cargar} disabled={cargando} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
          <RefreshCw className={`size-3 ${cargando ? "animate-spin" : ""}`} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{error}</p>}
      {sinToken && (
        <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          Para ver lo que publican en X conecta el token de X en <a href="/admin/configuracion" className="font-semibold underline">Configuración</a>. Mientras tanto se muestra solo la prensa.
        </p>
      )}
      {!datos && cargando && <p className="text-sm text-muted-foreground">Consultando…</p>}
      <div className="grid gap-4 xl:grid-cols-2">
        {datos?.personajes.map((p) => (
          <section key={p.id} className="rounded-2xl border border-border p-4">
            <div className="flex items-baseline gap-2">
              <h4 className="text-sm font-semibold">{p.nombre}</h4>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{BANDO[p.bando]}</span>
              <a href={`https://x.com/${p.x}`} target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-semibold text-brand hover:underline">@{p.x}</a>
            </div>
            <p className="mt-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Publica en X</p>
            {p.publicaciones.estado === "ok" ? (
              p.publicaciones.items.length === 0 ? <p className="text-xs text-muted-foreground">Sin publicaciones en los últimos 7 días.</p> : (
                <ul className="mt-1 space-y-2">
                  {p.publicaciones.items.slice(0, 4).map((t) => (
                    <li key={t.id} className="text-xs">
                      <a href={t.enlace} target="_blank" rel="noreferrer" className="line-clamp-3 font-medium hover:underline">{t.texto}</a>
                      <span className="text-muted-foreground">{hace(t.fecha)} · {t.me_gusta.toLocaleString("es-CO")} me gusta · {t.compartidos.toLocaleString("es-CO")} compartidos</span>
                    </li>
                  ))}
                </ul>
              )
            ) : p.publicaciones.estado === "error" ? (
              <p className="text-xs text-red-600">{p.publicaciones.error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sin token de X.</p>
            )}
            <p className="mt-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">En la prensa</p>
            {p.prensa.length === 0 ? <p className="text-xs text-muted-foreground">Sin noticias esta semana.</p> : (
              <ul className="mt-1 space-y-1.5">
                {p.prensa.slice(0, 4).map((n) => (
                  <li key={n.enlace} className="text-xs">
                    <a href={n.enlace} target="_blank" rel="noreferrer" className="font-medium hover:underline">{n.titulo}</a>
                    <span className="text-muted-foreground"> · {n.medio}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><ExternalLink className="size-3" aria-hidden="true" /> Facebook, Instagram y TikTok no se pueden leer por API pública.</p>
    </div>
  );
}

/** Monitoreo en tres partes: la prensa sobre María Fernanda, sus redes, y lo que publican otros políticos. Cada parte consulta al abrirse. */
export function MonitoreoSecciones() {
  const [seccion, setSeccion] = React.useState<Seccion>("prensa");
  const monitoreo = useMonitoreo();
  const redes = useRedes();
  return (
    <div className="space-y-4">
      <BannerEnVivo datos={monitoreo.datos} />
      <div role="tablist" className="grid gap-2 sm:grid-cols-3">
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={seccion === s.id} onClick={() => setSeccion(s.id)} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${seccion === s.id ? "border-brand bg-brand-soft" : "border-border hover:bg-surface-muted"}`}>
            <s.icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            <span><span className="block text-sm font-semibold">{s.label}</span><span className="block text-xs text-muted-foreground">{s.sub}</span></span>
          </button>
        ))}
      </div>
      <div className="rounded-3xl border border-border bg-surface p-5">
        {seccion === "prensa" && <MonitoreoWidget {...monitoreo} />}
        {seccion === "redes" && <RedesWidget {...redes} />}
        {seccion === "politicos" && <Politicos />}
      </div>
    </div>
  );
}
