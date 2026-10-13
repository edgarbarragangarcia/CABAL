"use client";

import * as React from "react";
import { AtSign, Database, ExternalLink, Globe, Newspaper, RefreshCw, Search, Share2, Users } from "lucide-react";

import { BannerEnVivo, MonitoreoWidget, RedesWidget, useMonitoreo, useRedes } from "@/components/admin/monitoreo-panel";
import { usePeticion } from "@/app/admin/(protected)/analisis-publicaciones/peticion";
import type { DatosPersonaje, NoticiaMarcada, RespuestaPersonajes } from "@/lib/monitoreo/personajes";
import type { PlataformaId, RespuestaMenciones } from "@/lib/monitoreo/menciones-web";

type Seccion = "prensa" | "redes" | "todo" | "politicos";
const SECCIONES: { id: Seccion; label: string; sub: string; icon: typeof Newspaper }[] = [
  { id: "prensa", label: "Prensa sobre María Fernanda", sub: "Noticias, medios, videos y reacción pública", icon: Newspaper },
  { id: "redes", label: "Redes de María Fernanda", sub: "YouTube y X: lo que dicen de ella y sus videos", icon: Share2 },
  { id: "todo", label: "En todas partes", sub: "Facebook, Instagram, TikTok, X, YouTube y la web: dónde la nombran", icon: Globe },
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

/** Dónde nombran a María Fernanda: prensa y lo público de las redes que un buscador indexa, todo en una lista. */
function EnTodasPartes() {
  const [v, setV] = React.useState(0);
  const [filtro, setFiltro] = React.useState<PlataformaId | "todas">("todas");
  const [mostrar, setMostrar] = React.useState(40);
  const r = usePeticion<RespuestaMenciones>(`/api/admin/monitoreo/menciones${v ? `?forzar=1&v=${v}` : ""}`);
  const cargando = r.estado === "cargando";
  const datos = r.estado === "listo" ? r.data : undefined;
  const lista = datos ? datos.menciones.filter((m) => filtro === "todas" || m.plataforma === filtro) : [];
  const conDatos = datos?.plataformas.filter((p) => p.total > 0) ?? [];
  const masActiva = [...conDatos].sort((a, b) => b.total - a.total)[0];
  const ultima = datos?.menciones[0];
  const redes = conDatos.filter((p) => p.id !== "prensa");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">Busca el nombre de María Fernanda en la prensa, Facebook, Instagram, TikTok, X, YouTube y más, sin claves. Se actualiza al abrir y con el botón.</p>
        <button type="button" onClick={() => { setV((n) => n + 1); setMostrar(40); }} disabled={cargando} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
          <RefreshCw className={`size-3 ${cargando ? "animate-spin" : ""}`} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {r.estado === "error" && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{r.error}</p>}
      {!datos && cargando && <p className="text-sm text-muted-foreground">Buscando en todas las fuentes… (puede tardar unos segundos)</p>}

      {datos && (
        <>
          <div className="rounded-2xl bg-sky-500/10 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Lo más importante</p>
            <p className="mt-1 text-sm leading-relaxed sm:text-base">
              {datos.menciones.length === 0 ? "No se encontraron menciones públicas en este momento." : (
                <>
                  Se encontraron <strong>{datos.menciones.length}</strong> menciones públicas en <strong>{conDatos.length}</strong> {conDatos.length === 1 ? "fuente" : "fuentes"}
                  {masActiva ? <>; la más activa es <strong>{masActiva.nombre}</strong> ({masActiva.total})</> : null}.
                  {redes.length > 0 ? <> En redes: {redes.map((p) => `${p.nombre} ${p.total}`).join(" · ")}.</> : " No apareció nada en redes sociales indexadas."}
                  {ultima ? <> La más reciente es de {hace(ultima.fecha)} ({ultima.fuente}).</> : null}
                </>
              )}
            </p>
          </div>

          <div role="tablist" aria-label="Plataforma" className="flex flex-wrap gap-1.5">
            <button type="button" role="tab" aria-selected={filtro === "todas"} onClick={() => { setFiltro("todas"); setMostrar(40); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filtro === "todas" ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`}>Todas <span className="tabular-nums opacity-70">{datos.menciones.length}</span></button>
            {datos.plataformas.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={filtro === p.id} disabled={p.total === 0} onClick={() => { setFiltro(p.id); setMostrar(40); }} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${filtro === p.id ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`} title={p.consultada ? undefined : "No respondió en esta consulta"}>
                <span className="size-2 rounded-full" style={{ background: COLOR_PLATAFORMA[p.id] }} aria-hidden="true" />{p.nombre} <span className="tabular-nums opacity-70">{p.total}</span>
              </button>
            ))}
          </div>

          {lista.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Sin menciones en esta fuente.</p> : (
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {lista.slice(0, mostrar).map((m) => (
                <li key={`${m.plataforma}${m.enlace}`} className="px-4 py-3 text-sm">
                  <a href={m.enlace} target="_blank" rel="noreferrer noopener" className="line-clamp-2 font-medium hover:underline">{m.titulo}</a>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: COLOR_PLATAFORMA[m.plataforma] }}>{datos.plataformas.find((p) => p.id === m.plataforma)?.nombre ?? m.plataforma}</span>
                    {m.fuente} · {hace(m.fecha)}{m.extracto && m.plataforma === "youtube" ? ` · ${m.extracto}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {lista.length > mostrar && <button type="button" onClick={() => setMostrar((n) => n + 40)} className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted">Ver más ({lista.length - mostrar})</button>}

          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Database className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <span>
              {datos.guardado ? "Lo encontrado se guarda en Supabase y la lista acumula 30 días." : "Aún no se guarda el historial: ejecuta supabase/monitoreo.sql en Supabase."} Solo se ven publicaciones públicas que Google, Bing y YouTube indexan: no hay acceso a grupos privados, historias ni comentarios, y Meta y TikTok no permiten buscar su contenido sin ser una institución de investigación o pagar una herramienta de escucha.
            </span>
          </p>
        </>
      )}
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
      <div role="tablist" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
        {seccion === "todo" && <EnTodasPartes />}
        {seccion === "politicos" && <Politicos />}
      </div>
    </div>
  );
}
