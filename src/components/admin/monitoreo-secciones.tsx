"use client";

import * as React from "react";
import { AtSign, ExternalLink, Newspaper, PlayCircle, RefreshCw, Search, Share2, Users } from "lucide-react";

import { BannerEnVivo, MonitoreoWidget, RedesWidget, useMonitoreo, useRedes } from "@/components/admin/monitoreo-panel";
import { usePeticion } from "@/app/admin/(protected)/analisis-publicaciones/peticion";
import { Kpis } from "@/components/admin/estilo-cabal";
import type { DatosPersonaje, NoticiaMarcada, RespuestaPersonajes } from "@/lib/monitoreo/personajes";

type Seccion = "prensa" | "redes" | "politicos";
const SECCIONES: { id: Seccion; label: string; sub: string; icon: typeof Newspaper }[] = [
  { id: "prensa", label: "Prensa sobre María Fernanda", sub: "Noticias, medios, videos y reacción pública", icon: Newspaper },
  { id: "redes", label: "Redes de María Fernanda", sub: "YouTube y X: lo que dicen de ella y sus videos", icon: Share2 },
  { id: "politicos", label: "Otros políticos", sub: "Qué dicen en sus videos y en la prensa, y si nombran a María Fernanda", icon: Users },
];

const BANDO = { oposicion: "Oposición", derecha: "Derecha", centro: "Centro" } as const;
const hace = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};
const miles = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : n >= 10_000 ? `${Math.round(n / 1000)} mil` : n.toLocaleString("es-CO"));

/** La marca de «nombra a María Fernanda» sobre un video, un titular o una publicación. */
function Marca({ children }: { children: React.ReactNode }) {
  return <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 align-middle text-[10px] font-semibold text-rose-700 dark:text-rose-300"><AtSign className="size-3" aria-hidden="true" />{children}</span>;
}

