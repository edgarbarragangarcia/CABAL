"use client";

import * as React from "react";
import { Archive, AtSign, BadgeCheck, Clock, Database, ExternalLink, Eye, Globe, Loader2, MapPin, MessageCircle, Sparkles, ThumbsUp, Newspaper, RefreshCw, Search, Users } from "lucide-react";

import { BannerEnVivo, RedesWidget, useMonitoreo, useRedes } from "@/components/admin/monitoreo-panel";
import { usePeticion } from "@/app/admin/(protected)/analisis-publicaciones/peticion";
import type { DatosPersonaje, NoticiaMarcada, RespuestaPersonajes } from "@/lib/monitoreo/personajes";
import { MapaMedios } from "@/components/admin/mapa-medios";
import { DEPARTAMENTOS_CO, calcularCobertura, type PuntoCobertura } from "@/lib/monitoreo/cobertura";
import { colorDeIndice, COLOR_TONO, type Tono } from "@/lib/monitoreo/tono";
import type { EstadoArchivo } from "@/lib/monitoreo/archivo";
import type { FichaVideo } from "@/lib/monitoreo/ficha-video";
import type { MencionWeb, PlataformaId, RespuestaMenciones } from "@/lib/monitoreo/menciones-web";

type Seccion = "mafe" | "politicos";
const SECCIONES: { id: Seccion; label: string; sub: string; icon: typeof Newspaper }[] = [
  { id: "mafe", label: "María Fernanda en medios y redes", sub: "Prensa nacional y regional, Facebook, YouTube, X y más, con la ciudad de cada portal", icon: Globe },
  { id: "politicos", label: "Otros políticos", sub: "Qué dicen en sus videos y en la prensa, y si nombran a María Fernanda", icon: Users },
];

const BANDO = { oposicion: "Oposición", derecha: "Derecha", centro: "Centro" } as const;
const hace = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 1 ? "hace un momento" : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};
const miles = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : n >= 10_000 ? `${Math.round(n / 1000)} mil` : n.toLocaleString("es-CO"));

/** La marca de «nombra a María Fernanda» sobre un video, un titular o una publicación. */
function Marca({ children }: { children: React.ReactNode }) {
  return <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 align-middle text-[10px] font-semibold text-rose-700 dark:text-rose-300"><AtSign className="size-3" aria-hidden="true" />{children}</span>;
}

type Vista = "videos" | "dicho" | "cruces" | "prensa";

