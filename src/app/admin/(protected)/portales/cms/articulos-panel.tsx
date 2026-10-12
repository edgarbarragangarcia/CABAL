"use client";

import * as React from "react";
import { Archive, CalendarClock, Copy, ExternalLink, Eye, ImageIcon, Lightbulb, Loader2, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";

import { EXTENSIONES, type Extension, type IdeaIa } from "@/lib/portales/cms/ia";
import { tematicaDe } from "@/lib/portales/cms/tematicas";
import type { AjustesPortal, Articulo, ArticuloLista, EstadoArticulo } from "@/lib/portales/cms/tipos";
import type { Portal } from "@/lib/portales/store";
import { ESTADOS, aForma, cuerpoApi, estadoInfo, formaVacia, type Forma } from "./articulo-forma";
import { botonPrimario, botonSecundario, campo, cuandoLargo, etiquetaCampo, hace, mensajeDe, numero, pedir, tarjeta } from "./comun";
import { EditorArticulo } from "./editor-articulo";

/**
 * Artículos del portal: listado con búsqueda, filtros y acciones en bloque; el editor profesional (ver editor-articulo.tsx) y la
 * generación con IA. Lo que escribe la IA siempre llega como borrador marcado «generado con IA» y no se puede publicar hasta que
 * una persona lo revise.
 */

// ------------------------------------------------------------------ IA ---

function GeneradorIa({ portal, iaLista, cerrar, generado }: { portal: Portal; iaLista: boolean | null; cerrar: () => void; generado: (a: Articulo) => void }) {
  const tematica = tematicaDe(portal.plantilla);
  const [tema, setTema] = React.useState("");
  const [tipoId, setTipoId] = React.useState(tematica.tipos[0]?.id ?? "");
  const [categoria, setCategoria] = React.useState("");
  const [extension, setExtension] = React.useState<Extension>("medio");
  const [palabraClave, setPalabraClave] = React.useState("");
  const [datos, setDatos] = React.useState("");
  const [ideas, setIdeas] = React.useState<IdeaIa[]>([]);
  const [trabajando, setTrabajando] = React.useState<"ideas" | "articulo" | null>(null);
  const [error, setError] = React.useState("");

  async function proponer() {
    setTrabajando("ideas");
    setError("");
    try {
      setIdeas((await pedir<{ ideas: IdeaIa[] }>(`/api/admin/portales/${portal.id}/articulos/ia`, "POST", { modo: "ideas", enfoque: tema })).ideas);
    } catch (e) {
      setError(mensajeDe(e, "No se pudieron proponer ideas."));
    } finally {
      setTrabajando(null);
    }
  }

  async function generar() {
    setTrabajando("articulo");
    setError("");
    try {
      const r = await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos/ia`, "POST", { modo: "articulo", tema, tipoId, categoria: categoria || undefined, extension, palabraClave: palabraClave || undefined, datos: datos || undefined });
      generado(r.articulo);
    } catch (e) {
      setError(mensajeDe(e, "No se pudo generar el artículo."));
      setTrabajando(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal aria-label="Generar con IA">
      <div className="w-full max-w-3xl rounded-3xl bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-brand"><Sparkles className="size-5" /></span>
          <div><h3 className="font-display text-xl font-semibold">Generar un artículo con IA</h3><p className="text-xs text-muted-foreground">Para {portal.nombre} · {tematica.seccion.nombre}</p></div>
          <button type="button" onClick={cerrar} disabled={trabajando === "articulo"} aria-label="Cerrar" className="ml-auto grid size-9 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted disabled:opacity-40"><X className="size-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          {iaLista === false && <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">Todavía no hay una clave de IA configurada. Agrégala en <a href="/admin/configuracion" className="font-semibold underline">Configuración</a> (Claude, Gemini u OpenAI) y vuelve.</p>}
          <label className="block"><span className={etiquetaCampo}>¿De qué trata el artículo?</span>
            <textarea className={`${campo} resize-none`} rows={3} value={tema} maxLength={300} placeholder={tematica.ia.temas[0]} onChange={(e) => setTema(e.target.value)} /></label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={proponer} disabled={!!trabajando} className={botonSecundario}>{trabajando === "ideas" ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />} Proponer ideas</button>
            <span className="text-xs text-muted-foreground">O prueba con: {tematica.ia.temas.slice(0, 2).map((t, i) => <button key={t} type="button" onClick={() => setTema(t)} className="mr-1 underline decoration-dotted hover:text-foreground">{i > 0 ? "· " : ""}{t}</button>)}</span>
          </div>
          {ideas.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {ideas.map((i) => (
                <li key={i.titulo}>
                  <button type="button" onClick={() => { setTema(`${i.titulo}. ${i.enfoque}`.slice(0, 300)); if (i.tipo) setTipoId(i.tipo); if (i.categoria) setCategoria(i.categoria); }} className="h-full w-full rounded-xl border border-border p-3 text-left transition hover:border-brand hover:bg-brand-soft/40">
                    <span className="block text-sm font-semibold">{i.titulo}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{i.enfoque}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={etiquetaCampo}>Tipo de artículo</span><select className={campo} value={tipoId} onChange={(e) => setTipoId(e.target.value)}>{tematica.tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
            <label className="block"><span className={etiquetaCampo}>Categoría</span><select className={campo} value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">La elige la IA</option>{tematica.categorias.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          </div>
          <div>
            <span className={etiquetaCampo}>Extensión</span>
            <div className="inline-flex rounded-full bg-surface-muted p-1 text-sm" role="radiogroup" aria-label="Extensión">
              {(Object.keys(EXTENSIONES) as Extension[]).map((e) => <button key={e} type="button" role="radio" aria-checked={extension === e} onClick={() => setExtension(e)} className={`rounded-full px-4 py-1.5 font-semibold transition ${extension === e ? "bg-brand text-brand-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>{EXTENSIONES[e].etiqueta}<span className="ml-1 hidden text-[11px] font-normal opacity-80 sm:inline">({EXTENSIONES[e].palabras} palabras)</span></button>)}
            </div>
          </div>
          <label className="block"><span className={etiquetaCampo}>Palabra clave para buscadores (opcional)</span><input className={campo} value={palabraClave} maxLength={80} onChange={(e) => setPalabraClave(e.target.value)} /></label>
          <label className="block"><span className={etiquetaCampo}>Datos que debe respetar (opcional)</span><textarea className={`${campo} resize-none`} rows={2} value={datos} maxLength={1200} placeholder="Información que tú sabes y quieres que aparezca tal cual. La IA no inventa cifras." onChange={(e) => setDatos(e.target.value)} /></label>
          <p className="rounded-xl bg-surface-muted p-3 text-xs leading-relaxed text-muted-foreground">La IA escribe un <b className="text-foreground">borrador</b>: queda marcado «generado con IA» y no se puede publicar hasta que lo leas, lo corrijas y marques «Lo revisé». Puede equivocarse: revisa cada dato antes de publicar.</p>
          {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-4">
          <button type="button" onClick={generar} disabled={!!trabajando || tema.trim().length < 5} className={botonPrimario}>{trabajando === "articulo" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {trabajando === "articulo" ? "Escribiendo…" : "Generar borrador"}</button>
          {trabajando === "articulo" && <p className="text-xs text-muted-foreground">Puede tardar hasta un minuto. No cierres esta ventana.</p>}
        </div>
      </div>
    </div>
  );
}


function Miniatura({ url }: { url: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- miniatura de Storage
  return <img src={url} alt="" loading="lazy" className="size-full object-cover" />;
}

// --------------------------------------------------------------- panel ---

type Orden = "reciente" | "titulo" | "lecturas";

export function ArticulosPanel({ portal, ajustes, cambio, abrirIa, pro, avisar }: { portal: Portal; ajustes: AjustesPortal; cambio: () => void; abrirIa?: boolean; pro: boolean; avisar: (texto: string, ok?: boolean) => void }) {
  const tematica = tematicaDe(portal.plantilla);
  const [lista, setLista] = React.useState<ArticuloLista[] | null>(null);
  const [error, setError] = React.useState("");
  const [filtro, setFiltro] = React.useState<"todos" | EstadoArticulo>("todos");
  const [q, setQ] = React.useState("");
  const [categoria, setCategoria] = React.useState("");
  const [orden, setOrden] = React.useState<Orden>("reciente");
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [editor, setEditor] = React.useState<{ id: string | null; forma: Forma; aviso?: string } | null>(null);
  const [ia, setIa] = React.useState(!!abrirIa);
  const [iaLista, setIaLista] = React.useState<boolean | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  const cargar = React.useCallback(async () => {
    try {
      setLista((await pedir<{ articulos: ArticuloLista[] }>(`/api/admin/portales/${portal.id}/articulos`, "GET")).articulos);
      setError("");
    } catch (e) {
      setError(mensajeDe(e, "No se pudieron leer los artículos."));
      setLista([]);
    }
  }, [portal.id]);
  React.useEffect(() => {
    let cancelado = false;
    pedir<{ articulos: ArticuloLista[] }>(`/api/admin/portales/${portal.id}/articulos`, "GET")
      .then((r) => { if (!cancelado) setLista(r.articulos); })
      .catch((e) => { if (!cancelado) { setError(mensajeDe(e, "No se pudieron leer los artículos.")); setLista([]); } });
    pedir<{ proveedor: "anthropic" | "gemini" | "openai"; claves: Record<string, string>; anthropicEnv: boolean }>("/api/admin/configuracion", "GET")
      .then((c) => { if (!cancelado) setIaLista(!!c.claves?.[c.proveedor] || (c.proveedor === "anthropic" && c.anthropicEnv)); })
      .catch(() => { if (!cancelado) setIaLista(null); });
    return () => { cancelado = true; };
  }, [portal.id]);

  async function abrir(id: string) {
    setOcupado(true);
    try {
      const { articulo } = await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos/${id}`, "GET");
      setEditor({ id, forma: aForma(articulo) });
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo abrir el artículo."), false);
    } finally {
      setOcupado(false);
    }
  }

  async function duplicar(a: ArticuloLista) {
    setOcupado(true);
    try {
      const { articulo } = await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos/${a.id}`, "GET");
      const f = { ...aForma(articulo), titulo: `Copia de ${articulo.titulo}`.slice(0, 160), estado: "borrador" as const, slug: "", destacado: false, publicarEn: "", notaRevision: "" };
      const r = await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos`, "POST", cuerpoApi(f));
      await cargar();
      cambio();
      avisar("Se creó una copia como borrador.");
      setEditor({ id: r.articulo.id, forma: aForma(r.articulo) });
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo duplicar."), false);
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarEstado(ids: string[], estado: EstadoArticulo) {
    setOcupado(true);
    let hechos = 0;
    try {
      for (const id of ids) {
        const { articulo } = await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos/${id}`, "GET");
        const f = aForma(articulo);
        await pedir(`/api/admin/portales/${portal.id}/articulos/${id}`, "PUT", cuerpoApi({ ...f, estado, publicarEn: estado === "programado" ? f.publicarEn : "" }));
        hechos++;
      }
      avisar(hechos === 1 ? "Listo." : `${hechos} artículos actualizados.`);
    } catch (e) {
      avisar(`${mensajeDe(e, "No se pudo cambiar el estado.")}${hechos > 0 ? ` (${hechos} sí se actualizaron.)` : ""}`, false);
    } finally {
      setSel(new Set());
      setOcupado(false);
      await cargar();
      cambio();
    }
  }

  async function eliminar(ids: string[]) {
    if (!window.confirm(ids.length === 1 ? "¿Eliminar este artículo? No se puede deshacer." : `¿Eliminar ${ids.length} artículos? No se puede deshacer.`)) return;
    setOcupado(true);
    try {
      for (const id of ids) await pedir(`/api/admin/portales/${portal.id}/articulos/${id}`, "DELETE");
      avisar(ids.length === 1 ? "Artículo eliminado." : `${ids.length} artículos eliminados.`);
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo eliminar."), false);
    } finally {
      setSel(new Set());
      setOcupado(false);
      await cargar();
      cambio();
    }
  }

  if (editor) {
    return <EditorArticulo portal={portal} ajustes={ajustes} pro={pro} id={editor.id} inicial={editor.forma} aviso={editor.aviso} avisar={avisar} volver={() => { setEditor(null); void cargar(); cambio(); }} guardado={() => { void cargar(); cambio(); }} />;
  }

  const todos = lista ?? [];
  const cuenta = (e: EstadoArticulo) => todos.filter((a) => a.estado === e).length;
  const categorias = [...new Set(todos.map((a) => a.categoria).filter(Boolean))].sort((x, y) => x.localeCompare(y, "es"));
  const visibles = todos
    .filter((a) => (filtro === "todos" ? a.estado !== "archivado" || true : a.estado === filtro))
    .filter((a) => !categoria || a.categoria === categoria)
    .filter((a) => !q || `${a.titulo} ${a.resumen} ${a.etiquetas.join(" ")} ${a.autor}`.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => (orden === "titulo" ? x.titulo.localeCompare(y.titulo, "es") : orden === "lecturas" ? y.vistas - x.vistas : y.actualizadoEn.localeCompare(x.actualizadoEn)));
  const chips: { id: "todos" | EstadoArticulo; texto: string; n: number }[] = [
    { id: "todos", texto: "Todos", n: todos.length },
    ...ESTADOS.filter((e) => cuenta(e.id) > 0 || e.id === "publicado" || e.id === "borrador").map((e) => ({ id: e.id as EstadoArticulo, texto: e.texto, n: cuenta(e.id) })),
  ];
  const todosMarcados = visibles.length > 0 && visibles.every((a) => sel.has(a.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">{tematica.seccion.nombre}</h3>
          <p className="text-sm text-muted-foreground">{tematica.seccion.descripcion}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setIa(true)} className={botonSecundario}><Sparkles className="size-4" /> Generar con IA</button>
          <button type="button" onClick={() => setEditor({ id: null, forma: formaVacia(tematica.tipos[0]?.id ?? "") })} className={botonPrimario}><Plus className="size-4" /> Nuevo artículo</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Estado" className="inline-flex flex-wrap gap-1 rounded-full bg-surface p-1 text-sm shadow-sm ring-1 ring-border">
          {chips.map((c) => <button key={c.id} type="button" role="tab" aria-selected={filtro === c.id} onClick={() => { setFiltro(c.id); setSel(new Set()); }} className={`rounded-full px-3.5 py-1.5 font-semibold transition ${filtro === c.id ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>{c.texto} <span className={`ml-1 rounded-full px-1.5 text-[11px] ${filtro === c.id ? "bg-white/20" : "bg-surface-muted"}`}>{c.n}</span></button>)}
        </div>
        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 focus-within:border-brand"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, etiqueta o autor…" aria-label="Buscar artículos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        {categorias.length > 0 && <select aria-label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold"><option value="">Todas las categorías</option>{categorias.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
        <select aria-label="Ordenar" value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold"><option value="reciente">Más recientes</option><option value="titulo">Por título</option><option value="lecturas">Más leídos</option></select>
      </div>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft p-2 text-xs font-semibold">
          <span>{sel.size} seleccionado{sel.size === 1 ? "" : "s"}</span>
          <button type="button" disabled={ocupado} onClick={() => void cambiarEstado([...sel], "publicado")} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5"><Eye className="size-3.5" /> Publicar</button>
          <button type="button" disabled={ocupado} onClick={() => void cambiarEstado([...sel], "borrador")} className="rounded-full bg-surface px-3 py-1.5">Pasar a borrador</button>
          <button type="button" disabled={ocupado} onClick={() => void cambiarEstado([...sel], "archivado")} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5"><Archive className="size-3.5" /> Archivar</button>
          <button type="button" disabled={ocupado} onClick={() => void eliminar([...sel])} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-rose-700 dark:text-rose-300"><Trash2 className="size-3.5" /> Eliminar</button>
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto">Quitar selección</button>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
      {!lista && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Leyendo artículos…</p>}

      {lista && visibles.length === 0 && !error && (
        <div className={`${tarjeta} grid place-items-center gap-3 p-14 text-center`}>
          <Sparkles className="size-8 text-muted-foreground" />
          <p className="font-semibold">{todos.length === 0 ? "Todavía no hay artículos" : "Ningún artículo coincide"}</p>
          <p className="max-w-md text-sm text-muted-foreground">{todos.length === 0 ? "Pídele a la IA un primer borrador sobre un tema de este portal, o escribe uno tú. Con tres o cuatro artículos publicados el portal empieza a verse vivo." : "Cambia el estado o la búsqueda para ver los demás."}</p>
        </div>
      )}

      {visibles.length > 0 && (
        <div className={`${tarjeta} overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-border bg-surface-muted/50 px-5 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <input type="checkbox" aria-label="Seleccionar todos" checked={todosMarcados} onChange={(e) => setSel(e.target.checked ? new Set(visibles.map((a) => a.id)) : new Set())} />
            <span>{visibles.length} artículo{visibles.length === 1 ? "" : "s"}</span>
          </div>
          <ul className="divide-y divide-border">
            {visibles.map((a) => {
              const e = estadoInfo(a.estado);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-surface-muted/40">
                  <input type="checkbox" aria-label={`Seleccionar ${a.titulo}`} checked={sel.has(a.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} />
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-muted text-muted-foreground">
                    {a.portadaUrl ? <Miniatura url={a.portadaUrl} /> : <ImageIcon className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1 basis-64">
                    <button type="button" onClick={() => void abrir(a.id)} disabled={ocupado} className="block max-w-full truncate text-left font-semibold hover:text-brand">{a.titulo}</button>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{[a.categoria || "Sin categoría", tematica.tipos.find((t) => t.id === a.tipo)?.nombre, a.autor].filter(Boolean).join(" · ")} · actualizado {hace(a.actualizadoEn)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.generadoConIa && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${a.revisado ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>IA · {a.revisado ? "revisado" : "sin revisar"}</span>}
                    {a.destacado && <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand">Destacado</span>}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${e.clase}`}>{a.estado === "programado" && <CalendarClock className="size-3" />}{e.texto}{a.estado === "programado" && a.publicarEn ? ` · ${cuandoLargo(a.publicarEn)}` : ""}</span>
                  </div>
                  <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">{numero(a.vistas)} lecturas</span>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => void abrir(a.id)} disabled={ocupado} aria-label={`Editar ${a.titulo}`} className="grid size-8 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted disabled:opacity-50"><Pencil className="size-3.5" /></button>
                    <button type="button" onClick={() => void duplicar(a)} disabled={ocupado} aria-label={`Duplicar ${a.titulo}`} title="Duplicar" className="grid size-8 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted disabled:opacity-50"><Copy className="size-3.5" /></button>
                    {a.estado === "publicado" && portal.estado === "publicado" && <a href={`/p/${portal.slug}/articulos/${a.slug}`} target="_blank" rel="noreferrer noopener" aria-label={`Ver ${a.titulo} en el sitio`} className="grid size-8 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted"><ExternalLink className="size-3.5" /></a>}
                    <button type="button" onClick={() => void eliminar([a.id])} disabled={ocupado} aria-label={`Eliminar ${a.titulo}`} className="grid size-8 place-items-center rounded-full text-rose-600 ring-1 ring-rose-500/30 hover:bg-rose-500/10 disabled:opacity-50"><Trash2 className="size-3.5" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {ia && (
        <GeneradorIa
          portal={portal}
          iaLista={iaLista}
          cerrar={() => setIa(false)}
          generado={(art) => {
            setIa(false);
            void cargar();
            cambio();
            setEditor({ id: art.id, forma: aForma(art), aviso: "Borrador generado con IA y guardado. Léelo con calma, corrige lo que haga falta y marca «Lo revisé» antes de publicarlo." });
          }}
        />
      )}
    </div>
  );
}