function Titulo({ children, ayuda }: { children: React.ReactNode; ayuda?: string }) {
  return (
    <div className="mt-4 first:mt-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>
      {ayuda && <p className="text-[11px] text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

function Titulares({ lista, marca, vacio, max = 4 }: { lista: NoticiaMarcada[]; marca: string; vacio: string; max?: number }) {
  if (lista.length === 0) return <p className="mt-1 text-xs text-muted-foreground">{vacio}</p>;
  // Primero los que nombran a María Fernanda.
  const orden = [...lista.filter((n) => n.nombra), ...lista.filter((n) => !n.nombra)].slice(0, max);
  return (
    <ul className="mt-1 space-y-1.5">
      {orden.map((n) => (
        <li key={n.enlace} className="text-xs">
          <a href={n.enlace} target="_blank" rel="noreferrer" className="font-medium hover:underline">{n.titulo}</a>
          {n.nombra && marca && <Marca>{marca}</Marca>}
          <span className="text-muted-foreground"> · {n.medio} · {hace(n.fecha)}</span>
        </li>
      ))}
    </ul>
  );
}

function Tarjeta({ p }: { p: DatosPersonaje }) {
  const r = p.resumen;
  const propios = r.videosQueLaNombran + r.publicacionesQueLaNombran;
  const estado =
    propios > 0
      ? { tono: "bg-rose-500/10 text-rose-800 dark:text-rose-200", texto: `La nombra en ${propios} ${propios === 1 ? "publicación propia" : "publicaciones propias"} (últimos 30 días)` }
      : r.declaracionesQueLaNombran > 0
        ? { tono: "bg-sky-500/10 text-sky-900 dark:text-sky-200", texto: `No la nombra en sus videos; la prensa los cruza con ella (${r.cruces + r.declaracionesQueLaNombran} ${r.cruces + r.declaracionesQueLaNombran === 1 ? "noticia" : "noticias"})` }
        : r.cruces > 0
          ? { tono: "bg-sky-500/10 text-sky-900 dark:text-sky-200", texto: `No la nombra en sus videos; la prensa los cruza con ella (${r.cruces} ${r.cruces === 1 ? "noticia" : "noticias"} en 30 días)` }
          : { tono: "bg-surface-muted text-muted-foreground", texto: "No la nombra en lo que se pudo revisar" };
  return (
    <section className="min-w-0 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-sm font-semibold">{p.nombre}</h4>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{BANDO[p.bando]}</span>
        <a href={`https://x.com/${p.x}`} target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-semibold text-brand hover:underline">@{p.x}</a>
      </div>
      <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${estado.tono}`}>{estado.texto}</p>

      <Titulo ayuda={`Canal oficial: ${p.canal.nombre}. Se revisan el título y la descripción de cada video.`}>Lo que publica en YouTube</Titulo>
      {p.videos.estado === "error" ? (
        <p className="mt-1 text-xs text-red-600">No se pudo leer el canal: {p.videos.error}</p>
      ) : p.videos.items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Sin videos en los últimos 30 días{p.videos.ultimo ? ` (el último fue ${hace(p.videos.ultimo)})` : ""}.</p>
      ) : (
        <ul className="mt-1 space-y-2">
          {p.videos.items.map((v) => (
            <li key={v.id} className="text-xs">
              <a href={v.enlace} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium hover:underline">{v.titulo}</a>
              {v.nombra && <Marca>La nombra en el {v.donde}</Marca>}
              {v.contexto && <span className="mt-0.5 block border-l-2 border-rose-400/60 pl-2 text-muted-foreground italic">«{v.contexto}»</span>}
              <span className="text-muted-foreground">{hace(v.fecha)} · {miles(v.vistas)} vistas</span>
            </li>
          ))}
        </ul>
      )}
      {p.videos.estado === "ok" && p.videos.items.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">{p.videos.nombran} de {p.videos.revisados} videos de los últimos 30 días la nombran.</p>
      )}

      {p.publicaciones.estado === "ok" && (
        <>
          <Titulo>Lo que publica en X</Titulo>
          {p.publicaciones.items.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">Sin publicaciones en los últimos 7 días.</p> : (
            <ul className="mt-1 space-y-2">
              {p.publicaciones.items.slice(0, 4).map((t) => (
                <li key={t.id} className="text-xs">
                  <a href={t.enlace} target="_blank" rel="noreferrer" className="line-clamp-3 font-medium hover:underline">{t.texto}</a>
                  {t.nombra && <Marca>La nombra</Marca>}
                  <span className="block text-muted-foreground">{hace(t.fecha)} · {t.me_gusta.toLocaleString("es-CO")} me gusta · {t.compartidos.toLocaleString("es-CO")} compartidos</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {p.publicaciones.estado === "error" && <p className="mt-2 text-xs text-red-600">X: {p.publicaciones.error}</p>}

      <Titulo ayuda="Titulares de la semana con verbos como trinó, dijo o respondió. Se buscan por palabras: no todos son palabras suyas.">Lo que dice, según la prensa</Titulo>
      <Titulares lista={p.declaraciones} marca="Menciona a María Fernanda" vacio={p.prensaConsultada ? "Sin declaraciones reportadas esta semana." : "No se pudo consultar la prensa ahora."} />

      {p.cruces.length > 0 && (
        <>
          <Titulo ayuda="Noticias de los últimos 30 días donde aparecen los dos, en cualquiera de los dos sentidos: quién habla de quién se ve en el titular.">Cruces con María Fernanda</Titulo>
          <Titulares lista={p.cruces} marca="" vacio="" />
        </>
      )}

      <Titulo>En la prensa</Titulo>
      <Titulares lista={p.prensa} marca="Menciona a María Fernanda" vacio={p.prensaConsultada ? "Sin otras noticias esta semana." : "No se pudo consultar la prensa ahora."} />

      <a href={p.busquedaX} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-semibold hover:bg-surface-muted">
        <Search className="size-3" aria-hidden="true" /> Buscar «Cabal» en su cuenta de X <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </section>
  );
}

function Politicos() {
  const [v, setV] = React.useState(0);
  const r = usePeticion<RespuestaPersonajes>(`/api/admin/monitoreo/personajes${v ? `?forzar=1&v=${v}` : ""}`);
  const cargando = r.estado === "cargando";
  const datos = r.estado === "listo" ? r.data : undefined;
  const error = r.estado === "error" ? r.error : undefined;
  const cargar = () => setV((n) => n + 1);

  const nombranPropios = (p: DatosPersonaje) => p.resumen.videosQueLaNombran + p.resumen.publicacionesQueLaNombran;
  // Primero quienes la nombran en lo suyo, luego quienes la nombran según la prensa, luego los cruces.
  const orden = datos ? [...datos.personajes].sort((a, b) => nombranPropios(b) - nombranPropios(a) || b.resumen.declaracionesQueLaNombran - a.resumen.declaracionesQueLaNombran || b.resumen.cruces - a.resumen.cruces) : [];
  const total = (f: (p: DatosPersonaje) => number) => orden.reduce((s, p) => s + f(p), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">Qué publican en sus videos y qué reporta la prensa que dijeron, y si nombran a María Fernanda. No se necesita ninguna conexión.</p>
        <button type="button" onClick={cargar} disabled={cargando} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
          <RefreshCw className={`size-3 ${cargando ? "animate-spin" : ""}`} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{error}</p>}
      {!datos && cargando && <p className="text-sm text-muted-foreground">Consultando YouTube y la prensa…</p>}
      {datos && (
        <Kpis
          items={[
            { etiqueta: "Vigilados", valor: orden.length, detalle: "políticos de la lista base", icono: Users },
            { etiqueta: "La nombran", valor: orden.filter((p) => nombranPropios(p) > 0).length, detalle: "en sus videos o publicaciones, 30 días", icono: AtSign },
            { etiqueta: "Videos", valor: total((p) => p.resumen.videosQueLaNombran), detalle: "la nombran en título o descripción", icono: PlayCircle },
            { etiqueta: "Cruces", valor: total((p) => p.resumen.cruces + p.resumen.declaracionesQueLaNombran), detalle: "titulares de prensa con los dos, 30 días", icono: Newspaper },
          ]}
        />
      )}
      <div className="grid gap-4 xl:grid-cols-2">{orden.map((p) => <Tarjeta key={p.id} p={p} />)}</div>
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span>X, Facebook, Instagram y TikTok no se pueden leer sin su API: de ellos solo se muestra lo que reporta la prensa y un enlace a la búsqueda en X (se abre con tu sesión). La marca «nombra» busca «Cabal», «MaFe» o su cuenta en el título y la descripción de los videos y en los titulares; no lee el audio del video ni el texto completo de la noticia.</span>
      </p>
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
