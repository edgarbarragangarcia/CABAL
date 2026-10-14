"use client";

import * as React from "react";
import { AtSign, Database, ExternalLink, Eye, Globe, Loader2, MapPin, MessageCircle, Sparkles, ThumbsUp, Newspaper, RefreshCw, Search, Users } from "lucide-react";

import { BannerEnVivo, RedesWidget, useMonitoreo, useRedes } from "@/components/admin/monitoreo-panel";
import { usePeticion } from "@/app/admin/(protected)/analisis-publicaciones/peticion";
import type { DatosPersonaje, NoticiaMarcada, RespuestaPersonajes } from "@/lib/monitoreo/personajes";
import { MapaMedios } from "@/components/admin/mapa-medios";
import { DEPARTAMENTOS_CO, calcularCobertura, type PuntoCobertura } from "@/lib/monitoreo/cobertura";
import { colorDeIndice, COLOR_TONO, type Tono } from "@/lib/monitoreo/tono";
import { MEDIOS_REGIONALES } from "@/lib/monitoreo/medios-regionales";
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

type Pestana = "mapa" | "redes";
type Modo = "publicadas" | "mencionadas";
/** `departamento`: todo lo de un departamento (lo publicado desde allí y lo que habla de él). */
type Lugar = { modo: Modo | "departamento"; dane: string };
type Investigacion = { estado: "corriendo" | "listo" | "pausa" | "error"; consultas?: number; fallidas?: number; nuevas?: number; error?: string };
type Ia = Record<string, Tono>;

const CLAVE_IA = "mafe-tono-ia-v1";
const claveTitulo = (t: string) => t.toLowerCase().replace(/\W+/g, " ").slice(0, 100);
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const diaCO = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
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

