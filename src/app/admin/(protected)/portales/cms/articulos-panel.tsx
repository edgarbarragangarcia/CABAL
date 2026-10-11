"use client";

import * as React from "react";
import { ArrowLeft, Bold, Check, ExternalLink, Heading2, Link2, List, Loader2, Lightbulb, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";

import { Portada, Prosa } from "@/components/portales/cms";
import { construirAmbiente } from "@/components/portales/marco";
import { EXTENSIONES, type Extension, type IdeaIa } from "@/lib/portales/cms/ia";
import { minutosDeLectura, parsearMarkdown } from "@/lib/portales/cms/puro";
import { tematicaDe } from "@/lib/portales/cms/tematicas";
import { problemaParaPublicar, type AjustesPortal, type Articulo, type ArticuloLista, type EstadoArticulo } from "@/lib/portales/cms/tipos";
import type { Portal } from "@/lib/portales/store";
import { botonPrimario, botonSecundario, campo, etiquetaCampo, hace, mensajeDe, numero, pedir, tarjeta } from "./comun";

/**
 * Artículos del portal: listado, editor con vista previa fiel a como se ve en el sitio, y generación con IA. Lo que escribe la
 * IA siempre llega como borrador marcado «generado con IA» y no se puede publicar hasta que una persona lo revise.
 */

type Forma = {
  titulo: string; resumen: string; cuerpo: string; categoria: string; tipo: string; etiquetasTexto: string; autor: string; seoDescripcion: string;
  estado: EstadoArticulo; destacado: boolean; generadoConIa: boolean; revisado: boolean; slug: string;
};

const aForma = (a: Articulo): Forma => ({ titulo: a.titulo, resumen: a.resumen, cuerpo: a.cuerpo, categoria: a.categoria, tipo: a.tipo, etiquetasTexto: a.etiquetas.join(", "), autor: a.autor, seoDescripcion: a.seoDescripcion, estado: a.estado, destacado: a.destacado, generadoConIa: a.generadoConIa, revisado: a.revisado, slug: a.slug });
const formaVacia = (tipo: string): Forma => ({ titulo: "", resumen: "", cuerpo: "", categoria: "", tipo, etiquetasTexto: "", autor: "", seoDescripcion: "", estado: "borrador", destacado: false, generadoConIa: false, revisado: false, slug: "" });
const cuerpoApi = (f: Forma) => ({
  titulo: f.titulo.trim(), resumen: f.resumen.trim(), cuerpo: f.cuerpo, categoria: f.categoria, tipo: f.tipo,
  etiquetas: f.etiquetasTexto.split(",").map((e) => e.trim().replace(/^#/, "")).filter(Boolean).slice(0, 8),
  estado: f.estado, destacado: f.destacado, generadoConIa: f.generadoConIa, revisado: f.revisado, autor: f.autor.trim(), seoDescripcion: f.seoDescripcion.trim(),
  ...(f.slug ? { slug: f.slug } : {}),
});

const ETIQUETA_ESTADO: Record<EstadoArticulo, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-surface-muted text-muted-foreground" },
  publicado: { texto: "Publicado", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  archivado: { texto: "Archivado", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
};

// -------------------------------------------------------------- editor ---

function Editor({ portal, ajustes, id, inicial, aviso, volver, guardado }: { portal: Portal; ajustes: AjustesPortal; id: string | null; inicial: Forma; aviso?: string; volver: () => void; guardado: (a: Articulo) => void }) {
  const tematica = tematicaDe(portal.plantilla);
  const [f, setF] = React.useState<Forma>(inicial);
  const [idActual, setIdActual] = React.useState(id);
  const [ocupado, setOcupado] = React.useState(false);
  const [mensaje, setMensaje] = React.useState<{ ok: boolean; texto: string } | null>(aviso ? { ok: true, texto: aviso } : null);
  const area = React.useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof Forma>(k: K, v: Forma[K]) => setF((x) => ({ ...x, [k]: v }));
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: false, idBase: "previa", cms: null });
  const bloques = React.useMemo(() => parsearMarkdown(f.cuerpo), [f.cuerpo]);
  const problema = f.estado === "publicado" ? problemaParaPublicar({ titulo: f.titulo, cuerpo: f.cuerpo, resumen: f.resumen, generadoConIa: f.generadoConIa, revisado: f.revisado }) : null;

  function insertar(antes: string, despues: string, ejemplo: string) {
    const t = area.current;
    if (!t) return;
    const { selectionStart: i, selectionEnd: j, value } = t;
    const sel = value.slice(i, j) || ejemplo;
    set("cuerpo", value.slice(0, i) + antes + sel + despues + value.slice(j));
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(i + antes.length, i + antes.length + sel.length);
    });
  }

  async function guardar(estado: EstadoArticulo = f.estado) {
    setOcupado(true);
    setMensaje(null);
    try {
      const cuerpo = cuerpoApi({ ...f, estado });
      const r = idActual
        ? await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos/${idActual}`, "PUT", cuerpo)
        : await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos`, "POST", cuerpo);
      setIdActual(r.articulo.id);
      setF(aForma(r.articulo));
      guardado(r.articulo);
      setMensaje({ ok: true, texto: estado === "publicado" ? "Publicado. Ya se ve en el sitio del portal." : "Guardado." });
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeDe(e, "No se pudo guardar el artículo.") });
    } finally {
      setOcupado(false);
    }
  }

  const url = `/p/${portal.slug}/articulos/${f.slug}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={volver} className={botonSecundario}><ArrowLeft className="size-4" /> Artículos</button>
        <h3 className="font-display text-lg font-semibold">{idActual ? "Editar artículo" : "Nuevo artículo"}</h3>
        {f.generadoConIa && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${f.revisado ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>Generado con IA · {f.revisado ? "revisado" : "sin revisar"}</span>}
        {idActual && f.estado === "publicado" && portal.estado === "publicado" && <a href={url} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Ver en el sitio <ExternalLink className="size-4" /></a>}
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`${tarjeta} space-y-4 p-5`}>
          <label className="block"><span className={etiquetaCampo}>Título</span><input className={`${campo} text-base font-semibold`} value={f.titulo} maxLength={160} onChange={(e) => set("titulo", e.target.value)} /></label>
          <label className="block"><span className={etiquetaCampo}>Resumen (aparece en el listado y en buscadores)</span><textarea className={`${campo} resize-none`} rows={2} value={f.resumen} maxLength={400} onChange={(e) => set("resumen", e.target.value)} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={etiquetaCampo}>Categoría</span>
              <select className={campo} value={f.categoria} onChange={(e) => set("categoria", e.target.value)}><option value="">Sin categoría</option>{tematica.categorias.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="block"><span className={etiquetaCampo}>Tipo de artículo</span>
              <select className={campo} value={f.tipo} onChange={(e) => set("tipo", e.target.value)}><option value="">Libre</option>{tematica.tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
          </div>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className={`${etiquetaCampo} mb-0`}>Texto (markdown)</span>
              <div className="ml-auto flex gap-1">
                <button type="button" onClick={() => insertar("## ", "", "Subtítulo")} aria-label="Subtítulo" title="Subtítulo" className="grid size-8 place-items-center rounded-lg ring-1 ring-border hover:bg-surface-muted"><Heading2 className="size-4" /></button>
                <button type="button" onClick={() => insertar("**", "**", "texto")} aria-label="Negrita" title="Negrita" className="grid size-8 place-items-center rounded-lg ring-1 ring-border hover:bg-surface-muted"><Bold className="size-4" /></button>
                <button type="button" onClick={() => insertar("- ", "", "elemento de la lista")} aria-label="Lista" title="Lista" className="grid size-8 place-items-center rounded-lg ring-1 ring-border hover:bg-surface-muted"><List className="size-4" /></button>
                <button type="button" onClick={() => insertar("[", "](https://)", "texto del enlace")} aria-label="Enlace" title="Enlace" className="grid size-8 place-items-center rounded-lg ring-1 ring-border hover:bg-surface-muted"><Link2 className="size-4" /></button>
              </div>
            </div>
            <textarea ref={area} className={`${campo} min-h-[26rem] resize-y font-mono text-[13px] leading-relaxed`} value={f.cuerpo} maxLength={60000} onChange={(e) => set("cuerpo", e.target.value)} placeholder={"Escribe aquí.\n\n## Un subtítulo\n\nUn párrafo con **negrita** y una lista:\n\n- uno\n- dos"} />
            <p className="mt-1 text-xs text-muted-foreground">{numero(f.cuerpo.trim().split(/\s+/).filter(Boolean).length)} palabras · {minutosDeLectura(f.cuerpo)} min de lectura</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={etiquetaCampo}>Etiquetas (separadas por coma)</span><input className={campo} value={f.etiquetasTexto} placeholder="prevención, laboratorio" onChange={(e) => set("etiquetasTexto", e.target.value)} /></label>
            <label className="block"><span className={etiquetaCampo}>Autor (opcional)</span><input className={campo} value={f.autor} maxLength={80} onChange={(e) => set("autor", e.target.value)} /></label>
          </div>
          <label className="block"><span className={etiquetaCampo}>Descripción para buscadores (opcional, máx. 160)</span><input className={campo} value={f.seoDescripcion} maxLength={160} onChange={(e) => set("seoDescripcion", e.target.value)} /></label>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4" checked={f.destacado} onChange={(e) => set("destacado", e.target.checked)} /> Destacado (sale primero)</label>
            {f.generadoConIa && <label className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200"><input type="checkbox" className="size-4" checked={f.revisado} onChange={(e) => set("revisado", e.target.checked)} /> Lo revisé: leí el texto completo y está bien</label>}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => guardar("publicado")} disabled={ocupado} className={botonPrimario}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {f.estado === "publicado" ? "Guardar y mantener publicado" : "Publicar"}</button>
            <button type="button" onClick={() => guardar(f.estado === "publicado" ? "borrador" : f.estado)} disabled={ocupado} className={botonSecundario}>{f.estado === "publicado" ? "Pasar a borrador" : "Guardar borrador"}</button>
            {idActual && f.estado !== "archivado" && <button type="button" onClick={() => guardar("archivado")} disabled={ocupado} className={botonSecundario}>Archivar</button>}
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Estado: <b className="text-foreground">{ETIQUETA_ESTADO[f.estado].texto}</b></label>
          </div>
          {problema && f.estado === "publicado" && <p className="text-xs text-amber-700 dark:text-amber-300">Para publicarlo: {problema}</p>}
          {mensaje && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${mensaje.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"}`}>{mensaje.texto}</p>}
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Vista previa · como se verá en {portal.nombre}</p>
          <div style={vars} className="@container pointer-events-none max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-2xl border border-border bg-[var(--fondo)] p-6 text-[var(--texto)] @xl:p-10">
            {f.categoria && <span className={`inline-flex rounded-full px-3.5 py-1.5 text-[0.68rem] font-bold tracking-[0.16em] uppercase ${a.k.etiqueta}`}>{f.categoria}</span>}
            <h1 className={`mt-4 text-[2.1rem] leading-[1.1] text-balance ${a.tit}`}>{f.titulo || "Título del artículo"}</h1>
            {f.resumen && <p className={`mt-4 text-lg leading-relaxed ${a.k.suave}`}>{f.resumen}</p>}
            <Portada a={a} semilla={f.slug || f.titulo || "nuevo"} className="mt-6 aspect-[16/8] rounded-[1.5rem]" />
            <div className="mt-4"><Prosa a={a} bloques={bloques} /></div>
            {f.generadoConIa && <p className={`mt-4 text-xs ${a.k.suave}`}>Este artículo se redactó con apoyo de inteligencia artificial y fue revisado por el equipo editorial antes de publicarse.</p>}
            <p className={`mt-6 text-xs ${a.k.suave}`}>Al final del artículo irá el llamado: «{ajustes.union.titulo}».</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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