function Titulares({ lista, marca, vacio, max = 5 }: { lista: NoticiaMarcada[]; marca: string; vacio: string; max?: number }) {
  if (lista.length === 0) return <p className="py-3 text-xs text-muted-foreground">{vacio}</p>;
  // Primero los que nombran a María Fernanda.
  const orden = [...lista.filter((n) => n.nombra), ...lista.filter((n) => !n.nombra)].slice(0, max);
  return (
    <ul className="divide-y divide-border">
      {orden.map((n) => (
        <li key={n.enlace} className="py-2 text-xs">
          <a href={n.enlace} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium hover:underline">{n.titulo}</a>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
            {n.medio} · {hace(n.fecha)}
            {n.nombra && marca && <Marca>{marca}</Marca>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Tarjeta({ p }: { p: DatosPersonaje }) {
  const r = p.resumen;
  const propios = r.videosQueLaNombran + r.publicacionesQueLaNombran;
  const cruzan = r.cruces + r.declaracionesQueLaNombran;
  const inicial: Vista = propios > 0 ? "videos" : cruzan > 0 ? "cruces" : "videos";
  const [vista, setVista] = React.useState<Vista>(inicial);
  const estado =
    propios > 0
      ? { tono: "bg-rose-500/10 text-rose-800 dark:text-rose-200", texto: `La nombra en ${propios} ${propios === 1 ? "publicación propia" : "publicaciones propias"} (30 días)` }
      : cruzan > 0
        ? { tono: "bg-sky-500/10 text-sky-900 dark:text-sky-200", texto: `No la nombra en sus videos · ${cruzan} ${cruzan === 1 ? "noticia los cruza" : "noticias los cruzan"} con ella` }
        : { tono: "bg-surface-muted text-muted-foreground", texto: "No la nombra en lo que se pudo revisar" };
  const nVideos = p.videos.estado === "ok" ? p.videos.items.length : 0;
  const pestañas: { id: Vista; label: string; n: number }[] = [
    { id: "videos", label: "Videos", n: nVideos },
    { id: "dicho", label: "Lo que dice", n: p.declaraciones.length },
    { id: "cruces", label: "Cruces", n: p.cruces.length },
    { id: "prensa", label: "Prensa", n: p.prensa.length },
  ];
  const sinPrensa = p.prensaConsultada ? "Sin titulares esta semana." : "No se pudo consultar la prensa ahora.";
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-base font-semibold">{p.nombre}</h4>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{BANDO[p.bando]}</span>
        <a href={`https://x.com/${p.x}`} target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-semibold text-brand hover:underline">@{p.x}</a>
      </div>
      <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${estado.tono}`}>{estado.texto}</p>

      <div role="tablist" aria-label={`Fuentes de ${p.nombre}`} className="mt-3 flex gap-1 overflow-x-auto rounded-full bg-surface-muted p-1 [scrollbar-width:none]">
        {pestañas.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={vista === t.id} onClick={() => setVista(t.id)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${vista === t.id ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label} <span className="tabular-nums opacity-70">{t.n}</span>
          </button>
        ))}
      </div>

      <div className="mt-1 min-h-40 flex-1">
        {vista === "videos" && (
          <>
            <p className="pt-2 text-[11px] text-muted-foreground">Canal <a href={p.canal.enlace} target="_blank" rel="noreferrer" className="font-semibold hover:underline">{p.canal.nombre}</a> · se revisa título y descripción.</p>
            {p.videos.estado === "error" ? (
              <p className="py-3 text-xs text-red-600">No se pudo leer el canal: {p.videos.error}</p>
            ) : p.videos.items.length === 0 ? (
              <p className="py-3 text-xs text-muted-foreground">Sin videos en los últimos 30 días{p.videos.ultimo ? ` (el último fue ${hace(p.videos.ultimo)})` : ""}.</p>
            ) : (
              <ul className="divide-y divide-border">
                {[...p.videos.items.filter((v) => v.nombra), ...p.videos.items.filter((v) => !v.nombra)].slice(0, 6).map((v) => (
                  <li key={v.id} className="py-2 text-xs">
                    <a href={v.enlace} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium hover:underline">{v.titulo}</a>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                      {hace(v.fecha)} · {miles(v.vistas)} vistas
                      {v.nombra && <Marca>La nombra en el {v.donde}</Marca>}
                    </span>
                    {v.contexto && <span className="mt-1 block border-l-2 border-rose-400/60 pl-2 text-[11px] text-muted-foreground italic">«{v.contexto}»</span>}
                  </li>
                ))}
              </ul>
            )}
            {p.videos.estado === "ok" && p.videos.revisados > 0 && <p className="text-[11px] text-muted-foreground">{p.videos.nombran} de {p.videos.revisados} videos de 30 días la nombran.</p>}
            {p.publicaciones.estado === "ok" && p.publicaciones.items.slice(0, 3).map((t) => (
              <p key={t.id} className="mt-2 text-xs"><a href={t.enlace} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium hover:underline">{t.texto}</a>{t.nombra && <Marca>La nombra</Marca>}</p>
            ))}
            {p.publicaciones.estado === "error" && <p className="mt-2 text-xs text-red-600">X: {p.publicaciones.error}</p>}
          </>
        )}
        {vista === "dicho" && (
          <>
            <p className="pt-2 text-[11px] text-muted-foreground">Titulares con trinó, dijo, respondió… Se buscan por palabras: no todos son palabras suyas.</p>
            <Titulares lista={p.declaraciones} marca="Menciona a María Fernanda" vacio={sinPrensa} />
          </>
        )}
        {vista === "cruces" && (
          <>
            <p className="pt-2 text-[11px] text-muted-foreground">Noticias de 30 días donde aparecen los dos; el titular dice quién habla de quién.</p>
            <Titulares lista={p.cruces} marca="" vacio="Sin noticias que los crucen en 30 días." />
          </>
        )}
        {vista === "prensa" && (
          <>
            <p className="pt-2 text-[11px] text-muted-foreground">Otras noticias de la semana sobre {p.nombre}.</p>
            <Titulares lista={p.prensa} marca="Menciona a María Fernanda" vacio={sinPrensa} />
          </>
        )}
      </div>

      <a href={p.busquedaX} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full border border-border px-3 py-1 text-[11px] font-semibold hover:bg-surface-muted">
        <Search className="size-3" aria-hidden="true" /> Buscar «Cabal» en su cuenta de X <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    </section>
  );
}

function Politicos() {
  const [v, setV] = React.useState(0);
  const [elegido, setElegido] = React.useState<string | null>(null);
  const r = usePeticion<RespuestaPersonajes>(`/api/admin/monitoreo/personajes${v ? `?forzar=1&v=${v}` : ""}`);
  const cargando = r.estado === "cargando";
  const datos = r.estado === "listo" ? r.data : undefined;
  const error = r.estado === "error" ? r.error : undefined;
  const cargar = () => setV((n) => n + 1);

  const propios = (p: DatosPersonaje) => p.resumen.videosQueLaNombran + p.resumen.publicacionesQueLaNombran;
  const cruzan = (p: DatosPersonaje) => p.resumen.cruces + p.resumen.declaracionesQueLaNombran;
  const orden = datos ? [...datos.personajes].sort((a, b) => propios(b) - propios(a) || cruzan(b) - cruzan(a)) : [];
  const actual = orden.find((p) => p.id === elegido) ?? orden[0];
  const quienesLaNombran = orden.filter((p) => propios(p) > 0);
  const masCruzado = orden.reduce<DatosPersonaje | undefined>((m, p) => (!m || cruzan(p) > cruzan(m) ? p : m), undefined);
  const totalCruces = orden.reduce((s, p) => s + cruzan(p), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">Qué publican seis figuras políticas en YouTube y qué reporta la prensa de ellas, y si nombran a María Fernanda. Sin conexiones ni claves.</p>
        <button type="button" onClick={cargar} disabled={cargando} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
          <RefreshCw className={`size-3 ${cargando ? "animate-spin" : ""}`} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{error}</p>}
      {!datos && cargando && <p className="text-sm text-muted-foreground">Consultando YouTube y la prensa…</p>}

      {datos && actual && (
        <>
          <div className={`rounded-2xl p-4 ${quienesLaNombran.length > 0 ? "bg-rose-500/10" : "bg-sky-500/10"}`}>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Lo más importante</p>
            <p className="mt-1 text-sm leading-relaxed sm:text-base">
              {quienesLaNombran.length > 0 ? (
                <><strong>{quienesLaNombran.map((p) => p.nombre).join(", ")}</strong> {quienesLaNombran.length === 1 ? "nombra" : "nombran"} a María Fernanda en sus publicaciones de los últimos 30 días.</>
              ) : (
                <><strong>Ninguno de los {orden.length}</strong> nombra a María Fernanda en sus videos de los últimos 30 días.</>
              )}{" "}
              La prensa los vincula con ella en <strong>{totalCruces}</strong> {totalCruces === 1 ? "titular" : "titulares"}{masCruzado && cruzan(masCruzado) > 0 ? <>; el que más aparece junto a ella es <strong>{masCruzado.nombre}</strong> ({cruzan(masCruzado)})</> : null}.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[34rem] text-left text-xs sm:text-sm">
              <thead className="bg-surface-muted text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">Político</th>
                  <th className="px-3 py-2">Videos (30 días)</th>
                  <th className="px-3 py-2">La nombra</th>
                  <th className="px-3 py-2">Titulares con ella</th>
                  <th className="px-3 py-2">Último video</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orden.map((p) => {
                  const sel = p.id === actual.id;
                  return (
                    <tr key={p.id} onClick={() => setElegido(p.id)} className={`cursor-pointer transition hover:bg-surface-muted ${sel ? "bg-brand-soft" : ""}`}>
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => setElegido(p.id)} aria-pressed={sel} className="text-left font-semibold">{p.nombre}</button>
                        <span className="block text-[11px] text-muted-foreground">{BANDO[p.bando]}</span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{p.videos.estado === "ok" ? p.videos.revisados : "—"}</td>
                      <td className="px-3 py-2.5">
                        {propios(p) > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300"><AtSign className="size-3" aria-hidden="true" />Sí · {propios(p)}</span> : <span className="text-muted-foreground">No</span>}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-semibold">{cruzan(p)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{p.videos.estado === "ok" && p.videos.ultimo ? hace(p.videos.ultimo) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Detalle · {actual.nombre} <span className="font-normal normal-case">(elige otro en la tabla)</span></p>
            <Tarjeta key={actual.id} p={actual} />
          </div>

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Database className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <span>{datos.guardado ? "Lo encontrado se guarda en Supabase y las listas acumulan 30 días de historial." : "Todavía no se guarda el historial: ejecuta supabase/monitoreo.sql en Supabase para que se acumule."}</span>
          </p>
        </>
      )}
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <span>X, Facebook, Instagram y TikTok no se pueden leer sin su API: de ellos solo se muestra lo que reporta la prensa y un enlace a la búsqueda en X. La marca «nombra» busca «Cabal», «MaFe» o su cuenta en título y descripción de videos y en titulares; no oye el video ni lee la noticia completa.</span>
      </p>
    </div>
  );
}

const COLOR_PLATAFORMA: Record<PlataformaId, string> = {
  prensa: "#0f766e", facebook: "#1877f2", instagram: "#e1306c", tiktok: "#111827", x: "#374151", youtube: "#dc2626",
  threads: "#4b5563", reddit: "#f97316", linkedin: "#0a66c2", telegram: "#0ea5e9", web: "#6b7280",
};

const NOMBRE_PLAT: Record<string, string> = { prensa: "Prensa", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", x: "X", youtube: "YouTube", threads: "Threads", reddit: "Reddit", linkedin: "LinkedIn", telegram: "Telegram", web: "Web" };
type Pestana = "mapa" | "redes";
/** `departamento`: todo lo de un departamento (lo publicado desde allí y lo que habla de él). */
type Lugar = { modo: "lugar" | "departamento"; dane: string };
type Ia = Record<string, Tono>;

const CLAVE_IA = "mafe-tono-ia-v1";
const claveTitulo = (t: string) => t.toLowerCase().replace(/\W+/g, " ").slice(0, 100);
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const TXT_TONO: Record<Tono, string> = { positivo: "positivo", neutral: "neutral", negativo: "negativo" };
const fmtN = (n: number) => n.toLocaleString("es-CO");
const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)} %` : "0 %");

/** Los likes, comentarios y vistas de una publicación o de una ciudad (solo lo que la fuente entrega). */
function Cifras({ likes, comentarios, vistas }: { likes?: number; comentarios?: number; vistas?: number }) {
  if (!likes && !comentarios && !vistas) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 text-[11px] text-muted-foreground">
      {!!vistas && <span className="inline-flex items-center gap-1" title="Vistas"><Eye className="size-3" aria-hidden="true" />{miles(vistas)}</span>}
      {!!likes && <span className="inline-flex items-center gap-1" title="Me gusta"><ThumbsUp className="size-3" aria-hidden="true" />{miles(likes)}</span>}
      {!!comentarios && <span className="inline-flex items-center gap-1" title="Comentarios"><MessageCircle className="size-3" aria-hidden="true" />{miles(comentarios)}</span>}
    </span>
  );
}

function PuntoTono({ tono }: { tono: Tono }) {
  return <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: COLOR_TONO[tono] }} title={`Tono ${TXT_TONO[tono]}`} aria-label={`Tono ${TXT_TONO[tono]}`} />;
}

/** Barra de tonos: verde, gris y rojo en proporción. */
function BarraTonos({ tonos, ancho }: { tonos: Record<Tono, number>; ancho: number }) {
  const total = tonos.positivo + tonos.neutral + tonos.negativo;
  return (
    <span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
      <span className="flex h-full" style={{ width: `${Math.max(3, ancho * 100)}%` }}>
        {(["positivo", "neutral", "negativo"] as const).map((t) => (tonos[t] ? <span key={t} className="h-full" style={{ width: `${(tonos[t] / total) * 100}%`, background: COLOR_TONO[t] }} /> : null))}
      </span>
    </span>
  );
}

/** Las ciudades de la lista: cuántas menciones, con qué tono y con qué cifras. Al elegir una se despliegan sus noticias. */
function Ranking({ puntos, elegido, alElegir, detalle }: { puntos: PuntoCobertura[]; elegido: string | null; alElegir: (dane: string) => void; /** Se despliega bajo la fila elegida. */ detalle?: React.ReactNode }) {
  if (puntos.length === 0) return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Sin menciones con lugar conocido con este filtro.</p>;
  const max = Math.max(1, ...puntos.map((p) => p.total));
  return (
    <ol className="space-y-1.5">
      {puntos.slice(0, 14).map((p, i) => (
        <li key={p.dane}>
          <button type="button" onClick={() => alElegir(p.dane)} aria-pressed={elegido === p.dane} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-surface-muted ${elegido === p.dane ? "bg-brand-soft" : ""}`}>
            <span className="w-5 text-right text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2 text-sm"><span className="truncate font-semibold">{p.nombre}</span><span className="truncate text-[11px] text-muted-foreground">{p.dane.length === 2 ? "departamento" : p.departamento}</span></span>
              <BarraTonos tonos={p.tonos} ancho={p.total / max} />
              <span className="mt-0.5 flex flex-wrap gap-x-2.5 text-[11px] text-muted-foreground">
                {Object.entries(p.porPlataforma).sort((a, b) => b[1] - a[1]).map(([k, n]) => <span key={k} className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: COLOR_PLATAFORMA[k as PlataformaId] ?? "#6b7280" }} aria-hidden="true" />{NOMBRE_PLAT[k] ?? k} {n}</span>)}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {p.medios.length > 0 && <span className="truncate text-[11px] text-muted-foreground">{p.medios.slice(0, 3).map((m) => `${m.nombre} ${m.total}`).join(" · ")}</span>}
                <Cifras likes={p.likes} comentarios={p.comentarios} vistas={p.vistas} />
              </span>
            </span>
            <span className="text-sm font-bold tabular-nums">{p.total}</span>
          </button>
          {elegido === p.dane && detalle}
        </li>
      ))}
    </ol>
  );
}


const idYouTube = (enlace: string) => enlace.match(/[?&]v=([\w-]{6,15})/)?.[1];
/** 2292 → «38:12»; 3725 → «1:02:05». */
const duracion = (seg: number) => {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")}`;
};

/**
 * Una mención con todo lo que se sabe de ella: miniatura, duración, canal (con insignia y suscriptores), fecha y hora exactas,
 * vistas, me gusta, categoría y descripción; además su ubicación (de qué portal y ciudad viene, de qué lugar habla) y su tono.
 * La ficha completa de un video de YouTube llega aparte (`ficha`) y completa lo que la búsqueda no da.
 */
function FilaMencion({ m, tono, plataformas, alLugar, ficha }: { m: MencionWeb; tono: Tono; plataformas: RespuestaMenciones["plataformas"]; alLugar: (l: Lugar) => void; ficha?: FichaVideo }) {
  const g = m.geo;
  const sitio = g?.texto && g.texto.dane !== g.medio?.dane ? g.texto : null;
  const id = m.plataforma === "youtube" ? idYouTube(m.enlace) : undefined;
  const imagen = m.imagen ?? (id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : undefined);
  const segundos = ficha?.segundos ?? null;
  const dur = segundos ? duracion(segundos) : m.duracion;
  // La búsqueda de YouTube solo dice «hace 2 meses»: sin la ficha no se inventa una hora.
  const aprox = !ficha?.publicado && (m.fechaAprox || m.plataforma === "youtube");
  const cuando = ficha?.publicado ? `${fechaHora(ficha.publicado)} · ${hace(ficha.publicado)}` : aprox ? `${m.cuando ?? hace(m.fecha)} (aprox.)` : `${fechaHora(m.fecha)} · ${hace(m.fecha)}`;
  const vistas = ficha?.vistas ?? m.metricas?.vistas;
  const likes = ficha?.likes ?? m.metricas?.likes;
  const descripcion = (ficha?.descripcion || m.descripcion || (m.plataforma === "prensa" ? m.extracto : "") || "").replace(/\s+/g, " ").trim();
  const canal = ficha?.canal || m.fuente;
  return (
    <li className="flex gap-3 px-4 py-3 text-sm">
      {imagen && (
        <a href={m.enlace} target="_blank" rel="noreferrer noopener" tabIndex={-1} aria-hidden="true" className="relative mt-0.5 block aspect-video w-28 shrink-0 self-start overflow-hidden rounded-lg bg-surface-muted sm:w-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagen} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
          {dur && <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-semibold text-white tabular-nums">{dur}</span>}
        </a>
      )}
      <div className="min-w-0 flex-1">
        <a href={m.enlace} target="_blank" rel="noreferrer noopener" className="flex items-start gap-2 font-medium hover:underline">
          <span className="mt-1.5"><PuntoTono tono={tono} /></span>
          <span className="line-clamp-2">{m.titulo}</span>
        </a>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: COLOR_PLATAFORMA[m.plataforma] }}>{plataformas.find((p) => p.id === m.plataforma)?.nombre ?? m.plataforma}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">{canal}{(m.verificado || ficha) && m.verificado && <BadgeCheck className="size-3.5 text-sky-600" aria-label="Canal verificado" />}</span>
          {!!ficha?.suscriptores && <span>{miles(ficha.suscriptores)} suscriptores</span>}
          <span>{cuando}</span>
          {dur && !imagen && <span className="inline-flex items-center gap-1"><Clock className="size-3" aria-hidden="true" />{dur}</span>}
          <Cifras likes={likes} comentarios={m.metricas?.comentarios} vistas={vistas} />
          {ficha?.categoria && <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold">{ficha.categoria}</span>}
          {ficha?.enVivo && <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-700 dark:text-red-300">transmisión</span>}
          {!m.enTitular && <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold" title="El titular no trae su nombre: la nota la menciona en el texto.">en el texto</span>}
          {g?.medio && (
            <button type="button" onClick={() => alLugar({ modo: "lugar", dane: g.medio!.dane })} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300" title="Ver este lugar en el mapa">
              <MapPin className="size-3" aria-hidden="true" />Publica: {g.medio.ciudad}{g.medio.estimado ? " (estimado)" : ""}
            </button>
          )}
          {sitio && (
            <button type="button" onClick={() => alLugar({ modo: "lugar", dane: sitio.dane })} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-500/20 dark:text-amber-300" title="Lugar que nombra el titular">
              <MapPin className="size-3" aria-hidden="true" />Habla de: {sitio.nombre}
            </button>
          )}
          {m.nacional && !g?.medio && <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold">prensa nacional</span>}
        </span>
        {descripcion && <p className="mt-1.5 line-clamp-2 pl-4 text-xs text-muted-foreground">{descripcion}</p>}
        {m.comentariosMuestra && m.comentariosMuestra.length > 0 && (
          <details className="mt-1.5 pl-4">
            <summary className="cursor-pointer text-[11px] font-semibold text-brand">Qué dicen en los comentarios ({m.comentariosMuestra.length} de los más relevantes)</summary>
            <ul className="mt-1.5 space-y-1.5">
              {m.comentariosMuestra.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px]">
                  <span className="mt-1"><PuntoTono tono={c.tono} /></span>
                  <span><span className="font-semibold">{c.autor}</span> · {c.likes} me gusta<span className="block text-muted-foreground">{c.texto}</span></span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
}

type PasoArchivo = { id: string; texto: string; estado: "espera" | "corriendo" | "listo" | "aviso"; detalle?: string };

/**
 * El archivo de menciones en Supabase. «Barrido de hoy» busca lo nuevo, completa las fichas de los videos (vistas, me gusta,
 * suscriptores, fecha exacta) y mide con IA el tono solo de lo que aún no se midió: cada cosa se guarda y no se paga dos veces.
 * «Análisis fuerte del último mes» además recorre todas las ciudades y los 33 departamentos.
 */
function ArchivoPanel({ alTerminar }: { alTerminar: () => void }) {
  const [lectura, setLectura] = React.useState(0);
  const lecturaArchivo = usePeticion<EstadoArchivo>(`/api/admin/monitoreo/archivo?v=${lectura}`);
  const estado = lecturaArchivo.estado === "listo" ? lecturaArchivo.data : null;
  const error = lecturaArchivo.estado === "error" ? lecturaArchivo.error : "";
  const [pasos, setPasos] = React.useState<PasoArchivo[]>([]);
  const [corriendo, setCorriendo] = React.useState(false);
  const parar = React.useRef(false);
  const leer = () => setLectura((n) => n + 1);

  const poner = (id: string, cambio: Partial<PasoArchivo>) => setPasos((p) => p.map((x) => (x.id === id ? { ...x, ...cambio } : x)));
  const json = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, { cache: "no-store", ...init });
    const j = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(j.error ?? `Error ${res.status}`);
    return j;
  };

  async function correr(modo: "hoy" | "mes") {
    parar.current = false;
    setCorriendo(true);
    const lista: PasoArchivo[] = [
      { id: "buscar", texto: "Buscar en prensa, redes y YouTube", estado: "espera" },
      ...(modo === "mes" ? [{ id: "ciudades", texto: "Recorrer las ciudades y municipios", estado: "espera" as const }, { id: "deptos", texto: "Investigar los 33 departamentos", estado: "espera" as const }] : []),
      { id: "fichas", texto: "Completar la ficha de cada video (vistas, me gusta, suscriptores, fecha exacta)", estado: "espera" },
      { id: "tono", texto: "Medir el tono con IA (solo lo que falta)", estado: "espera" },
    ];
    setPasos(lista);
    try {
      poner("buscar", { estado: "corriendo" });
      try {
        const r = await json<RespuestaMenciones>("/api/admin/monitoreo/menciones?forzar=1");
        poner("buscar", { estado: "listo", detalle: `${r.menciones.length} menciones` });
      } catch (e) {
        poner("buscar", { estado: "aviso", detalle: e instanceof Error ? e.message : "No respondió" });
      }

      if (modo === "mes" && !parar.current) {
        poner("ciudades", { estado: "corriendo" });
        let tandas = 27;
        let hechas = 0;
        let limitado = false;
        for (let k = 0; k < tandas && !parar.current; k++) {
          try {
            const t = await json<{ tandas: number; limitado: boolean }>(`/api/admin/monitoreo/barrido?tanda=${k}`);
            tandas = t.tandas;
            hechas = k + 1;
            poner("ciudades", { detalle: `${hechas} de ${tandas} grupos de lugares` });
            if (t.limitado) {
              limitado = true;
              break;
            }
          } catch {
            break;
          }
        }
        poner("ciudades", { estado: limitado || hechas < tandas ? "aviso" : "listo", detalle: limitado ? `Google pidió bajar el ritmo en ${hechas} de ${tandas}: vuelve a correrlo más tarde` : `${hechas} de ${tandas} grupos de lugares` });

        poner("deptos", { estado: "corriendo" });
        let n = 0;
        let alto = false;
        for (const [dep] of DEPARTAMENTOS_CO) {
          if (parar.current) break;
          try {
            const i = await json<{ limitado?: boolean }>(`/api/admin/monitoreo/departamento?dep=${dep}`);
            n++;
            poner("deptos", { detalle: `${n} de ${DEPARTAMENTOS_CO.length} departamentos` });
            if (i.limitado) {
              alto = true;
              break;
            }
          } catch {
            /* un departamento que no responde no detiene al resto */
          }
        }
        poner("deptos", { estado: alto || n < DEPARTAMENTOS_CO.length ? "aviso" : "listo", detalle: alto ? `Google pidió bajar el ritmo tras ${n}: vuelve a correrlo más tarde` : `${n} de ${DEPARTAMENTOS_CO.length} departamentos` });
      }

      for (const [id, accion] of [["fichas", "fichas"], ["tono", "tono"]] as const) {
        if (parar.current) break;
        poner(id, { estado: "corriendo" });
        let total = 0;
        let ultimoError = "";
        let faltan = 0;
        for (let vuelta = 0; vuelta < 40 && !parar.current; vuelta++) {
          try {
            const r = await json<{ hechos: number; pendientes: number }>("/api/admin/monitoreo/archivo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion }) });
            total += r.hechos;
            faltan = r.pendientes;
            poner(id, { detalle: `${total} hechos · faltan ${r.pendientes}` });
            if (r.pendientes === 0 || r.hechos === 0) break;
          } catch (e) {
            ultimoError = e instanceof Error ? e.message : "No respondió";
            break;
          }
        }
        // Quedó trabajo y no se avanzó: no es «listo». Casi siempre falta la clave de IA (tono) o el SQL del archivo.
        if (!ultimoError && faltan > 0 && total === 0) ultimoError = accion === "tono" ? "No se pudo medir el tono: revisa la clave de IA en Configuración" : "No se pudieron leer las fichas de video ahora";
        poner(id, ultimoError ? { estado: "aviso", detalle: `${ultimoError}${total ? ` · ${total} hechos` : ""}${faltan ? ` · faltan ${faltan}` : ""}` } : { estado: "listo", detalle: `${total} hechos` });
      }
    } finally {
      setCorriendo(false);
      leer();
      alTerminar();
    }
  }


  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Archive className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-semibold">Archivo en Supabase · último mes</p>
          <p className="text-xs text-muted-foreground">
            {error ? error : !estado ? "Leyendo el archivo…" : !estado.disponible ? "Para guardar cifras y tono falta ejecutar supabase/monitoreo.sql (Gestor documental › Mapa de datos › «Copiar el SQL que falta»)." : `${fmtN(estado.total)} menciones guardadas${estado.ultimaActualizacion ? ` · actualizado ${hace(estado.ultimaActualizacion)}` : ""} · faltan ${fmtN(estado.pendientes.fichas)} fichas de video y ${fmtN(estado.pendientes.tono)} tonos por medir`}
          </p>
        </div>
        {estado?.sql && !corriendo && (
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(estado.sql ?? ""); }} className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-500/10 dark:text-amber-200" title="Copia el SQL de monitoreo.sql y ejecútalo en el editor SQL de Supabase (se puede repetir)">Copiar el SQL</button>
        )}
        {corriendo ? (
          <button type="button" onClick={() => { parar.current = true; }} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"><Loader2 className="size-3 animate-spin" aria-hidden="true" /> Detener</button>
        ) : (
          <>
            <button type="button" onClick={() => void correr("hoy")} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground" title="Busca lo nuevo y completa las fichas y el tono solo de lo que falta">Barrido de hoy</button>
            <button type="button" onClick={() => void correr("mes")} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-muted" title="Además recorre todas las ciudades y los 33 departamentos: tarda un buen rato">Análisis fuerte del último mes</button>
          </>
        )}
      </div>

      {pasos.length > 0 && (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-surface-muted/60 p-3 text-xs">
          {pasos.map((p) => (
            <li key={p.id} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{p.estado === "corriendo" ? <Loader2 className="size-3.5 animate-spin text-brand" aria-hidden="true" /> : p.estado === "listo" ? <span className="text-emerald-600">✓</span> : p.estado === "aviso" ? <span className="text-amber-600">!</span> : <span className="text-muted-foreground">·</span>}</span>
              <span className={p.estado === "espera" ? "text-muted-foreground" : ""}>{p.texto}{p.detalle ? <span className="text-muted-foreground"> — {p.detalle}</span> : null}</span>
            </li>
          ))}
        </ol>
      )}

    </section>
  );
}

/** El termómetro: dónde nombran a María Fernanda en todo el país (prensa, portales, emisoras y páginas de Facebook), con su ciudad, su tono y sus cifras. */
function MariaFernandaEnTodas({ redes }: { redes: ReturnType<typeof useRedes> }) {
  const [v, setV] = React.useState(0);
  const [pestana, setPestana] = React.useState<Pestana>("mapa");
  const [soloTitular, setSoloTitular] = React.useState(false);
  const [plat, setPlat] = React.useState<PlataformaId | "todas">("todas");
  const [lugar, setLugar] = React.useState<Lugar | null>(null);
  const [mostrar, setMostrar] = React.useState(40);
  const [extra, setExtra] = React.useState<MencionWeb[]>([]);
  const [barrido, setBarrido] = React.useState<{ estado: "libre" | "corriendo" | "listo" | "error" | "pausa"; hecha: number; tandas: number; total?: number; error?: string }>({ estado: "libre", hecha: 0, tandas: 27 });
  const [ia, setIa] = React.useState<Ia>(() => {
    try {
      return typeof window === "undefined" ? {} : (JSON.parse(localStorage.getItem(CLAVE_IA) ?? "{}") as Ia);
    } catch {
      return {}; // sin almacenamiento: el tono medido dura mientras la pestaña esté abierta
    }
  });
  const [midiendo, setMidiendo] = React.useState<{ estado: "libre" | "corriendo" | "error"; error?: string }>({ estado: "libre" });
  // Al abrir se lee lo guardado en Supabase (rápido y sin gastar búsquedas); «Actualizar» sale a buscar en vivo.
  const [modo, setModo] = React.useState<"archivo" | "vivo">("archivo");
  const r = usePeticion<RespuestaMenciones>(modo === "archivo" ? `/api/admin/monitoreo/menciones?archivo=1&v=${v}` : `/api/admin/monitoreo/menciones${v ? `?forzar=1&v=${v}` : ""}`);
  // Fichas completas de los videos que se ven (fecha exacta, me gusta, suscriptores…): llegan aparte y completan cada fila.
  const [fichas, setFichas] = React.useState<Record<string, FichaVideo>>({});
  const pedidas = React.useRef<Set<string>>(new Set());
  const cargando = r.estado === "cargando";
  const datos = r.estado === "listo" ? r.data : undefined;

  const tonoDe = React.useCallback((m: MencionWeb): Tono => ia[claveTitulo(m.titulo)] ?? m.tono ?? "neutral", [ia]);

  async function buscarAFondo() {
    const desde = barrido.estado === "pausa" || barrido.estado === "error" ? barrido.hecha : 0;
    let tandas = barrido.tandas;
    let total = barrido.total;
    setBarrido({ estado: "corriendo", hecha: desde, tandas, total });
    for (let k = desde; k < tandas; k++) {
      try {
        const res = await fetch(`/api/admin/monitoreo/barrido?tanda=${k}`, { cache: "no-store" });
        const j = (await res.json()) as { menciones?: MencionWeb[]; tandas?: number; total?: number; limitado?: boolean; error?: string };
        if (!res.ok || !j.menciones) throw new Error(j.error ?? "No fue posible consultar las fuentes.");
        tandas = j.tandas ?? tandas;
        total = j.total ?? total;
        setExtra((prev) => [...prev, ...j.menciones!]);
        if (j.limitado) {
          setBarrido({ estado: "pausa", hecha: k, tandas, total });
          return;
        }
        setBarrido({ estado: "corriendo", hecha: k + 1, tandas, total });
      } catch (e) {
        setBarrido({ estado: "error", hecha: k, tandas, total, error: e instanceof Error ? e.message : "Error de red." });
        return;
      }
    }
    setBarrido({ estado: "listo", hecha: tandas, tandas, total });
  }

  const todas = React.useMemo(() => {
    if (!datos) return [];
    const vistos = new Set<string>();
    return [...datos.menciones, ...extra]
      .sort((a, b) => Number(!!b.geo?.medio) - Number(!!a.geo?.medio) || b.fecha.localeCompare(a.fecha))
      .filter((m) => {
        const k = `${m.plataforma}|${m.enlace}`;
        const t = `${m.plataforma}|${claveTitulo(m.titulo)}`;
        if (vistos.has(k) || vistos.has(t)) return false;
        vistos.add(k);
        vistos.add(t);
        return true;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [datos, extra]);
  const base = React.useMemo(() => todas.filter((m) => !soloTitular || m.enTitular), [todas, soloTitular]);

  async function medirTono() {
    const pendientes = base.filter((m) => !ia[claveTitulo(m.titulo)]).slice(0, 400);
    if (pendientes.length === 0) return;
    setMidiendo({ estado: "corriendo" });
    try {
      const res = await fetch("/api/admin/monitoreo/tono", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ textos: pendientes.map((m) => m.titulo) }) });
      const j = (await res.json()) as { tonos?: (Tono | null)[]; error?: string };
      if (!res.ok || !j.tonos) throw new Error(j.error ?? "No fue posible medir el tono.");
      const nuevo: Ia = { ...ia };
      pendientes.forEach((m, i) => j.tonos![i] && (nuevo[claveTitulo(m.titulo)] = j.tonos![i]!));
      setIa(nuevo);
      try {
        localStorage.setItem(CLAVE_IA, JSON.stringify(Object.fromEntries(Object.entries(nuevo).slice(-3000))));
      } catch {
        /* no se pudo recordar */
      }
      setMidiendo({ estado: "libre" });
    } catch (e) {
      setMidiendo({ estado: "error", error: e instanceof Error ? e.message : "Error de red." });
    }
  }

  const vista = React.useMemo(() => base.filter((m) => plat === "todas" || m.plataforma === plat), [base, plat]);
  const cob = React.useMemo(() => (datos ? calcularCobertura(vista, datos.consultados, tonoDe) : null), [datos, vista, tonoDe]);
  const lista = React.useMemo(
    () =>
      vista.filter((m) => {
        if (!lugar) return true;
        const d = m.geo?.medio?.dane ?? m.geo?.texto?.dane;
        return !!d && (lugar.modo === "departamento" ? d.startsWith(lugar.dane) : d === lugar.dane);
      }),
    [vista, lugar]
  );
  const elegir = (l: Lugar | null) => {
    setLugar(l);
    setMostrar(40);
  };

  // Los videos que están a la vista (la lista y las menciones sin lugar) piden su ficha en grupos de diez.
  const visibles = React.useMemo(() => [...lista.slice(0, mostrar), ...(cob?.sinLugar.slice(0, 40) ?? [])], [lista, mostrar, cob]);
  React.useEffect(() => {
    const ids = [...new Set(visibles.map((m) => (m.plataforma === "youtube" ? idYouTube(m.enlace) : undefined)).filter((x): x is string => !!x))].filter((id) => !pedidas.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => pedidas.current.add(id));
    let cancelado = false;
    (async () => {
      for (let i = 0; i < ids.length && !cancelado; i += 10) {
        try {
          const res = await fetch(`/api/admin/monitoreo/video?ids=${ids.slice(i, i + 10).join(",")}`, { cache: "no-store" });
          if (!res.ok) continue;
          const j = (await res.json()) as { fichas?: Record<string, FichaVideo> };
          if (!cancelado && j.fichas) setFichas((f) => ({ ...f, ...j.fichas }));
        } catch {
          /* se queda con lo que dio la búsqueda */
        }
      }
    })();
    return () => { cancelado = true; };
  }, [visibles]);

  const puntos = cob?.lugares ?? [];
  const depTotales = cob?.porDepartamento ?? {};
  const regionales = base.filter((m) => m.geo?.medio).length;
  const conDatos = datos?.plataformas.filter((p) => p.total > 0) ?? [];
  const ultima = base[0];
  const nombreLugar = lugar && cob ? (lugar.modo === "departamento" ? DEPARTAMENTOS_CO.find(([d]) => d === lugar.dane)?.[1] : cob.lugares.find((p) => p.dane === lugar.dane)?.nombre) : undefined;
  const conIa = base.filter((m) => ia[claveTitulo(m.titulo)]).length;
  const estimados = base.filter((m) => m.geo?.medio?.estimado).length;
  const masCalidas = cob ? [...cob.lugares].filter((p) => p.total >= 3) : [];
  const mejor = [...masCalidas].sort((a, b) => b.indice - a.indice)[0];
  const peor = [...masCalidas].sort((a, b) => a.indice - b.indice)[0];
  const cifras = base.reduce((s, m) => ({ likes: s.likes + (m.metricas?.likes ?? 0), comentarios: s.comentarios + (m.metricas?.comentarios ?? 0), vistas: s.vistas + (m.metricas?.vistas ?? 0) }), { likes: 0, comentarios: 0, vistas: 0 });


  const pestanas: { id: Pestana; label: string; n?: number }[] = [
    { id: "mapa", label: "De dónde vienen", n: datos ? base.length : undefined },
    { id: "redes", label: "Redes oficiales" },
  ];
  const detalleLugar = (
    <div className="mt-1.5 mb-2 ml-7 rounded-2xl border border-border bg-surface">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2 text-xs font-semibold">
        <span>{nombreLugar}: {lista.length} {lista.length === 1 ? "mención" : "menciones"} · prensa y redes</span>
        <span className="inline-flex gap-2 font-normal text-muted-foreground">
          <span className="text-emerald-700 dark:text-emerald-300">{lista.filter((m) => tonoDe(m) === "positivo").length} positivas</span>
          <span>{lista.filter((m) => tonoDe(m) === "neutral").length} neutrales</span>
          <span className="text-red-700 dark:text-red-300">{lista.filter((m) => tonoDe(m) === "negativo").length} negativas</span>
        </span>
      </p>
      {lista.length === 0 ? <p className="px-4 py-3 text-xs text-muted-foreground">Sin menciones con el filtro actual.</p> : (
        <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">{lista.slice(0, mostrar).map((m) => <FilaMencion key={`${m.plataforma}${m.enlace}`} m={m} tono={tonoDe(m)} plataformas={datos!.plataformas} alLugar={elegir} ficha={fichas[idYouTube(m.enlace) ?? ""]} />)}</ul>
      )}
      {lista.length > mostrar && <button type="button" onClick={() => setMostrar((n) => n + 40)} className="w-full border-t border-border px-4 py-2 text-xs font-semibold text-brand hover:bg-surface-muted">Ver más ({lista.length - mostrar})</button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">El termómetro del alcance de María Fernanda: dónde la nombran en todo el país (prensa, portales y emisoras regionales, páginas de Facebook, Instagram, TikTok, X, YouTube), desde qué ciudad, con qué tono y con qué cifras.</p>
        <button type="button" onClick={() => { setModo("vivo"); setV((n) => n + 1); setMostrar(40); }} disabled={cargando} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
          <RefreshCw className={`size-3 ${cargando ? "animate-spin" : ""}`} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {r.estado === "error" && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{r.error}</p>}
      {!datos && cargando && <p className="text-sm text-muted-foreground">Buscando en la prensa, en los portales y en las páginas de Facebook de cada región… (puede tardar unos segundos)</p>}

      {datos && cob && (
        <div className="space-y-3">
          {base.length === 0 ? <p className="rounded-2xl bg-surface-muted p-4 text-sm">No se encontraron menciones públicas en este momento.</p> : (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Menciones</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{fmtN(base.length)}</p>
                  <p className="text-xs text-muted-foreground">{soloTitular ? "en titulares" : "en titulares y textos"} · {conDatos.length} {conDatos.length === 1 ? "fuente" : "fuentes"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Desde las regiones</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{fmtN(regionales)} <span className="text-base font-medium text-muted-foreground">{pct(regionales, base.length)}</span></p>
                  <p className="text-xs text-muted-foreground">{cob.directorio.portalesConMenciones + estimados} portales y páginas · {cob.publicadas.length} {cob.publicadas.length === 1 ? "ciudad" : "ciudades"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Tono</p>
                  <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={`${pct(cob.tono.tonos.positivo, cob.tono.total)} positivo, ${pct(cob.tono.tonos.neutral, cob.tono.total)} neutral, ${pct(cob.tono.tonos.negativo, cob.tono.total)} negativo`}>
                    {(["positivo", "neutral", "negativo"] as const).map((t) => (cob.tono.tonos[t] ? <span key={t} style={{ width: `${(cob.tono.tonos[t] / cob.tono.total) * 100}%`, background: COLOR_TONO[t] }} /> : null))}
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs font-semibold"><span className="text-emerald-700 dark:text-emerald-300">{pct(cob.tono.tonos.positivo, cob.tono.total)} positivo</span><span className="text-muted-foreground">{pct(cob.tono.tonos.neutral, cob.tono.total)} neutral</span><span className="text-red-700 dark:text-red-300">{pct(cob.tono.tonos.negativo, cob.tono.total)} negativo</span></p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{conIa > 0 ? `Medido con IA en ${conIa} de ${base.length}; el resto, por palabras` : "Estimado por palabras"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Alcance medible</p>
                  {cifras.vistas + cifras.likes + cifras.comentarios > 0 ? (
                    <>
                      <p className="mt-1 text-3xl font-bold tabular-nums">{miles(cifras.vistas)} <span className="text-base font-medium text-muted-foreground">vistas</span></p>
                      <p className="text-xs text-muted-foreground">{miles(cifras.likes)} me gusta · {miles(cifras.comentarios)} comentarios</p>
                    </>
                  ) : <p className="mt-1 text-sm text-muted-foreground">Sin cifras: solo YouTube y X las entregan.</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {cob.lugares[0] && <span className="rounded-full bg-sky-500/10 px-3 py-1.5">Más menciones: <strong>{cob.lugares[0].nombre}</strong> ({cob.lugares[0].total})</span>}
                {mejor && <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-900 dark:text-emerald-200">Mejor recibida: <strong>{mejor.nombre}</strong></span>}
                {peor && mejor && peor.dane !== mejor.dane && <span className="rounded-full bg-red-500/10 px-3 py-1.5 text-red-900 dark:text-red-200">Más rechazo: <strong>{peor.nombre}</strong></span>}
                {ultima && <span className="rounded-full bg-surface-muted px-3 py-1.5">Última: <strong>{fechaHora(ultima.fecha)}</strong> · {ultima.fuente}</span>}
              </div>
            </>
          )}
        </div>
      )}

      <ArchivoPanel alTerminar={() => { setModo("archivo"); setV((n) => n + 1); }} />

      <div role="tablist" aria-label="Vista" className="flex gap-1 overflow-x-auto rounded-full bg-surface-muted p-1 [scrollbar-width:none]">
        {pestanas.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${pestana === p.id ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {p.label}{p.n !== undefined && <span className="ml-1 tabular-nums opacity-70">{p.n}</span>}
          </button>
        ))}
      </div>

      {pestana === "mapa" && datos && cob && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" checked={soloTitular} onChange={(e) => { setSoloTitular(e.target.checked); setMostrar(40); }} className="size-4 accent-[var(--brand)]" />
              Solo si el titular la nombra
            </label>
            <span className="min-w-0 flex-1 basis-60 text-muted-foreground">{soloTitular ? "Cuenta solo notas con su nombre en el titular: se pueden comprobar de un vistazo." : "También cuenta notas que la nombran solo en el texto: pueden ser menciones de pasada."}</span>
            <button type="button" onClick={medirTono} disabled={midiendo.estado === "corriendo"} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-semibold hover:bg-surface-muted disabled:opacity-60" title="Usa la clave de IA de Configuración para medir el tono de cada titular (entiende quién critica a quién)">
              {midiendo.estado === "corriendo" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Sparkles className="size-3" aria-hidden="true" />}
              {midiendo.estado === "corriendo" ? "Midiendo el tono…" : conIa > 0 ? "Medir el tono de lo nuevo con IA" : "Medir el tono con IA"}
            </button>
            <button type="button" onClick={buscarAFondo} disabled={barrido.estado === "corriendo"} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60" title="Busca «María Fernanda Cabal» + cada una de las principales ciudades del país, en prensa y en Facebook, para encontrar medios que no están en el directorio">
              {barrido.estado === "corriendo" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Search className="size-3" aria-hidden="true" />}
              {barrido.estado === "corriendo" ? `Recorriendo lugares… ${barrido.hecha}/${barrido.tandas}` : barrido.estado === "listo" ? "Volver a buscar a fondo" : barrido.estado === "pausa" || barrido.estado === "error" ? `Continuar desde la tanda ${barrido.hecha + 1}` : "Buscar a fondo por todo el país"}
            </button>
          </div>
          {midiendo.estado === "error" && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">{midiendo.error}</p>}
          {barrido.estado === "pausa" && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">Google pidió bajar el ritmo después de {barrido.hecha + 1} de {barrido.tandas} tandas. Espera unos minutos y pulsa «Continuar»: sigue desde donde quedó y lo ya encontrado se conserva.</p>}
          {barrido.estado === "error" && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">La búsqueda a fondo se detuvo en la tanda {barrido.hecha + 1}: {barrido.error} Lo encontrado hasta ahí se conserva; «Continuar» sigue desde ahí.</p>}
          {barrido.estado === "listo" && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">Búsqueda a fondo terminada: {barrido.total ?? barrido.tandas * 24} lugares revisados en prensa y Facebook (las ciudades principales y todos los municipios de los departamentos con pocos portales). Aportó {Math.max(0, todas.length - (datos?.menciones.length ?? 0))} menciones nuevas, {Math.max(0, todas.filter((m) => m.geo?.medio).length - (datos?.menciones.filter((m) => m.geo?.medio).length ?? 0))} de ellas de portales o páginas regionales.</p>}

          <div role="tablist" aria-label="Red o medio" className="flex flex-wrap gap-1.5">
            <button type="button" role="tab" aria-selected={plat === "todas"} onClick={() => { setPlat("todas"); setLugar(null); }} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${plat === "todas" ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`}>Todo <span className="tabular-nums opacity-70">{base.length}</span></button>
            {datos.plataformas.filter((p) => p.id !== "web").map((p) => {
              const n = base.filter((m) => m.plataforma === p.id).length;
              return (
                <button key={p.id} type="button" role="tab" aria-selected={plat === p.id} disabled={n === 0} onClick={() => { setPlat(p.id); setLugar(null); }} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${plat === p.id ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`} title={p.consultada ? undefined : "No respondió en esta consulta"}>
                  <span className="size-2 rounded-full" style={{ background: COLOR_PLATAFORMA[p.id] }} aria-hidden="true" />{p.nombre} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div>
              <MapaMedios puntos={puntos} departamentos={depTotales} colorDe={(p) => colorDeIndice(p.indice * 2.5)} elegido={lugar?.modo === "lugar" ? lugar.dane : null} alElegir={(dane) => elegir(dane ? { modo: "lugar", dane } : null)} etiqueta="Todas las menciones por lugar" />
              <div className="mx-auto mt-1 flex max-w-xs items-center gap-2 text-[11px] text-muted-foreground">
                <span>negativo</span>
                <span aria-hidden="true" className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${colorDeIndice(-1)}, ${colorDeIndice(0)}, ${colorDeIndice(1)})` }} />
                <span>positivo</span>
              </div>
              <p className="mt-1 text-center text-[11px] text-muted-foreground">El tamaño es cuántas menciones; el color, el tono promedio.</p>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Lugares con más menciones</p>
              <Ranking puntos={puntos} elegido={lugar?.modo === "lugar" ? lugar.dane : null} alElegir={(dane) => { const activo = lugar?.modo === "lugar" && lugar.dane === dane; elegir(activo ? null : { modo: "lugar", dane }); }} detalle={detalleLugar} />
              {cob.nacionales.total > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-x-3 rounded-xl bg-surface-muted/70 px-3 py-2 text-xs">
                  <span className="font-semibold">Prensa nacional e internacional: {cob.nacionales.total}</span>
                  <span className="text-muted-foreground">no se ubica en una ciudad · {pct(cob.nacionales.tonos.positivo, cob.nacionales.total)} positivo · {pct(cob.nacionales.tonos.negativo, cob.nacionales.total)} negativo</span>
                </p>
              )}
            </div>
          </div>

          {(() => {
            const vacios = DEPARTAMENTOS_CO.filter(([d]) => !((depTotales[d] ?? 0) > 0)).map(([, n]) => n);
            if (vacios.length === 0) return null;
            return (
              <p className="rounded-xl bg-surface-muted/70 px-3 py-2 text-xs">
                <span className="font-semibold">Sin ninguna mención ubicada en: </span>
                <span className="text-muted-foreground">{vacios.join(", ")}.</span>{" "}
                <span className="text-muted-foreground">{barrido.estado === "listo" ? "Ya se buscó en todos sus municipios." : "Pulsa «Buscar a fondo por todo el país» para revisar uno por uno sus municipios (Llanos, Amazonía y Pacífico incluidos)."}</span>
              </p>
            );
          })()}

          {cob.sinLugar.length > 0 && (
            <details className="rounded-2xl border border-border p-4">
              <summary className="cursor-pointer text-sm font-semibold">Menciones sin lugar conocido ({cob.sinLugar.length})</summary>
              <p className="mt-2 text-xs text-muted-foreground">No tienen un portal con sede en el directorio ni nombran un lugar en el titular (muchos videos y publicaciones de redes), así que no se pueden poner en el mapa. Están aquí para que no se pierda ninguna.</p>
              <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
                {cob.sinLugar.slice(0, 40).map((m) => <FilaMencion key={`${m.plataforma}${m.enlace}`} m={m} tono={tonoDe(m)} plataformas={datos.plataformas} alLugar={elegir} ficha={fichas[idYouTube(m.enlace) ?? ""]} />)}
              </ul>
              {cob.sinLugar.length > 40 && <p className="mt-2 text-[11px] text-muted-foreground">Se muestran las 40 más recientes de {cob.sinLugar.length}.</p>}
            </details>
          )}

        </div>
      )}

      {pestana === "redes" && <RedesWidget {...redes} />}

      {datos && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Database className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <span>
            {datos.guardado ? "Lo encontrado se guarda en Supabase y la lista acumula 30 días." : "Aún no se guarda el historial: ejecuta supabase/monitoreo.sql en Supabase."} Solo se ven publicaciones públicas que Google, Bing y YouTube indexan: no hay acceso a grupos privados, historias ni comentarios de Facebook, y Meta y TikTok no permiten buscar su contenido sin ser una institución de investigación o pagar una herramienta de escucha.
          </span>
        </p>
      )}
    </div>
  );
}

/** Monitoreo en dos partes: todo sobre María Fernanda (prensa, redes, regiones) y lo que publican otros políticos. Cada parte consulta al abrirse. */
export function MonitoreoSecciones() {
  const [seccion, setSeccion] = React.useState<Seccion>("mafe");
  const monitoreo = useMonitoreo();
  const redes = useRedes();
  return (
    <div className="space-y-4">
      <BannerEnVivo datos={monitoreo.datos} />
      <div role="tablist" className="grid gap-2 sm:grid-cols-2">
        {SECCIONES.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={seccion === s.id} onClick={() => setSeccion(s.id)} className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${seccion === s.id ? "border-brand bg-brand-soft" : "border-border hover:bg-surface-muted"}`}>
            <s.icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            <span><span className="block text-sm font-semibold">{s.label}</span><span className="block text-xs text-muted-foreground">{s.sub}</span></span>
          </button>
        ))}
      </div>
      <div className="rounded-3xl border border-border bg-surface p-5">
        {seccion === "mafe" && <MariaFernandaEnTodas redes={redes} />}
        {seccion === "politicos" && <Politicos />}
      </div>
    </div>
  );
}
