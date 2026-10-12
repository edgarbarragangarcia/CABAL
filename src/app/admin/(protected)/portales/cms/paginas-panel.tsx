"use client";

import * as React from "react";
import { ArrowLeft, Check, ExternalLink, FileText, ImagePlus, Loader2, Menu, Plus, Trash2 } from "lucide-react";

import { Portada, Prosa } from "@/components/portales/cms";
import { construirAmbiente } from "@/components/portales/marco";
import type { Medio } from "@/lib/portales/cms/medios-puro";
import type { Pagina } from "@/lib/portales/cms/paginas-tipos";
import { parsearMarkdown } from "@/lib/portales/cms/puro";
import type { Portal } from "@/lib/portales/store";
import { botonPrimario, botonSecundario, campo, etiquetaCampo, hace, mensajeDe, pedir, tarjeta } from "./comun";
import { EditorMarkdown, type ApiEditor } from "./editor-markdown";
import { SelectorMedios, subirImagen } from "./medios-panel";

/**
 * Páginas fijas del portal (Quiénes somos, Cómo participar, Contacto…). Se escriben como un artículo, se publican con su propio
 * enlace /p/<portal>/pagina/<enlace> y pueden salir en el menú y en el pie del portal.
 */

type Forma = { titulo: string; resumen: string; cuerpo: string; estado: "borrador" | "publicado"; enMenu: boolean; orden: number; portadaUrl: string; slug: string };
const vacia: Forma = { titulo: "", resumen: "", cuerpo: "", estado: "borrador", enMenu: false, orden: 0, portadaUrl: "", slug: "" };
const aForma = (p: Pagina): Forma => ({ titulo: p.titulo, resumen: p.resumen, cuerpo: p.cuerpo, estado: p.estado, enMenu: p.enMenu, orden: p.orden, portadaUrl: p.portadaUrl, slug: p.slug });

/** Páginas que conviene tener en una comunidad: un clic las crea con un esqueleto para completar. */
const SUGERIDAS: { titulo: string; resumen: string; cuerpo: string }[] = [
  { titulo: "Quiénes somos", resumen: "Quién está detrás de esta comunidad y para qué existe.", cuerpo: "## Quiénes somos\n\nCuenta aquí, en pocas líneas, quién impulsa esta comunidad, desde cuándo y con qué propósito.\n\n## Qué hacemos\n\n- Informamos con noticias y guías claras.\n- Convocamos encuentros y jornadas.\n- Acompañamos a quienes se suman.\n\n## Cómo sumarte\n\nDéjanos tus datos en el formulario del inicio y te avisamos de lo próximo." },
  { titulo: "Cómo participar", resumen: "Las formas de sumarse y colaborar con la comunidad.", cuerpo: "## Cómo participar\n\n1. **Infórmate**: lee las noticias y guías.\n2. **Súmate**: déjanos tus datos para recibir novedades.\n3. **Asiste**: inscríbete a los próximos encuentros.\n\n## ¿Quieres colaborar más?\n\nEscríbenos contándonos qué sabes hacer y cómo quieres ayudar." },
  { titulo: "Preguntas frecuentes", resumen: "Respuestas a lo que más se pregunta.", cuerpo: "## ¿Cuesta algo sumarse?\n\nNo. Sumarte y asistir a los encuentros es gratis.\n\n## ¿Qué hacen con mis datos?\n\nLos usamos solo para enviarte lo que elegiste. Puedes pedir que los actualicemos o los borremos cuando quieras.\n\n## ¿Cómo me doy de baja?\n\nCada boletín trae un enlace para darte de baja con un clic." },
];