// --------------------------------------------------------------- panel ---

export function ArticulosPanel({ portal, ajustes, cambio, abrirIa }: { portal: Portal; ajustes: AjustesPortal; cambio: () => void; abrirIa?: boolean }) {
  const tematica = tematicaDe(portal.plantilla);
  const [lista, setLista] = React.useState<ArticuloLista[] | null>(null);
  const [error, setError] = React.useState("");
  const [filtro, setFiltro] = React.useState<"todos" | EstadoArticulo>("todos");
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

  async function editar(id: string) {
    setOcupado(true);
    try {
      const { articulo } = await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos/${id}`, "GET");
      setEditor({ id, forma: aForma(articulo) });
    } catch (e) {
      setError(mensajeDe(e, "No se pudo abrir el artículo."));
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar(a: ArticuloLista) {
    if (!window.confirm(`¿Eliminar «${a.titulo}»? No se puede deshacer.`)) return;
    setOcupado(true);
    try {
      await pedir(`/api/admin/portales/${portal.id}/articulos/${a.id}`, "DELETE");
      await cargar();
      cambio();
    } catch (e) {
      setError(mensajeDe(e, "No se pudo eliminar el artículo."));
    } finally {
      setOcupado(false);
    }
  }

  if (editor) {
    return <Editor portal={portal} ajustes={ajustes} id={editor.id} inicial={editor.forma} aviso={editor.aviso} volver={() => { setEditor(null); void cargar(); cambio(); }} guardado={() => { void cargar(); cambio(); }} />;
  }

  const todos = lista ?? [];
  const cuenta = (e: EstadoArticulo) => todos.filter((a) => a.estado === e).length;
  const visibles = filtro === "todos" ? todos : todos.filter((a) => a.estado === filtro);
  const chips: { id: "todos" | EstadoArticulo; texto: string; n: number }[] = [
    { id: "todos", texto: "Todos", n: todos.length },
    { id: "publicado", texto: "Publicados", n: cuenta("publicado") },
    { id: "borrador", texto: "Borradores", n: cuenta("borrador") },
    { id: "archivado", texto: "Archivados", n: cuenta("archivado") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">{tematica.seccion.nombre}</h3>
          <p className="text-sm text-muted-foreground">{tematica.seccion.descripcion}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setIa(true)} className={botonPrimario}><Sparkles className="size-4" /> Generar con IA</button>
          <button type="button" onClick={() => setEditor({ id: null, forma: formaVacia(tematica.tipos[0]?.id ?? "") })} className={botonSecundario}><Plus className="size-4" /> Escribir uno</button>
        </div>
      </div>

      <div role="tablist" aria-label="Estado" className="inline-flex flex-wrap gap-1 rounded-full bg-surface p-1 text-sm shadow-sm ring-1 ring-border">
        {chips.map((c) => <button key={c.id} type="button" role="tab" aria-selected={filtro === c.id} onClick={() => setFiltro(c.id)} className={`rounded-full px-4 py-1.5 font-semibold transition ${filtro === c.id ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>{c.texto} <span className={`ml-1 rounded-full px-1.5 text-[11px] ${filtro === c.id ? "bg-white/20" : "bg-surface-muted"}`}>{c.n}</span></button>)}
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
      {!lista && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Leyendo artículos…</p>}

      {lista && visibles.length === 0 && !error && (
        <div className={`${tarjeta} grid place-items-center gap-3 p-14 text-center`}>
          <Sparkles className="size-8 text-muted-foreground" />
          <p className="font-semibold">{todos.length === 0 ? "Todavía no hay artículos" : "No hay artículos en este estado"}</p>
          <p className="max-w-md text-sm text-muted-foreground">{todos.length === 0 ? "Pídele a la IA un primer borrador sobre un tema de este portal, o escribe uno tú. Con tres o cuatro artículos publicados el portal empieza a verse vivo." : "Cambia el filtro para ver los demás."}</p>
        </div>
      )}

      {visibles.length > 0 && (
        <ul className={`${tarjeta} divide-y divide-border overflow-hidden`}>
          {visibles.map((a) => {
            const e = ETIQUETA_ESTADO[a.estado];
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-0 flex-1 basis-72">
                  <button type="button" onClick={() => editar(a.id)} disabled={ocupado} className="block max-w-full truncate text-left font-semibold hover:text-brand">{a.titulo}</button>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{[a.categoria || "Sin categoría", tematica.tipos.find((t) => t.id === a.tipo)?.nombre, a.autor].filter(Boolean).join(" · ")} · actualizado {hace(a.actualizadoEn)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.generadoConIa && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${a.revisado ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>IA · {a.revisado ? "revisado" : "sin revisar"}</span>}
                  {a.destacado && <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand">Destacado</span>}
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${e.clase}`}>{e.texto}</span>
                </div>
                <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">{numero(a.vistas)} lecturas</span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => editar(a.id)} disabled={ocupado} aria-label={`Editar ${a.titulo}`} className="grid size-8 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted disabled:opacity-50"><Pencil className="size-3.5" /></button>
                  {a.estado === "publicado" && portal.estado === "publicado" && <a href={`/p/${portal.slug}/articulos/${a.slug}`} target="_blank" rel="noreferrer noopener" aria-label={`Ver ${a.titulo} en el sitio`} className="grid size-8 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted"><ExternalLink className="size-3.5" /></a>}
                  <button type="button" onClick={() => eliminar(a)} disabled={ocupado} aria-label={`Eliminar ${a.titulo}`} className="grid size-8 place-items-center rounded-full text-rose-600 ring-1 ring-rose-500/30 hover:bg-rose-500/10 disabled:opacity-50"><Trash2 className="size-3.5" /></button>
                </div>
              </li>
            );
          })}
        </ul>
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