/** Mención por día de los últimos 30 días, con el tono: cuándo publican. */
function Cronologia({ lista, tonoDe }: { lista: MencionWeb[]; tonoDe: (m: MencionWeb) => Tono }) {
  const [ahora] = React.useState(() => Date.now());
  const dias = React.useMemo(() => {
    const por = new Map<string, Record<Tono, number>>();
    for (const m of lista) {
      const d = diaCO(m.fecha);
      const c = por.get(d) ?? { positivo: 0, neutral: 0, negativo: 0 };
      c[tonoDe(m)]++;
      por.set(d, c);
    }
    return Array.from({ length: 30 }, (_, i) => {
      const f = diaCO(new Date(ahora - (29 - i) * 86_400_000).toISOString());
      return { f, c: por.get(f) ?? { positivo: 0, neutral: 0, negativo: 0 } };
    });
  }, [lista, tonoDe, ahora]);
  const max = Math.max(1, ...dias.map((d) => d.c.positivo + d.c.neutral + d.c.negativo));
  return (
    <div>
      <div className="flex h-16 items-end gap-0.5" role="img" aria-label="Menciones por día en los últimos 30 días">
        {dias.map((d) => {
          const t = d.c.positivo + d.c.neutral + d.c.negativo;
          return (
            <div key={d.f} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.f}: ${t} (${d.c.positivo} positivas, ${d.c.neutral} neutrales, ${d.c.negativo} negativas)`}>
              {(["negativo", "neutral", "positivo"] as const).map((k) => (d.c[k] ? <div key={k} style={{ height: `${(d.c[k] / max) * 100}%`, background: COLOR_TONO[k] }} /> : null))}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>hace 30 días</span><span>hoy</span></div>
    </div>
  );
}

/** Una mención con su ubicación (de qué portal y ciudad viene, de qué lugar habla), su tono, sus cifras y cuándo se publicó. */
function FilaMencion({ m, tono, plataformas, alLugar }: { m: MencionWeb; tono: Tono; plataformas: RespuestaMenciones["plataformas"]; alLugar: (l: Lugar) => void }) {
  const g = m.geo;
  const sitio = g?.texto && g.texto.dane !== g.medio?.dane ? g.texto : null;
  return (
    <li className="px-4 py-3 text-sm">
      <a href={m.enlace} target="_blank" rel="noreferrer noopener" className="flex items-start gap-2 font-medium hover:underline">
        <span className="mt-1.5"><PuntoTono tono={tono} /></span>
        <span className="line-clamp-2">{m.titulo}</span>
      </a>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: COLOR_PLATAFORMA[m.plataforma] }}>{plataformas.find((p) => p.id === m.plataforma)?.nombre ?? m.plataforma}</span>
        {m.fuente} · {fechaHora(m.fecha)} · {hace(m.fecha)}
        <Cifras likes={m.metricas?.likes} comentarios={m.metricas?.comentarios} vistas={m.metricas?.vistas} />
        {!m.enTitular && <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold" title="El titular no trae su nombre: la nota la menciona en el texto.">en el texto</span>}
        {g?.medio && (
          <button type="button" onClick={() => alLugar({ modo: "publicadas", dane: g.medio!.dane })} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300" title={g.medio.estimado ? `Ciudad estimada por lo que dice la página de ${g.medio.nombre}` : `Portal regional: ${g.medio.nombre}`}>
            <MapPin className="size-3" aria-hidden="true" />Publica: {g.medio.ciudad}{g.medio.estimado ? " (estimado)" : ""}
          </button>
        )}
        {sitio && (
          <button type="button" onClick={() => alLugar({ modo: "mencionadas", dane: sitio.dane })} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-500/20 dark:text-amber-300" title="Lugar que nombra el titular">
            <MapPin className="size-3" aria-hidden="true" />Habla de: {sitio.nombre}
          </button>
        )}
        {m.nacional && !g?.medio && <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold">prensa nacional</span>}
      </span>
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
    </li>
  );
}

/** El termómetro: dónde nombran a María Fernanda en todo el país (prensa, portales, emisoras y páginas de Facebook), con su ciudad, su tono y sus cifras. */
function MariaFernandaEnTodas({ redes }: { redes: ReturnType<typeof useRedes> }) {
  const [v, setV] = React.useState(0);
  const [pestana, setPestana] = React.useState<Pestana>("mapa");
  const [soloTitular, setSoloTitular] = React.useState(true);
  const [modo, setModo] = React.useState<Modo>("publicadas");
  const [lugar, setLugar] = React.useState<Lugar | null>(null);
  const [mostrar, setMostrar] = React.useState(40);
  const [extra, setExtra] = React.useState<MencionWeb[]>([]);
  const [barrido, setBarrido] = React.useState<{ estado: "libre" | "corriendo" | "listo" | "error" | "pausa"; hecha: number; tandas: number; total?: number; error?: string }>({ estado: "libre", hecha: 0, tandas: 27 });
  const [invest, setInvest] = React.useState<Record<string, Investigacion>>({});
  const [recorriendo, setRecorriendo] = React.useState(false);
  const [redFiltro, setRedFiltro] = React.useState<PlataformaId | "todas">("todas");
  const [redMostrar, setRedMostrar] = React.useState(20);
  const [ia, setIa] = React.useState<Ia>(() => {
    try {
      return typeof window === "undefined" ? {} : (JSON.parse(localStorage.getItem(CLAVE_IA) ?? "{}") as Ia);
    } catch {
      return {}; // sin almacenamiento: el tono medido dura mientras la pestaña esté abierta
    }
  });
  const [midiendo, setMidiendo] = React.useState<{ estado: "libre" | "corriendo" | "error"; error?: string }>({ estado: "libre" });
  const r = usePeticion<RespuestaMenciones>(`/api/admin/monitoreo/menciones${v ? `?forzar=1&v=${v}` : ""}`);
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

  async function investigarUno(dep: string): Promise<"ok" | "limitado" | "error"> {
    setInvest((p) => ({ ...p, [dep]: { estado: "corriendo" } }));
    try {
      const res = await fetch(`/api/admin/monitoreo/departamento?dep=${dep}`, { cache: "no-store" });
      const j = (await res.json()) as { menciones?: MencionWeb[]; consultas?: number; fallidas?: number; limitado?: boolean; error?: string };
      if (!res.ok || !j.menciones) throw new Error(j.error ?? "No fue posible consultar las fuentes.");
      setExtra((prev) => [...prev, ...j.menciones!]);
      setInvest((p) => ({ ...p, [dep]: { estado: j.limitado ? "pausa" : "listo", consultas: j.consultas, fallidas: j.fallidas, nuevas: j.menciones!.length } }));
      return j.limitado ? "limitado" : "ok";
    } catch (e) {
      setInvest((p) => ({ ...p, [dep]: { estado: "error", error: e instanceof Error ? e.message : "Error de red." } }));
      return "error";
    }
  }
  async function investigarTodos() {
    setRecorriendo(true);
    for (const [dep] of DEPARTAMENTOS_CO) {
      if (invest[dep]?.estado === "listo") continue;
      if ((await investigarUno(dep)) !== "ok") break; // si Google pide bajar el ritmo, se detiene: «Continuar» sigue por ese departamento
    }
    setRecorriendo(false);
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

  const cob = React.useMemo(() => (datos ? calcularCobertura(base, datos.consultados, tonoDe) : null), [datos, base, tonoDe]);
  const lista = React.useMemo(() => base.filter((m) => (lugar ? (lugar.modo === "departamento" ? !!m.geo?.medio?.dane.startsWith(lugar.dane) || !!m.geo?.texto?.dane.startsWith(lugar.dane) : lugar.modo === "publicadas" ? m.geo?.medio?.dane === lugar.dane : m.geo?.texto?.dane === lugar.dane) : true)), [base, lugar]);
  const elegir = (l: Lugar | null) => {
    setLugar(l);
    setMostrar(40);
  };

  const puntos = cob ? (modo === "publicadas" ? cob.publicadas : cob.mencionadas) : [];
  const depTotales = React.useMemo(() => Object.fromEntries((cob?.departamentos ?? []).map((d) => [d.dep, modo === "publicadas" ? d.publicadas : d.mencionadas])), [cob, modo]);
  const regionales = base.filter((m) => m.geo?.medio).length;
  const conDatos = datos?.plataformas.filter((p) => p.total > 0) ?? [];
  const ultima = base[0];
  const nombreLugar = lugar && cob ? (lugar.modo === "departamento" ? DEPARTAMENTOS_CO.find(([d]) => d === lugar.dane)?.[1] : [...cob.publicadas, ...cob.mencionadas].find((p) => p.dane === lugar.dane)?.nombre) : undefined;
  const cubiertos = new Set(MEDIOS_REGIONALES.map((m) => m.dane.slice(0, 2)));
  const sinPortal = DEPARTAMENTOS_CO.filter(([d]) => !cubiertos.has(d)).map(([, n]) => n);
  const paginasFb = MEDIOS_REGIONALES.filter((m) => m.fb).map((m) => ({ m, n: base.filter((x) => x.plataforma === "facebook" && x.geo?.medio?.id === m.id).length }));
  const conIa = base.filter((m) => ia[claveTitulo(m.titulo)]).length;
  const estimados = base.filter((m) => m.geo?.medio?.estimado).length;
  const masCalidas = cob ? [...cob.publicadas].filter((p) => p.total >= 3) : [];
  const mejor = [...masCalidas].sort((a, b) => b.indice - a.indice)[0];
  const peor = [...masCalidas].sort((a, b) => a.indice - b.indice)[0];
  const cifras = base.reduce((s, m) => ({ likes: s.likes + (m.metricas?.likes ?? 0), comentarios: s.comentarios + (m.metricas?.comentarios ?? 0), vistas: s.vistas + (m.metricas?.vistas ?? 0) }), { likes: 0, comentarios: 0, vistas: 0 });

  const porDepto = React.useMemo(() => {
    const filas = DEPARTAMENTOS_CO.map(([dep, nombre]) => {
      const mias = base.filter((m) => m.geo?.medio?.dane.startsWith(dep) || m.geo?.texto?.dane.startsWith(dep));
      const pub = mias.filter((m) => m.geo?.medio?.dane.startsWith(dep)).length;
      const t = mias.reduce((a, m) => { a[tonoDe(m)]++; return a; }, { positivo: 0, neutral: 0, negativo: 0 } as Record<Tono, number>);
      const portales = MEDIOS_REGIONALES.filter((m) => m.dane.startsWith(dep));
      return { dep, nombre, total: mias.length, pub, hab: mias.length - pub, indice: mias.length ? (t.positivo - t.negativo) / mias.length : 0, ultima: mias.reduce((u, m) => (m.fecha > u ? m.fecha : u), ""), portales: portales.length, conBuscador: portales.filter((m) => m.rss).length };
    });
    return filas;
  }, [base, tonoDe]);
  const investigados = Object.values(invest).filter((i) => i.estado === "listo").length;
  const conMenciones = porDepto.filter((d) => d.total > 0).length;

  const enRedes = React.useMemo(() => base.filter((m) => m.plataforma !== "prensa" && m.plataforma !== "web"), [base]);
  const redesLista = enRedes.filter((m) => redFiltro === "todas" || m.plataforma === redFiltro);
  const redesPlataformas = (datos?.plataformas ?? []).filter((p) => p.id !== "prensa" && p.id !== "web");

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
        <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">{lista.slice(0, mostrar).map((m) => <FilaMencion key={`${m.plataforma}${m.enlace}`} m={m} tono={tonoDe(m)} plataformas={datos!.plataformas} alLugar={(l) => { elegir(l); if (l.modo !== "departamento") setModo(l.modo); }} />)}</ul>
      )}
      {lista.length > mostrar && <button type="button" onClick={() => setMostrar((n) => n + 40)} className="w-full border-t border-border px-4 py-2 text-xs font-semibold text-brand hover:bg-surface-muted">Ver más ({lista.length - mostrar})</button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">El termómetro del alcance de María Fernanda: dónde la nombran en todo el país (prensa, portales y emisoras regionales, páginas de Facebook, Instagram, TikTok, X, YouTube), desde qué ciudad, con qué tono y con qué cifras.</p>
        <button type="button" onClick={() => { setV((n) => n + 1); setMostrar(40); }} disabled={cargando} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
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
                {cob.publicadas[0] && <span className="rounded-full bg-sky-500/10 px-3 py-1.5">Más menciones: <strong>{cob.publicadas[0].nombre}</strong> ({cob.publicadas[0].total})</span>}
                {mejor && <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-900 dark:text-emerald-200">Mejor recibida: <strong>{mejor.nombre}</strong></span>}
                {peor && mejor && peor.dane !== mejor.dane && <span className="rounded-full bg-red-500/10 px-3 py-1.5 text-red-900 dark:text-red-200">Más rechazo: <strong>{peor.nombre}</strong></span>}
                {ultima && <span className="rounded-full bg-surface-muted px-3 py-1.5">Última: <strong>{fechaHora(ultima.fecha)}</strong> · {ultima.fuente}</span>}
              </div>
            </>
          )}
        </div>
      )}

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

          <div role="tablist" aria-label="Qué mostrar" className="flex flex-wrap gap-1.5">
            {([["publicadas", "Dónde se publica", "La ciudad del portal que publica la nota"], ["mencionadas", "De qué lugar hablan", "El lugar que nombra el titular"]] as const).map(([id, texto, ayuda]) => (
              <button key={id} type="button" role="tab" aria-selected={modo === id} title={ayuda} onClick={() => { setModo(id); setLugar(null); }} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${modo === id ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`}>{texto} <span className="tabular-nums opacity-70">{(id === "publicadas" ? cob.publicadas : cob.mencionadas).reduce((s, p) => s + p.total, 0)}</span></button>
            ))}
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div>
              <MapaMedios puntos={puntos} departamentos={depTotales} colorDe={(p) => colorDeIndice(p.indice * 2.5)} elegido={lugar?.modo === modo ? lugar.dane : null} alElegir={(dane) => elegir(dane ? { modo, dane } : null)} etiqueta={modo === "publicadas" ? "Ciudades desde las que se publica" : "Lugares de los que hablan los titulares"} />
              <div className="mx-auto mt-1 flex max-w-xs items-center gap-2 text-[11px] text-muted-foreground">
                <span>negativo</span>
                <span aria-hidden="true" className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${colorDeIndice(-1)}, ${colorDeIndice(0)}, ${colorDeIndice(1)})` }} />
                <span>positivo</span>
              </div>
              <p className="mt-1 text-center text-[11px] text-muted-foreground">El tamaño es cuántas menciones; el color, el tono promedio.</p>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{modo === "publicadas" ? "Ciudades desde las que se publica" : "Lugares de los que hablan los titulares"}</p>
              <Ranking puntos={puntos} elegido={lugar?.modo === modo ? lugar.dane : null} alElegir={(dane) => { const activo = lugar?.modo === modo && lugar.dane === dane; elegir(activo ? null : { modo, dane }); }} detalle={detalleLugar} />
              {cob.nacionales.total > 0 && modo === "publicadas" && (
                <p className="mt-3 flex flex-wrap items-center gap-x-3 rounded-xl bg-surface-muted/70 px-3 py-2 text-xs">
                  <span className="font-semibold">Prensa nacional e internacional: {cob.nacionales.total}</span>
                  <span className="text-muted-foreground">no se ubica en una ciudad · {pct(cob.nacionales.tonos.positivo, cob.nacionales.total)} positivo · {pct(cob.nacionales.tonos.negativo, cob.nacionales.total)} negativo</span>
                </p>
              )}
            </div>
          </div>

          {(() => {
            const vacios = DEPARTAMENTOS_CO.filter(([d]) => !(depTotales[d] > 0)).map(([, n]) => n);
            if (vacios.length === 0) return null;
            return (
              <p className="rounded-xl bg-surface-muted/70 px-3 py-2 text-xs">
                <span className="font-semibold">Sin menciones {modo === "publicadas" ? "publicadas desde" : "que hablen de"}: </span>
                <span className="text-muted-foreground">{vacios.join(", ")}.</span>{" "}
                <span className="text-muted-foreground">{barrido.estado === "listo" ? "Ya se buscó en todos sus municipios." : "Pulsa «Buscar a fondo por todo el país» para revisar uno por uno sus municipios (Llanos, Amazonía y Pacífico incluidos)."}</span>
              </p>
            );
          })()}

          <section className="rounded-2xl border border-border p-4">
            <h3 className="font-display text-base font-semibold">Redes sociales y YouTube</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Lo que publican canales, páginas y cuentas de todo el país sobre María Fernanda. No tienen una ciudad de publicación (si el titular nombra un lugar, sale como «Habla de»), por eso no están en las filas de ciudades.</p>
            <div role="tablist" aria-label="Red social" className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" role="tab" aria-selected={redFiltro === "todas"} onClick={() => { setRedFiltro("todas"); setRedMostrar(20); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${redFiltro === "todas" ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`}>Todas <span className="tabular-nums opacity-70">{enRedes.length}</span></button>
              {redesPlataformas.map((p) => {
                const n = enRedes.filter((m) => m.plataforma === p.id).length;
                return (
                  <button key={p.id} type="button" role="tab" aria-selected={redFiltro === p.id} disabled={n === 0} onClick={() => { setRedFiltro(p.id); setRedMostrar(20); }} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${redFiltro === p.id ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`} title={p.consultada ? undefined : "No respondió en esta consulta"}>
                    <span className="size-2 rounded-full" style={{ background: COLOR_PLATAFORMA[p.id] }} aria-hidden="true" />{p.nombre} <span className="tabular-nums opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>
            {redesLista.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Sin publicaciones de esta red en el período.</p> : (
              <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
                {redesLista.slice(0, redMostrar).map((m) => <FilaMencion key={`${m.plataforma}${m.enlace}`} m={m} tono={tonoDe(m)} plataformas={datos!.plataformas} alLugar={(l) => { elegir(l); if (l.modo !== "departamento") setModo(l.modo); }} />)}
              </ul>
            )}
            {redesLista.length > redMostrar && <button type="button" onClick={() => setRedMostrar((n) => n + 20)} className="mt-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted">Ver más ({redesLista.length - redMostrar})</button>}
          </section>

          <section className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <h3 className="font-display text-base font-semibold">Investigación por departamento</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cada departamento se busca por su nombre, su ciudad principal y sus municipios más grandes en prensa, Facebook, Instagram, TikTok, X y YouTube, más el buscador propio de cada portal del directorio.
                  {" "}<strong className="text-foreground">{investigados}</strong> de 33 investigados · <strong className="text-foreground">{conMenciones}</strong> con menciones · <strong className="text-foreground">{33 - conMenciones}</strong> sin ninguna.
                </p>
              </div>
              <button type="button" onClick={investigarTodos} disabled={recorriendo} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60">
                {recorriendo ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Search className="size-3" aria-hidden="true" />}
                {recorriendo ? `Investigando… ${investigados}/33` : investigados > 0 && investigados < 33 ? "Continuar la investigación" : investigados === 33 ? "Volver a investigar los 33" : "Investigar los 33 departamentos"}
              </button>
            </div>
            {Object.values(invest).some((i) => i.estado === "pausa") && <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">Google pidió bajar el ritmo. Espera unos minutos y pulsa «Continuar la investigación»: sigue por el departamento donde quedó y conserva lo ya encontrado.</p>}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr><th className="px-2 py-1.5">Departamento</th><th className="px-2 py-1.5 text-right">Portales</th><th className="px-2 py-1.5 text-right">Publican</th><th className="px-2 py-1.5 text-right">Hablan de él</th><th className="px-2 py-1.5">Tono</th><th className="px-2 py-1.5">Última</th><th className="px-2 py-1.5">Investigación</th></tr>
                </thead>
                <tbody>
                  {porDepto.map((d) => {
                    const i = invest[d.dep];
                    const abierto = lugar?.modo === "departamento" && lugar.dane === d.dep;
                    return (
                      <React.Fragment key={d.dep}>
                        <tr className={`border-t border-border/60 ${abierto ? "bg-brand-soft" : ""}`}>
                          <td className="px-2 py-1.5"><button type="button" onClick={() => elegir(abierto ? null : { modo: "departamento", dane: d.dep })} aria-expanded={abierto} disabled={d.total === 0} className="text-left font-semibold hover:underline disabled:cursor-default disabled:no-underline">{d.nombre}</button></td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground" title={`${d.conBuscador} con buscador propio`}>{d.portales}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{d.pub}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{d.hab}</td>
                          <td className="px-2 py-1.5">{d.total > 0 ? <span className="inline-block size-3 rounded-full align-middle" style={{ background: colorDeIndice(d.indice * 2.5) }} title={`Índice de tono ${d.indice.toFixed(2)}`} /> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{d.ultima ? hace(d.ultima) : "—"}</td>
                          <td className="px-2 py-1.5">
                            {i?.estado === "corriendo" ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" aria-hidden="true" />Investigando…</span>
                              : i?.estado === "listo" ? <span className="text-emerald-700 dark:text-emerald-300" title={`${i.consultas} consultas, ${i.fallidas} sin respuesta`}>✔ {i.consultas! - i.fallidas!}/{i.consultas} consultas · {i.nuevas} resultados</span>
                              : i?.estado === "pausa" ? <button type="button" onClick={() => investigarUno(d.dep)} className="font-semibold text-amber-700 hover:underline dark:text-amber-300">Google limitó: reintentar</button>
                              : i?.estado === "error" ? <button type="button" onClick={() => investigarUno(d.dep)} className="font-semibold text-red-600 hover:underline" title={i.error}>Falló: reintentar</button>
                              : <button type="button" onClick={() => investigarUno(d.dep)} disabled={recorriendo} className="font-semibold text-brand hover:underline disabled:opacity-50">Investigar</button>}
                          </td>
                        </tr>
                        {abierto && <tr><td colSpan={7} className="px-0 pb-2">{detalleLugar}</td></tr>}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">«Sin menciones» no es «no hablan de ella»: es lo que Google, YouTube y los buscadores de los portales entregan. Sin Facebook ni sus grupos privados la zona rural queda sub-representada.</p>
          </section>

          <div>
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Cuándo publican{lugar ? ` · ${nombreLugar ?? ""}` : " · todo el país"} (30 días)</p>
            <Cronologia lista={lista} tonoDe={tonoDe} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Portales y páginas", `${cob.directorio.portales}`, `en ${cob.directorio.departamentos} departamentos${estimados ? `, y ${estimados} medios más ubicados por su página` : ""}`],
              ["Portales consultados", `${cob.directorio.portalesConsultados}`, "con Google Noticias, esta vez"],
              ["Páginas de Facebook leídas", `${cob.directorio.paginasConsultadas}`, `de ${cob.directorio.conFacebook} conocidas`],
              ["Que la nombran", `${cob.directorio.portalesConMenciones}`, `portales o páginas del directorio; ${cob.sinUbicar} notas sin ubicar`],
            ].map(([t, n, sub]) => (
              <div key={t} className="rounded-2xl border border-border bg-surface p-3">
                <p className="text-2xl font-bold tabular-nums">{n}</p>
                <p className="text-xs font-semibold">{t}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          <details className="rounded-2xl border border-border p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><ThumbsUp className="size-4 text-[#1877f2]" aria-hidden="true" /> Páginas de Facebook de portales regionales ({cob.directorio.conFacebook})</summary>
            <p className="mt-2 text-xs text-muted-foreground">Facebook no deja leer sus páginas sin ser una institución de investigación, así que se buscan las publicaciones que Google Noticias indexa de cada página ({cob.directorio.facebookLegible} de {cob.directorio.conFacebook}). Las otras se pueden abrir y buscar «Cabal» a mano.</p>
            <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
              {paginasFb.sort((a, b) => b.n - a.n || a.m.nombre.localeCompare(b.m.nombre)).map(({ m, n }) => (
                <li key={m.id} className="flex items-baseline gap-2 border-b border-border/60 py-1.5 text-xs">
                  <a href={`https://www.facebook.com/${m.fb}`} target="_blank" rel="noreferrer noopener" className="min-w-0 flex-1 truncate font-semibold hover:underline">{m.nombre}<span className="font-normal text-muted-foreground"> · {m.ciudad}</span></a>
                  {m.fbIndexado ? <span className={`tabular-nums ${n > 0 ? "font-bold" : "text-muted-foreground"}`}>{n}</span> : <a href={`https://www.google.com/search?q=${encodeURIComponent(`"María Fernanda Cabal" site:facebook.com/${m.fb}`)}`} target="_blank" rel="noreferrer noopener" className="text-[11px] text-muted-foreground hover:underline" title="Google no entrega sus publicaciones aquí: búscalas a mano">buscar a mano</a>}
                </li>
              ))}
            </ul>
          </details>

          <details className="rounded-2xl border border-border p-4">
            <summary className="cursor-pointer text-sm font-semibold">Portales regionales que no la nombran ({cob.sinMenciones.length})</summary>
            <p className="mt-2 text-xs text-muted-foreground">Se consultaron y no aparece su nombre {soloTitular ? "en ningún titular" : "en ninguna nota"} de los últimos 30 días.</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {cob.sinMenciones.map((m) => <li key={m.id} className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px]"><a href={`https://${m.dominio}`} target="_blank" rel="noreferrer noopener" className="hover:underline">{m.nombre}</a><span className="text-muted-foreground"> · {m.ciudad}</span></li>)}
            </ul>
          </details>

          <div className="space-y-1.5 text-[11px] text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <Database className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>
                <strong className="text-foreground">Cifras:</strong> los me gusta, comentarios y vistas solo los entregan YouTube ({datos.youtubeConClave ? "conectado: se muestran" : "conecta su clave en Configuración para verlos"}) y X; Facebook, Instagram y TikTok no los dan sin su API oficial, así que ahí solo hay el enlace y la fecha. <strong className="text-foreground">Tono:</strong> por palabras es una estimación; «Medir el tono con IA» lo afina.
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>
                Sin portal en el directorio: {sinPortal.join(", ")}. Las notas de esos lugares se ubican por lo que dice el titular. La ciudad de un portal sale de su propia página; la de un medio que no está en el directorio se deduce de lo que dice su página de inicio y se marca «estimado». El lugar de un titular es una estimación y no ubica los que no nombran lugar.
              </span>
            </p>
          </div>
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
