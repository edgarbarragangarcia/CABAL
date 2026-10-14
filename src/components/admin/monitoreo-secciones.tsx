"use client";

import * as React from "react";
import { AtSign, Database, ExternalLink, Globe, MapPin, ThumbsUp, Newspaper, RefreshCw, Search, Users } from "lucide-react";

import { BannerEnVivo, MonitoreoWidget, RedesWidget, useMonitoreo, useRedes } from "@/components/admin/monitoreo-panel";
import { usePeticion } from "@/app/admin/(protected)/analisis-publicaciones/peticion";
import type { DatosPersonaje, NoticiaMarcada, RespuestaPersonajes } from "@/lib/monitoreo/personajes";
import { MapaMedios } from "@/components/admin/mapa-medios";
import { DEPARTAMENTOS_CO, calcularCobertura, type PuntoCobertura } from "@/lib/monitoreo/cobertura";
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

type Pestana = "menciones" | "mapa" | "prensa" | "redes";
type Modo = "publicadas" | "mencionadas";
type Filtro = PlataformaId | "todas" | "regional";
type Lugar = { modo: Modo; dane: string };

/** Las burbujas del mapa y su lista: cuántas menciones vienen de cada ciudad (o hablan de ella). */
function Ranking({ puntos, color, elegido, alElegir, detalle }: { puntos: PuntoCobertura[]; color: string; elegido: string | null; alElegir: (dane: string) => void; /** Se despliega bajo la fila elegida. */ detalle?: React.ReactNode }) {
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
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full" style={{ width: `${Math.max(3, (p.total / max) * 100)}%`, background: color }} /></span>
              {p.medios.length > 0 && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{p.medios.slice(0, 3).map((m) => `${m.nombre} ${m.total}`).join(" · ")}</span>}
            </span>
            <span className="text-sm font-bold tabular-nums">{p.total}</span>
          </button>
          {elegido === p.dane && detalle}
        </li>
      ))}
    </ol>
  );
}

/** Una mención con su ubicación: de qué portal y ciudad viene, y de qué lugar habla. */
function FilaMencion({ m, plataformas, alLugar }: { m: MencionWeb; plataformas: RespuestaMenciones["plataformas"]; alLugar: (l: Lugar) => void }) {
  const g = m.geo;
  const sitio = g?.texto && g.texto.dane !== g.medio?.dane ? g.texto : null;
  return (
    <li className="px-4 py-3 text-sm">
      <a href={m.enlace} target="_blank" rel="noreferrer noopener" className="line-clamp-2 font-medium hover:underline">{m.titulo}</a>
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: COLOR_PLATAFORMA[m.plataforma] }}>{plataformas.find((p) => p.id === m.plataforma)?.nombre ?? m.plataforma}</span>
        {m.fuente} · {hace(m.fecha)}
        {!m.enTitular && <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold" title="El titular no trae su nombre: la nota la menciona en el texto.">en el texto</span>}
        {g?.medio && (
          <button type="button" onClick={() => alLugar({ modo: "publicadas", dane: g.medio!.dane })} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300" title={`Portal regional: ${g.medio.nombre}`}>
            <MapPin className="size-3" aria-hidden="true" />Publica: {g.medio.ciudad}
          </button>
        )}
        {sitio && (
          <button type="button" onClick={() => alLugar({ modo: "mencionadas", dane: sitio.dane })} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-500/20 dark:text-amber-300" title="Lugar que nombra el titular">
            <MapPin className="size-3" aria-hidden="true" />Habla de: {sitio.nombre}
          </button>
        )}
      </span>
    </li>
  );
}