export function PaginasPanel({ portal, avisar }: { portal: Portal; avisar: (t: string, ok?: boolean) => void }) {
  const [lista, setLista] = React.useState<Pagina[] | null>(null);
  const [error, setError] = React.useState("");
  const [editor, setEditor] = React.useState<{ id: string | null; forma: Forma } | null>(null);
  const [recarga, setRecarga] = React.useState(0);

  React.useEffect(() => {
    let cancelado = false;
    pedir<{ paginas: Pagina[] }>(`/api/admin/portales/${portal.id}/paginas`, "GET")
      .then((r) => {
        if (!cancelado) setLista(r.paginas);
      })
      .catch((e) => {
        if (!cancelado) {
          setError(mensajeDe(e, "No se pudieron leer las páginas. ¿Ya ejecutaste supabase/portales-cms-pro.sql?"));
          setLista([]);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [portal.id, recarga]);

  if (editor) return <EditorPagina portal={portal} id={editor.id} inicial={editor.forma} avisar={avisar} volver={() => { setEditor(null); setRecarga((n) => n + 1); }} />;

  const existentes = new Set((lista ?? []).map((p) => p.titulo.toLowerCase()));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold">Páginas</h3>
          <p className="text-sm text-muted-foreground">Contenido fijo del portal: quiénes somos, cómo participar, preguntas frecuentes… Las que marques «en el menú» salen arriba y en el pie.</p>
        </div>
        <button type="button" onClick={() => setEditor({ id: null, forma: vacia })} className={botonPrimario}><Plus className="size-4" /> Nueva página</button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
      {!lista && !error && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>}
      {lista && lista.length > 0 && (
        <ul className={`${tarjeta} divide-y divide-border overflow-hidden`}>
          {lista.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 basis-56">
                <button type="button" onClick={() => setEditor({ id: p.id, forma: aForma(p) })} className="block max-w-full truncate text-left font-semibold hover:text-brand">{p.titulo}</button>
                <p className="truncate text-xs text-muted-foreground">/pagina/{p.slug} · actualizada {hace(p.actualizadoEn)}</p>
              </div>
              {p.enMenu && <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand"><Menu className="size-3" /> En el menú</span>}
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.estado === "publicado" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-surface-muted text-muted-foreground"}`}>{p.estado === "publicado" ? "Publicada" : "Borrador"}</span>
              {p.estado === "publicado" && portal.estado === "publicado" && <a href={`/p/${portal.slug}/pagina/${p.slug}`} target="_blank" rel="noreferrer noopener" aria-label={`Ver ${p.titulo}`} className="grid size-8 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted"><ExternalLink className="size-3.5" /></a>}
            </li>
          ))}
        </ul>
      )}
      {lista && !error && (
        <section className={`${tarjeta} p-5`}>
          <h4 className="text-sm font-semibold">{lista.length === 0 ? "Empieza con estas" : "Otras páginas que suelen servir"}</h4>
          <p className="text-xs text-muted-foreground">Se crean con un texto de ejemplo que completas tú. Nada se publica solo.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGERIDAS.filter((s) => !existentes.has(s.titulo.toLowerCase())).map((s) => (
              <button key={s.titulo} type="button" onClick={() => setEditor({ id: null, forma: { ...vacia, ...s, enMenu: true } })} className={botonSecundario}><Plus className="size-4" /> {s.titulo}</button>
            ))}
            {SUGERIDAS.every((s) => existentes.has(s.titulo.toLowerCase())) && <span className="text-xs text-muted-foreground">Ya tienes las páginas sugeridas.</span>}
          </div>
        </section>
      )}
    </div>
  );
}

function EditorPagina({ portal, id, inicial, avisar, volver }: { portal: Portal; id: string | null; inicial: Forma; avisar: (t: string, ok?: boolean) => void; volver: () => void }) {
  const [f, setF] = React.useState<Forma>(inicial);
  const [idActual, setIdActual] = React.useState(id);
  const [ocupado, setOcupado] = React.useState(false);
  const [medios, setMedios] = React.useState<null | "portada" | "texto">(null);
  const [vista, setVista] = React.useState(false);
  const apiEditor = React.useRef<ApiEditor | null>(null);
  const set = <K extends keyof Forma>(k: K, v: Forma[K]) => setF((x) => ({ ...x, [k]: v }));
  const bloques = React.useMemo(() => parsearMarkdown(f.cuerpo), [f.cuerpo]);
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: false, idBase: "previa", cms: null });

  async function guardar(estado = f.estado) {
    setOcupado(true);
    try {
      const cuerpo = { ...f, estado, slug: f.slug || undefined };
      const r = idActual
        ? await pedir<{ pagina: Pagina }>(`/api/admin/portales/${portal.id}/paginas/${idActual}`, "PUT", cuerpo)
        : await pedir<{ pagina: Pagina }>(`/api/admin/portales/${portal.id}/paginas`, "POST", cuerpo);
      setIdActual(r.pagina.id);
      setF(aForma(r.pagina));
      avisar(r.pagina.estado === "publicado" ? "Página publicada." : "Página guardada.");
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo guardar la página."), false);
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar() {
    if (!idActual || !window.confirm("¿Eliminar esta página? No se puede deshacer.")) return;
    try {
      await pedir(`/api/admin/portales/${portal.id}/paginas/${idActual}`, "DELETE");
      avisar("Página eliminada.");
      volver();
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo eliminar."), false);
    }
  }

  function elegir(m: Medio) {
    if (medios === "portada") set("portadaUrl", m.url);
    else apiEditor.current?.insertar(`![${m.alt || m.nombre.replace(/\.[^.]+$/, "")}](${m.url})`);
    setMedios(null);
  }

  return (
    <div className="space-y-4">
      <div className={`${tarjeta} sticky top-2 z-30 flex flex-wrap items-center gap-3 px-4 py-3`}>
        <button type="button" onClick={volver} className={botonSecundario}><ArrowLeft className="size-4" /> Páginas</button>
        <h3 className="font-display text-base font-semibold">{idActual ? "Editar página" : "Nueva página"}</h3>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${f.estado === "publicado" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-surface-muted text-muted-foreground"}`}>{f.estado === "publicado" ? "Publicada" : "Borrador"}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setVista((v) => !v)} className={botonSecundario}>{vista ? "Seguir escribiendo" : "Vista previa"}</button>
          <button type="button" onClick={() => void guardar()} disabled={ocupado} className={botonSecundario}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar</button>
          {f.estado !== "publicado" && <button type="button" onClick={() => void guardar("publicado")} disabled={ocupado} className={botonPrimario}>Publicar</button>}
          {f.estado === "publicado" && <button type="button" onClick={() => void guardar("borrador")} disabled={ocupado} className={botonSecundario}>Pasar a borrador</button>}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {!vista ? (
            <div className={`${tarjeta} space-y-4 p-5`}>
              <input className="w-full border-0 border-b border-border bg-transparent pb-2 font-display text-[1.7rem] font-semibold outline-none placeholder:text-muted-foreground/50 focus:border-brand" value={f.titulo} maxLength={120} placeholder="Título de la página" aria-label="Título" onChange={(e) => set("titulo", e.target.value)} />
              <label className="block"><span className={etiquetaCampo}>Resumen (opcional)</span><textarea className={`${campo} resize-none`} rows={2} value={f.resumen} maxLength={300} onChange={(e) => set("resumen", e.target.value)} /></label>
              <EditorMarkdown valor={f.cuerpo} alCambiar={(v) => set("cuerpo", v)} apiRef={apiEditor} alPedirImagen={() => setMedios("texto")} alSoltarImagenes={(archivos) => { void (async () => { for (const a of archivos) { try { const m = await subirImagen(portal.id, a); apiEditor.current?.insertar(`![${m.alt || m.nombre.replace(/\.[^.]+$/, "")}](${m.url})`); } catch (e) { avisar(mensajeDe(e, "No se pudo subir la imagen."), false); } } })(); }} />
            </div>
          ) : (
            <div style={vars} className="@container pointer-events-none max-h-[calc(100dvh-12rem)] overflow-y-auto rounded-2xl border border-border bg-[var(--fondo)] p-6 text-[var(--texto)] @xl:p-10">
              <h1 className={`text-[2.1rem] leading-[1.1] text-balance ${a.tit}`}>{f.titulo || "Título de la página"}</h1>
              {f.resumen && <p className={`mt-4 text-lg leading-relaxed ${a.k.suave}`}>{f.resumen}</p>}
              {f.portadaUrl && <Portada a={a} semilla={f.slug || f.titulo} url={f.portadaUrl} className="mt-6 aspect-[16/8] rounded-[1.5rem]" />}
              <div className="mt-4"><Prosa a={a} bloques={bloques} /></div>
            </div>
          )}
        </div>
        <aside className="min-w-0 space-y-3">
          <div className={`${tarjeta} space-y-3 p-4`}>
            <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" className="mt-0.5 size-4" checked={f.enMenu} onChange={(e) => set("enMenu", e.target.checked)} /> <span>Mostrar en el menú y en el pie del portal</span></label>
            {f.enMenu && <label className="block"><span className={etiquetaCampo}>Orden en el menú (0 = primero)</span><input type="number" min={0} max={99} className={campo} value={f.orden} onChange={(e) => set("orden", Math.min(99, Math.max(0, Number(e.target.value) || 0)))} /></label>}
            <label className="block"><span className={etiquetaCampo}>Enlace</span>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground focus-within:border-brand"><span className="shrink-0">/pagina/</span><input className="min-w-0 flex-1 bg-transparent text-foreground outline-none" value={f.slug} placeholder="se-genera-solo" onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60))} /></div>
            </label>
          </div>
          <div className={`${tarjeta} space-y-3 p-4`}>
            <p className="flex items-center gap-2 text-sm font-semibold"><ImagePlus className="size-4 text-brand" /> Portada (opcional)</p>
            {f.portadaUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- portada desde Storage */}
                <img src={f.portadaUrl} alt="" className="aspect-[16/9] w-full rounded-xl border border-border object-cover" />
                <div className="flex gap-2"><button type="button" onClick={() => setMedios("portada")} className={botonSecundario}>Cambiar</button><button type="button" onClick={() => set("portadaUrl", "")} className={botonSecundario}>Quitar</button></div>
              </>
            ) : (
              <button type="button" onClick={() => setMedios("portada")} className="grid w-full place-items-center gap-1 rounded-xl border-2 border-dashed border-border py-6 text-sm font-semibold text-muted-foreground hover:border-brand hover:text-brand"><ImagePlus className="size-5" /> Elegir imagen</button>
            )}
          </div>
          {idActual && <button type="button" onClick={() => void eliminar()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300"><Trash2 className="size-3.5" /> Eliminar esta página</button>}
        </aside>
      </div>
      {medios && <SelectorMedios portalId={portal.id} titulo={medios === "portada" ? "Elegir la portada" : "Insertar una imagen"} alElegir={elegir} cerrar={() => setMedios(null)} />}
    </div>
  );
}