/** Todo lo que se sabe de María Fernanda en un solo lugar: menciones en prensa y redes (con su ciudad), mapa regional, reacción de la prensa y redes oficiales. */
function MariaFernandaEnTodas({ monitoreo, redes }: { monitoreo: ReturnType<typeof useMonitoreo>; redes: ReturnType<typeof useRedes> }) {
  const [v, setV] = React.useState(0);
  const [pestana, setPestana] = React.useState<Pestana>("menciones");
  const [filtro, setFiltro] = React.useState<Filtro>("todas");
  const [soloTitular, setSoloTitular] = React.useState(true);
  const [modo, setModo] = React.useState<Modo>("publicadas");
  const [lugar, setLugar] = React.useState<Lugar | null>(null);
  const [mostrar, setMostrar] = React.useState(40);
  const r = usePeticion<RespuestaMenciones>(`/api/admin/monitoreo/menciones${v ? `?forzar=1&v=${v}` : ""}`);
  const cargando = r.estado === "cargando";
  const datos = r.estado === "listo" ? r.data : undefined;

  const base = React.useMemo(() => (datos ? datos.menciones.filter((m) => !soloTitular || m.enTitular) : []), [datos, soloTitular]);
  const cob = React.useMemo(() => (datos ? calcularCobertura(base, datos.consultados) : null), [datos, base]);
  const lista = React.useMemo(
    () =>
      base.filter((m) => {
        if (filtro === "regional" ? !m.geo?.medio : filtro !== "todas" && m.plataforma !== filtro) return false;
        if (!lugar) return true;
        return lugar.modo === "publicadas" ? m.geo?.medio?.dane === lugar.dane : m.geo?.texto?.dane === lugar.dane;
      }),
    [base, filtro, lugar]
  );
  const elegir = (l: Lugar | null) => {
    setLugar(l);
    setMostrar(40);
  };

  const puntos = cob ? (modo === "publicadas" ? cob.publicadas : cob.mencionadas) : [];
  const depTotales = React.useMemo(() => Object.fromEntries((cob?.departamentos ?? []).map((d) => [d.dep, modo === "publicadas" ? d.publicadas : d.mencionadas])), [cob, modo]);
  const colorModo = modo === "publicadas" ? "#0f766e" : "#d97706";
  const regionales = base.filter((m) => m.geo?.medio).length;
  const conDatos = datos?.plataformas.filter((p) => p.total > 0) ?? [];
  const ultima = base[0];
  const nombreLugar = lugar && cob ? [...cob.publicadas, ...cob.mencionadas].find((p) => p.dane === lugar.dane)?.nombre : undefined;
  const cubiertos = new Set(MEDIOS_REGIONALES.map((m) => m.dane.slice(0, 2)));
  const sinPortal = DEPARTAMENTOS_CO.filter(([d]) => !cubiertos.has(d)).map(([, n]) => n);
  const paginasFb = MEDIOS_REGIONALES.filter((m) => m.fb).map((m) => ({ m, n: base.filter((x) => x.plataforma === "facebook" && x.geo?.medio?.id === m.id).length }));

  const pestanas: { id: Pestana; label: string; n?: number }[] = [
    { id: "menciones", label: "Menciones", n: datos ? base.length : undefined },
    { id: "mapa", label: "De dónde vienen" },
    { id: "prensa", label: "Prensa y reacción" },
    { id: "redes", label: "Redes oficiales" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">Dónde nombran a María Fernanda: prensa nacional y regional, Facebook (páginas de portales de cada región), Instagram, TikTok, X, YouTube y más, sin claves. Cada nota lleva la ciudad del portal que la publica.</p>
        <button type="button" onClick={() => { setV((n) => n + 1); setMostrar(40); }} disabled={cargando} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
          <RefreshCw className={`size-3 ${cargando ? "animate-spin" : ""}`} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {r.estado === "error" && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{r.error}</p>}
      {!datos && cargando && <p className="text-sm text-muted-foreground">Buscando en la prensa, en los portales y en las páginas de Facebook de cada región… (puede tardar unos segundos)</p>}

      {datos && cob && (
        <div className="rounded-2xl bg-sky-500/10 p-4">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Lo más importante</p>
          <p className="mt-1 text-sm leading-relaxed sm:text-base">
            {base.length === 0 ? "No se encontraron menciones públicas en este momento." : (
              <>
                Se encontraron <strong>{base.length}</strong> menciones {soloTitular ? "en titulares" : "en titulares y textos"} en <strong>{conDatos.length}</strong> {conDatos.length === 1 ? "fuente" : "fuentes"}.
                {regionales > 0 ? <> De ellas, <strong>{regionales}</strong> vienen de <strong>{cob.directorio.portalesConMenciones}</strong> portales y páginas de Facebook regionales, publicadas desde <strong>{cob.publicadas.length}</strong> {cob.publicadas.length === 1 ? "ciudad" : "ciudades"}{cob.publicadas[0] ? <>; la que más es <strong>{cob.publicadas[0].nombre}</strong> ({cob.publicadas[0].total})</> : null}.</> : <> Ninguna viene de portales regionales.</>}
                {ultima ? <> La más reciente es de {hace(ultima.fecha)} ({ultima.fuente}).</> : null}
              </>
            )}
          </p>
        </div>
      )}

      <div role="tablist" aria-label="Vista" className="flex gap-1 overflow-x-auto rounded-full bg-surface-muted p-1 [scrollbar-width:none]">
        {pestanas.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${pestana === p.id ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {p.label}{p.n !== undefined && <span className="ml-1 tabular-nums opacity-70">{p.n}</span>}
          </button>
        ))}
      </div>

      {(pestana === "menciones" || pestana === "mapa") && datos && cob && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" checked={soloTitular} onChange={(e) => { setSoloTitular(e.target.checked); setMostrar(40); }} className="size-4 accent-[var(--brand)]" />
            Solo si el titular la nombra
          </label>
          <span className="text-muted-foreground">{soloTitular ? "Cuenta solo notas con su nombre en el titular: se pueden comprobar de un vistazo." : "También cuenta notas que la nombran solo en el texto: pueden ser menciones de pasada."}</span>
        </div>
      )}

      {pestana === "menciones" && datos && cob && (
        <>
          <div role="tablist" aria-label="Plataforma" className="flex flex-wrap gap-1.5">
            <button type="button" role="tab" aria-selected={filtro === "todas"} onClick={() => { setFiltro("todas"); setMostrar(40); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filtro === "todas" ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`}>Todas <span className="tabular-nums opacity-70">{base.length}</span></button>
            <button type="button" role="tab" aria-selected={filtro === "regional"} onClick={() => { setFiltro("regional"); setMostrar(40); }} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${filtro === "regional" ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`}><MapPin className="size-3" aria-hidden="true" />Regionales <span className="tabular-nums opacity-70">{regionales}</span></button>
            {datos.plataformas.map((p) => {
              const n = base.filter((m) => m.plataforma === p.id).length;
              return (
                <button key={p.id} type="button" role="tab" aria-selected={filtro === p.id} disabled={n === 0} onClick={() => { setFiltro(p.id); setMostrar(40); }} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${filtro === p.id ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`} title={p.consultada ? undefined : "No respondió en esta consulta"}>
                  <span className="size-2 rounded-full" style={{ background: COLOR_PLATAFORMA[p.id] }} aria-hidden="true" />{p.nombre} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          {lugar && (
            <p className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold">
              <MapPin className="size-3.5" aria-hidden="true" />
              {lugar.modo === "publicadas" ? "Publicadas desde" : "Que hablan de"} {nombreLugar ?? "este lugar"}: {lista.length}
              <button type="button" onClick={() => elegir(null)} className="ml-auto rounded-full border border-border bg-surface px-2.5 py-0.5 hover:bg-surface-muted">Quitar filtro</button>
            </p>
          )}
          {lista.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Sin menciones con este filtro.</p> : (
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {lista.slice(0, mostrar).map((m) => <FilaMencion key={`${m.plataforma}${m.enlace}`} m={m} plataformas={datos.plataformas} alLugar={(l) => { elegir(l); setModo(l.modo); }} />)}
            </ul>
          )}
          {lista.length > mostrar && <button type="button" onClick={() => setMostrar((n) => n + 40)} className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted">Ver más ({lista.length - mostrar})</button>}
        </>
      )}

      {pestana === "mapa" && datos && cob && (
        <div className="space-y-4">
          <div role="tablist" aria-label="Qué mostrar en el mapa" className="flex flex-wrap gap-1.5">
            {([["publicadas", "Dónde se publica", "La ciudad del portal que publica la nota"], ["mencionadas", "De qué lugar hablan", "El lugar que nombra el titular"]] as const).map(([id, texto, ayuda]) => (
              <button key={id} type="button" role="tab" aria-selected={modo === id} title={ayuda} onClick={() => { setModo(id); setLugar(null); }} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${modo === id ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`}>{texto} <span className="tabular-nums opacity-70">{(id === "publicadas" ? cob.publicadas : cob.mencionadas).reduce((s, p) => s + p.total, 0)}</span></button>
            ))}
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <MapaMedios puntos={puntos} departamentos={depTotales} color={colorModo} elegido={lugar?.modo === modo ? lugar.dane : null} alElegir={(dane) => elegir(dane ? { modo, dane } : null)} etiqueta={modo === "publicadas" ? "Ciudades desde las que se publica" : "Lugares de los que hablan los titulares"} />
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{modo === "publicadas" ? "Ciudades desde las que se publica" : "Lugares de los que hablan los titulares"}</p>
              <Ranking puntos={puntos} color={colorModo} elegido={lugar?.modo === modo ? lugar.dane : null} alElegir={(dane) => { const activo = lugar?.modo === modo && lugar.dane === dane; elegir(activo ? null : { modo, dane }); }} detalle={
                <div className="mt-1.5 mb-2 ml-7 rounded-2xl border border-border bg-surface">
                  <p className="border-b border-border px-4 py-2 text-xs font-semibold">{nombreLugar}: {lista.length} {lista.length === 1 ? "mención" : "menciones"} · prensa y redes</p>
                  {lista.length === 0 ? <p className="px-4 py-3 text-xs text-muted-foreground">Sin menciones con el filtro actual.</p> : (
                    <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">{lista.slice(0, mostrar).map((m) => <FilaMencion key={`${m.plataforma}${m.enlace}`} m={m} plataformas={datos.plataformas} alLugar={(l) => { elegir(l); setModo(l.modo); }} />)}</ul>
                  )}
                  {lista.length > mostrar && <button type="button" onClick={() => setMostrar((n) => n + 40)} className="w-full border-t border-border px-4 py-2 text-xs font-semibold text-brand hover:bg-surface-muted">Ver más ({lista.length - mostrar})</button>}
                </div>
              } />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Portales y páginas", `${cob.directorio.portales}`, `en ${cob.directorio.departamentos} departamentos`],
              ["Portales consultados", `${cob.directorio.portalesConsultados}`, "con Google Noticias, esta vez"],
              ["Páginas de Facebook leídas", `${cob.directorio.paginasConsultadas}`, `de ${cob.directorio.conFacebook} conocidas`],
              ["Que la nombran", `${cob.directorio.portalesConMenciones}`, `portales o páginas, ${cob.sinUbicar} notas sin ubicar`],
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

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Database className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <span>
              Sin portal en el directorio: {sinPortal.join(", ")}. Las notas de esos lugares se ubican por lo que dice el titular. La ciudad de un portal sale de su propia página (dirección, nombre, cobertura); el lugar de un titular, de los nombres de municipios y departamentos que trae: es una estimación y no ubica los que no nombran lugar.
            </span>
          </p>
        </div>
      )}

      {pestana === "prensa" && <MonitoreoWidget {...monitoreo} />}
      {pestana === "redes" && <RedesWidget {...redes} />}

      {datos && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Database className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <span>
            {datos.guardado ? "Lo encontrado se guarda en Supabase y la lista acumula 30 días." : "Aún no se guarda el historial: ejecuta supabase/monitoreo.sql en Supabase."} Solo se ven publicaciones públicas que Google, Bing y YouTube indexan: no hay acceso a grupos privados, historias ni comentarios, y Meta y TikTok no permiten buscar su contenido sin ser una institución de investigación o pagar una herramienta de escucha.
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
        {seccion === "mafe" && <MariaFernandaEnTodas monitoreo={monitoreo} redes={redes} />}
        {seccion === "politicos" && <Politicos />}
      </div>
    </div>
  );
}
