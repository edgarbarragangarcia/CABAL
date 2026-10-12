"use client";

import * as React from "react";
import {
  AlertTriangle, ArrowLeft, Calendar, Check, CheckCircle2, ChevronDown, CloudCheck, ExternalLink, Eye, FileText, History, ImagePlus, Loader2,
  Monitor, PenLine, RotateCcw, Search, Smartphone, Tag, X,
} from "lucide-react";

import { Portada, Prosa } from "@/components/portales/cms";
import { construirAmbiente } from "@/components/portales/marco";
import { diferencias, resumenDiff } from "@/lib/portales/cms/diff";
import { bloqueaPublicar, revisarArticulo } from "@/lib/portales/cms/calidad";
import type { Medio } from "@/lib/portales/cms/medios-puro";
import { minutosDeLectura, parsearMarkdown } from "@/lib/portales/cms/puro";
import { tematicaDe } from "@/lib/portales/cms/tematicas";
import type { AjustesPortal, Articulo, EstadoArticulo } from "@/lib/portales/cms/tipos";
import type { VersionArticulo } from "@/lib/portales/cms/versiones";
import type { Portal } from "@/lib/portales/store";
import { ESTADOS, aForma, cuerpoApi, estadoInfo, type Forma } from "./articulo-forma";
import { aCampoFecha, botonPrimario, botonSecundario, campo, cuandoLargo, etiquetaCampo, hace, mensajeDe, pedir, tarjeta } from "./comun";
import { EditorMarkdown, type ApiEditor } from "./editor-markdown";
import { SelectorMedios, subirImagen } from "./medios-panel";

/**
 * El editor de un artículo: escribe con barra de formato y atajos, se guarda solo mientras es borrador, se programa o pasa a
 * revisión, avisa qué le falta antes de publicar, muestra cómo se ve en buscadores y en redes, y guarda su historial.
 */

type Props = {
  portal: Portal;
  ajustes: AjustesPortal;
  /** Las funciones avanzadas (portada, programación, revisión, historial, medios) están activas. */
  pro: boolean;
  id: string | null;
  inicial: Forma;
  aviso?: string;
  volver: () => void;
  guardado: (a: Articulo) => void;
  avisar: (texto: string, ok?: boolean) => void;
};

/** «Mañana a las 8:00 a. m.» en Colombia (UTC-5): se arma sobre el reloj de Colombia y se devuelve al instante real. */
function mananaALas8(): Date {
  const d = new Date(Date.now() - 5 * 3_600_000);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(8, 0, 0, 0);
  return new Date(d.getTime() + 5 * 3_600_000);
}
const enDias = (n: number) => new Date(Date.now() + n * 86_400_000);

function Seccion({ titulo, icono: Icono, abierta = false, resumen, children }: { titulo: string; icono: React.ComponentType<{ className?: string }>; abierta?: boolean; resumen?: React.ReactNode; children: React.ReactNode }) {
  return (
    <details open={abierta} className={`${tarjeta} group`}>
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <Icono className="size-4 text-brand" />
        <span className="text-sm font-semibold">{titulo}</span>
        {resumen && <span className="ml-1 min-w-0 flex-1 truncate text-xs text-muted-foreground">{resumen}</span>}
        <ChevronDown className="ml-auto size-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

function Etiquetas({ valor, alCambiar, sugeridas }: { valor: string[]; alCambiar: (v: string[]) => void; sugeridas: string[] }) {
  const [texto, setTexto] = React.useState("");
  const agregar = (t: string) => {
    const limpio = t.trim().replace(/^#/, "").slice(0, 30);
    if (limpio && !valor.some((v) => v.toLowerCase() === limpio.toLowerCase()) && valor.length < 8) alCambiar([...valor, limpio]);
    setTexto("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {valor.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
            #{t}
            <button type="button" onClick={() => alCambiar(valor.filter((x) => x !== t))} aria-label={`Quitar ${t}`} className="opacity-70 hover:opacity-100"><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <input
        className={`${campo} mt-2`}
        value={texto}
        placeholder={valor.length >= 8 ? "Máximo 8 etiquetas" : "Escribe y pulsa Enter"}
        disabled={valor.length >= 8}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            agregar(texto);
          } else if (e.key === "Backspace" && !texto && valor.length) alCambiar(valor.slice(0, -1));
        }}
        onBlur={() => texto.trim() && agregar(texto)}
      />
      {sugeridas.length > 0 && <p className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-muted-foreground">Sugeridas: {sugeridas.filter((s) => !valor.includes(s)).slice(0, 5).map((s) => <button key={s} type="button" onClick={() => agregar(s)} className="underline decoration-dotted hover:text-foreground">{s}</button>)}</p>}
    </div>
  );
}

export function EditorArticulo({ portal, ajustes, pro, id, inicial, aviso, volver, guardado, avisar }: Props) {
  const tematica = tematicaDe(portal.plantilla);
  const [f, setF] = React.useState<Forma>(inicial);
  const [idActual, setIdActual] = React.useState(id);
  const [ocupado, setOcupado] = React.useState(false);
  const [guardadoEn, setGuardadoEn] = React.useState<number | null>(null);
  const [errorGuardar, setErrorGuardar] = React.useState("");
  const [modo, setModo] = React.useState<"editar" | "vista">("editar");
  const [dispositivo, setDispositivo] = React.useState<"escritorio" | "celular">("escritorio");
  const [medios, setMedios] = React.useState<null | "portada" | "texto">(null);
  const [subiendo, setSubiendo] = React.useState(0);
  const [versiones, setVersiones] = React.useState<VersionArticulo[] | null>(null);
  const [comparar, setComparar] = React.useState<VersionArticulo | null>(null);
  const apiEditor = React.useRef<ApiEditor | null>(null);
  const [base, setBase] = React.useState(() => JSON.stringify(cuerpoApi(inicial)));
  const creando = React.useRef(false);

  const set = <K extends keyof Forma>(k: K, v: Forma[K]) => setF((x) => ({ ...x, [k]: v }));
  const sucio = JSON.stringify(cuerpoApi(f)) !== base;
  const hallazgos = React.useMemo(() => revisarArticulo({ titulo: f.titulo, resumen: f.resumen, cuerpo: f.cuerpo, categoria: f.categoria, etiquetas: f.etiquetas, portadaUrl: f.portadaUrl, portadaAlt: f.portadaAlt, seoDescripcion: f.seoDescripcion, generadoConIa: f.generadoConIa, revisado: f.revisado }), [f]);
  const errores = hallazgos.filter((h) => h.nivel === "error");
  const avisos = hallazgos.filter((h) => h.nivel === "aviso");
  const puedePublicar = !bloqueaPublicar(hallazgos);
  const bloques = React.useMemo(() => parsearMarkdown(f.cuerpo), [f.cuerpo]);
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: false, idBase: "previa", cms: null });

  async function guardar(o: { estado?: EstadoArticulo; silencioso?: boolean } = {}) {
    if (creando.current) return;
    creando.current = true;
    setOcupado(true);
    setErrorGuardar("");
    try {
      const datos = { ...f, estado: o.estado ?? f.estado };
      const cuerpo = cuerpoApi(datos);
      const r = idActual
        ? await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos/${idActual}`, "PUT", cuerpo)
        : await pedir<{ articulo: Articulo }>(`/api/admin/portales/${portal.id}/articulos`, "POST", cuerpo);
      const nueva = aForma(r.articulo);
      setIdActual(r.articulo.id);
      // En el guardado automático solo se actualiza lo que el servidor decide (enlace); lo que la persona sigue escribiendo se conserva.
      if (o.silencioso) setF((x) => ({ ...x, slug: nueva.slug, estado: nueva.estado }));
      else setF(nueva);
      setBase(JSON.stringify(cuerpoApi(o.silencioso ? { ...datos, slug: nueva.slug } : nueva)));
      setGuardadoEn(Date.now());
      guardado(r.articulo);
      if (!o.silencioso) avisar(r.articulo.estado === "publicado" ? "Publicado: ya se ve en el portal." : r.articulo.estado === "programado" ? `Programado para ${cuandoLargo(r.articulo.publicarEn ?? "")}.` : r.articulo.estado === "revision" ? "Enviado a revisión." : "Guardado.");
    } catch (e) {
      const m = mensajeDe(e, "No se pudo guardar el artículo.");
      setErrorGuardar(m);
      if (!o.silencioso) avisar(m, false);
    } finally {
      creando.current = false;
      setOcupado(false);
    }
  }

  // Los efectos de abajo llaman siempre a la última versión de «guardar» sin reiniciarse en cada dibujo.
  const guardarRef = React.useRef(guardar);
  React.useEffect(() => {
    guardarRef.current = guardar;
  });

  // Guardado automático: solo borradores y artículos en revisión (nunca algo que ya está en línea o a punto de salir).
  React.useEffect(() => {
    if (!sucio || ocupado || f.estado === "publicado" || f.estado === "programado" || f.titulo.trim().length < 3) return;
    const t = setTimeout(() => void guardarRef.current({ silencioso: true }), 2500);
    return () => clearTimeout(t);
  }, [sucio, ocupado, f]);

  // Ctrl/Cmd+S guarda; salir con cambios pregunta.
  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void guardarRef.current();
      }
    };
    const salir = (e: BeforeUnloadEvent) => {
      if (sucio) e.preventDefault();
    };
    window.addEventListener("keydown", tecla);
    window.addEventListener("beforeunload", salir);
    return () => {
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("beforeunload", salir);
    };
  }, [sucio]);

  React.useEffect(() => {
    if (aviso) avisar(aviso);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el aviso inicial se muestra una sola vez
  }, []);

  async function subirYInsertar(archivos: File[]) {
    setSubiendo((n) => n + archivos.length);
    for (const archivo of archivos) {
      try {
        const m = await subirImagen(portal.id, archivo);
        apiEditor.current?.insertar(`![${m.alt || m.nombre.replace(/\.[^.]+$/, "")}](${m.url})`);
      } catch (e) {
        avisar(mensajeDe(e, `No se pudo subir «${archivo.name}».`), false);
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
  }

  function elegirMedio(m: Medio) {
    if (medios === "portada") setF((x) => ({ ...x, portadaUrl: m.url, portadaAlt: x.portadaAlt || m.alt }));
    else apiEditor.current?.insertar(`![${m.alt || m.nombre.replace(/\.[^.]+$/, "")}](${m.url})`);
    setMedios(null);
  }

  async function cargarVersiones() {
    if (!idActual || versiones) return;
    try {
      setVersiones((await pedir<{ versiones: VersionArticulo[] }>(`/api/admin/portales/${portal.id}/articulos/${idActual}/versiones`, "GET")).versiones);
    } catch {
      setVersiones([]);
    }
  }

  function programarPara(cuando: Date) {
    setF((x) => ({ ...x, estado: "programado", publicarEn: aCampoFecha(cuando.toISOString()) }));
  }
  const url = `/p/${portal.slug}/articulos/${f.slug}`;
  const total = hallazgos.length;
  const puntaje = Math.round((hallazgos.filter((h) => h.nivel === "ok").length / Math.max(1, total)) * 100);
  const infoEstado = estadoInfo(f.estado);
  const textoGuardado = errorGuardar ? "No se pudo guardar" : ocupado ? "Guardando…" : sucio ? (f.estado === "publicado" || f.estado === "programado" ? "Cambios sin guardar" : "Guardando en un momento…") : guardadoEn ? `Guardado ${hace(new Date(guardadoEn).toISOString())}` : idActual ? "Todo guardado" : "Sin guardar";

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className={`${tarjeta} sticky top-2 z-30 flex flex-wrap items-center gap-3 px-4 py-3`}>
        <button type="button" onClick={() => { if (!sucio || window.confirm("Tienes cambios sin guardar. ¿Salir de todos modos?")) volver(); }} className={botonSecundario}><ArrowLeft className="size-4" /> Artículos</button>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${infoEstado.clase}`}>{infoEstado.texto}{f.estado === "programado" && f.publicarEn ? ` · ${cuandoLargo(new Date(`${f.publicarEn}:00-05:00`).toISOString())}` : ""}</span>
        {f.generadoConIa && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${f.revisado ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}>IA · {f.revisado ? "revisado" : "sin revisar"}</span>}
        <span className={`inline-flex items-center gap-1.5 text-xs ${errorGuardar ? "text-rose-600" : "text-muted-foreground"}`} aria-live="polite">
          {ocupado ? <Loader2 className="size-3.5 animate-spin" /> : errorGuardar ? <AlertTriangle className="size-3.5" /> : <CloudCheck className="size-3.5" />}
          {textoGuardado}
          {subiendo > 0 && <span> · subiendo {subiendo} imagen{subiendo === 1 ? "" : "es"}…</span>}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-surface-muted p-1 text-xs font-semibold" role="tablist" aria-label="Modo">
            <button type="button" role="tab" aria-selected={modo === "editar"} onClick={() => setModo("editar")} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${modo === "editar" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}><PenLine className="size-3.5" /> Escribir</button>
            <button type="button" role="tab" aria-selected={modo === "vista"} onClick={() => setModo("vista")} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${modo === "vista" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}><Eye className="size-3.5" /> Vista previa</button>
          </div>
          {idActual && f.estado === "publicado" && portal.estado === "publicado" && <a href={url} target="_blank" rel="noreferrer noopener" className={botonSecundario}>Ver <ExternalLink className="size-4" /></a>}
          <button type="button" onClick={() => void guardar()} disabled={ocupado || (!sucio && !!idActual)} title="Guardar (Ctrl+S)" className={botonSecundario}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar</button>
          {f.estado !== "publicado" && <button type="button" onClick={() => void guardar({ estado: "publicado" })} disabled={ocupado || !puedePublicar} title={puedePublicar ? "Publicar ahora" : "Resuelve los pendientes de «Antes de publicar»"} className={botonPrimario}>Publicar ahora</button>}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        {/* Columna principal */}
        <div className="min-w-0 space-y-4">
          {modo === "editar" ? (
            <div className={`${tarjeta} space-y-4 p-5`}>
              <label className="block">
                <span className="sr-only">Título</span>
                <input className="w-full border-0 border-b border-border bg-transparent pb-2 font-display text-[1.7rem] leading-tight font-semibold outline-none placeholder:text-muted-foreground/50 focus:border-brand" value={f.titulo} maxLength={160} placeholder="Título del artículo" onChange={(e) => set("titulo", e.target.value)} />
                <span className={`mt-1 block text-right text-[11px] tabular-nums ${f.titulo.length > 70 ? "text-amber-600" : "text-muted-foreground"}`}>{f.titulo.length} / 70 recomendados</span>
              </label>
              <label className="block">
                <span className={etiquetaCampo}>Resumen (sale en el listado y en buscadores)</span>
                <textarea className={`${campo} resize-none`} rows={2} value={f.resumen} maxLength={400} onChange={(e) => set("resumen", e.target.value)} placeholder="Una o dos frases que inviten a leer." />
              </label>
              <EditorMarkdown
                valor={f.cuerpo}
                alCambiar={(v) => set("cuerpo", v)}
                apiRef={apiEditor}
                alPedirImagen={pro ? () => setMedios("texto") : undefined}
                alSoltarImagenes={pro ? (a) => void subirYInsertar(a) : undefined}
              />
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Así se verá en {portal.nombre}</p>
                <div className="ml-auto inline-flex rounded-full bg-surface-muted p-1 text-xs font-semibold">
                  <button type="button" onClick={() => setDispositivo("escritorio")} aria-pressed={dispositivo === "escritorio"} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${dispositivo === "escritorio" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}><Monitor className="size-3.5" /> Escritorio</button>
                  <button type="button" onClick={() => setDispositivo("celular")} aria-pressed={dispositivo === "celular"} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${dispositivo === "celular" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}><Smartphone className="size-3.5" /> Celular</button>
                </div>
              </div>
              <div style={vars} className={`@container pointer-events-none mx-auto overflow-y-auto rounded-2xl border border-border bg-[var(--fondo)] p-6 text-[var(--texto)] @xl:p-10 ${dispositivo === "celular" ? "max-h-[48rem] max-w-[24rem]" : "max-h-[calc(100dvh-12rem)]"}`}>
                {f.categoria && <span className={`inline-flex rounded-full px-3.5 py-1.5 text-[0.68rem] font-bold tracking-[0.16em] uppercase ${a.k.etiqueta}`}>{f.categoria}</span>}
                <h1 className={`mt-4 text-[2.1rem] leading-[1.1] text-balance ${a.tit}`}>{f.titulo || "Título del artículo"}</h1>
                {f.resumen && <p className={`mt-4 text-lg leading-relaxed ${a.k.suave}`}>{f.resumen}</p>}
                <p className={`mt-4 text-sm ${a.k.suave}`}>{[f.autor, `${minutosDeLectura(f.cuerpo)} min de lectura`].filter(Boolean).join(" · ")}</p>
                <Portada a={a} semilla={f.slug || f.titulo || "nuevo"} url={f.portadaUrl} alt={f.portadaAlt} className="mt-6 aspect-[16/8] rounded-[1.5rem]" />
                <div className="mt-4"><Prosa a={a} bloques={bloques} /></div>
                {f.generadoConIa && <p className={`mt-4 text-xs ${a.k.suave}`}>Este artículo se redactó con apoyo de inteligencia artificial y fue revisado por el equipo editorial antes de publicarse.</p>}
                <p className={`mt-6 text-xs ${a.k.suave}`}>Al final del artículo irá el llamado: «{ajustes.union.titulo}».</p>
              </div>
            </div>
          )}
        </div>

        {/* Lateral */}
        <aside className="min-w-0 space-y-3">
          <Seccion titulo="Publicación" icono={FileText} abierta resumen={infoEstado.texto}>
            <div role="radiogroup" aria-label="Estado" className="grid grid-cols-2 gap-1.5">
              {ESTADOS.filter((e) => e.id !== "archivado" && (pro || (e.id !== "revision" && e.id !== "programado"))).map((e) => (
                <button key={e.id} type="button" role="radio" aria-checked={f.estado === e.id} onClick={() => { if (e.id === "programado" && !f.publicarEn) programarPara(mananaALas8()); else set("estado", e.id); }} className={`rounded-xl border px-3 py-2 text-left text-xs transition ${f.estado === e.id ? "border-brand bg-brand-soft" : "border-border hover:bg-surface-muted"}`}>
                  <span className="block font-bold">{e.texto}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{e.ayuda}</span>
                </button>
              ))}
            </div>
            {f.estado === "programado" && (
              <div className="space-y-2 rounded-xl bg-violet-500/10 p-3">
                <label className="block text-xs font-semibold"><span className="mb-1 flex items-center gap-1.5"><Calendar className="size-3.5" /> Se publica el (hora de Colombia)</span>
                  <input type="datetime-local" className={campo} value={f.publicarEn} onChange={(e) => set("publicarEn", e.target.value)} />
                </label>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <button type="button" onClick={() => programarPara(mananaALas8())} className="rounded-full bg-surface px-2.5 py-1 font-semibold ring-1 ring-border">Mañana 8:00 a. m.</button>
                  <button type="button" onClick={() => programarPara(enDias(3))} className="rounded-full bg-surface px-2.5 py-1 font-semibold ring-1 ring-border">En 3 días</button>
                </div>
              </div>
            )}
            {f.estado === "revision" && (
              <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Nota para quien revisa</span>
                <textarea className={`${campo} resize-none`} rows={3} value={f.notaRevision} maxLength={500} onChange={(e) => set("notaRevision", e.target.value)} placeholder="Qué conviene mirar: datos, tono, enlaces…" />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4" checked={f.destacado} onChange={(e) => set("destacado", e.target.checked)} /> Destacado (sale primero)</label>
            {f.generadoConIa && <label className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200"><input type="checkbox" className="mt-0.5 size-4" checked={f.revisado} onChange={(e) => set("revisado", e.target.checked)} /> Lo revisé: leí el texto completo, los datos están bien y lo firmo yo.</label>}
            {idActual && f.estado !== "archivado" && <button type="button" onClick={() => void guardar({ estado: "archivado" })} disabled={ocupado} className="text-xs font-semibold text-muted-foreground underline decoration-dotted hover:text-foreground">Archivar este artículo</button>}
          </Seccion>

          <Seccion titulo="Antes de publicar" icono={CheckCircle2} abierta={errores.length > 0 || avisos.length > 0} resumen={errores.length > 0 ? `${errores.length} pendiente${errores.length === 1 ? "" : "s"}` : avisos.length > 0 ? `${avisos.length} sugerencia${avisos.length === 1 ? "" : "s"}` : "Todo en orden"}>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className={`h-full rounded-full transition-all ${errores.length ? "bg-rose-500" : avisos.length ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${puntaje}%` }} /></div>
            <ul className="space-y-1.5">
              {hallazgos.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-snug">
                  {h.nivel === "ok" ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /> : <AlertTriangle className={`mt-0.5 size-3.5 shrink-0 ${h.nivel === "error" ? "text-rose-600" : "text-amber-600"}`} />}
                  <span className={h.nivel === "ok" ? "text-muted-foreground" : ""}>{h.texto}</span>
                </li>
              ))}
            </ul>
          </Seccion>

          {pro && (
            <Seccion titulo="Portada" icono={ImagePlus} abierta={!!f.portadaUrl} resumen={f.portadaUrl ? "Con imagen" : "Ilustración del tema"}>
              {f.portadaUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- portada desde Storage */}
                  <img src={f.portadaUrl} alt={f.portadaAlt || "Portada"} className="aspect-[16/9] w-full rounded-xl border border-border object-cover" />
                  <label className="block"><span className={etiquetaCampo}>Texto alternativo</span><input className={campo} value={f.portadaAlt} maxLength={160} onChange={(e) => set("portadaAlt", e.target.value)} placeholder="Describe lo que se ve" /></label>
                  <div className="flex gap-2"><button type="button" onClick={() => setMedios("portada")} className={botonSecundario}>Cambiar</button><button type="button" onClick={() => setF((x) => ({ ...x, portadaUrl: "", portadaAlt: "" }))} className={botonSecundario}>Quitar</button></div>
                </div>
              ) : (
                <button type="button" onClick={() => setMedios("portada")} className="grid w-full place-items-center gap-1 rounded-xl border-2 border-dashed border-border py-8 text-sm font-semibold text-muted-foreground transition hover:border-brand hover:text-brand"><ImagePlus className="size-6" /> Elegir o subir una imagen</button>
              )}
            </Seccion>
          )}

          <Seccion titulo="Organización" icono={Tag} resumen={[f.categoria, ...f.etiquetas.slice(0, 2).map((e) => `#${e}`)].filter(Boolean).join(" · ") || "Categoría, etiquetas, autor"}>
            <label className="block"><span className={etiquetaCampo}>Categoría</span>
              <select className={campo} value={f.categoria} onChange={(e) => set("categoria", e.target.value)}><option value="">Sin categoría</option>{tematica.categorias.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="block"><span className={etiquetaCampo}>Tipo de artículo</span>
              <select className={campo} value={f.tipo} onChange={(e) => set("tipo", e.target.value)}><option value="">Libre</option>{tematica.tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
            <div><span className={etiquetaCampo}>Etiquetas</span><Etiquetas valor={f.etiquetas} alCambiar={(v) => set("etiquetas", v)} sugeridas={tematica.categorias.map((c) => c.toLowerCase())} /></div>
            <label className="block"><span className={etiquetaCampo}>Autor (opcional)</span><input className={campo} value={f.autor} maxLength={80} onChange={(e) => set("autor", e.target.value)} /></label>
          </Seccion>

          <Seccion titulo="Buscadores y redes" icono={Search} resumen={f.slug ? `/${f.slug}` : "Enlace y descripción"}>
            <label className="block"><span className={etiquetaCampo}>Enlace (se genera del título)</span>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground focus-within:border-brand"><span className="shrink-0">/articulos/</span><input className="min-w-0 flex-1 bg-transparent text-foreground outline-none" value={f.slug} placeholder="se-genera-solo" onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90))} /></div>
            </label>
            <label className="block"><span className={etiquetaCampo}>Descripción para buscadores (máx. 160)</span><textarea className={`${campo} resize-none`} rows={3} maxLength={160} value={f.seoDescripcion} onChange={(e) => set("seoDescripcion", e.target.value)} placeholder="Si la dejas vacía se usa el resumen." />
              <span className={`mt-1 block text-right text-[11px] tabular-nums ${f.seoDescripcion.length > 150 ? "text-amber-600" : "text-muted-foreground"}`}>{f.seoDescripcion.length} / 160</span></label>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">En Google</p>
              <p className="mt-1.5 truncate text-[11px] text-emerald-700 dark:text-emerald-400">{portal.nombre} › articulos › {f.slug || "…"}</p>
              <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug font-medium text-blue-700 dark:text-blue-400">{(f.titulo || "Título del artículo").slice(0, 70)}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{(f.seoDescripcion || f.resumen || "Aquí saldrá la descripción.").slice(0, 160)}</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <p className="px-3 pt-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Al compartir en redes</p>
              <div className="m-3 overflow-hidden rounded-lg border border-border bg-surface-muted">
                <div className="aspect-[1.91/1] bg-gradient-to-br from-brand to-brand/60">
                  {f.portadaUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- vista previa de la portada
                    <img src={f.portadaUrl} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="px-3 py-2"><p className="truncate text-[11px] text-muted-foreground uppercase">{portal.slug}</p><p className="line-clamp-2 text-sm font-semibold">{f.titulo || "Título del artículo"}</p></div>
              </div>
            </div>
          </Seccion>

          {pro && idActual && (
            <details className={`${tarjeta} group`} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void cargarVersiones()}>
              <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <History className="size-4 text-brand" /><span className="text-sm font-semibold">Historial</span><span className="ml-1 text-xs text-muted-foreground">{versiones ? `${versiones.length} versiones` : "Versiones anteriores"}</span>
                <ChevronDown className="ml-auto size-4 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-border px-4 py-4">
                {!versiones ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Leyendo…</p>
                  : versiones.length === 0 ? <p className="text-xs text-muted-foreground">Todavía no hay versiones anteriores: se guardan cuando cambias el título, el resumen o el texto.</p>
                  : <ul className="space-y-2">{versiones.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 rounded-lg bg-surface-muted/70 px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{v.titulo}</span><span className="text-muted-foreground">{hace(v.creadoEn)}{v.autor ? ` · ${v.autor}` : ""}</span></span>
                      <button type="button" onClick={() => setComparar(v)} className="rounded-full px-2.5 py-1 font-semibold ring-1 ring-border hover:bg-surface">Comparar</button>
                    </li>))}</ul>}
              </div>
            </details>
          )}
        </aside>
      </div>

      {medios && <SelectorMedios portalId={portal.id} titulo={medios === "portada" ? "Elegir la portada" : "Insertar una imagen"} alElegir={elegirMedio} cerrar={() => setMedios(null)} />}
      {comparar && <Comparar version={comparar} actual={f} cerrar={() => setComparar(null)} restaurar={() => { setF((x) => ({ ...x, titulo: comparar.titulo, resumen: comparar.resumen, cuerpo: comparar.cuerpo })); setComparar(null); avisar("Versión cargada en el editor. Revísala y guarda para conservarla."); }} />}
    </div>
  );
}

function Comparar({ version, actual, cerrar, restaurar }: { version: VersionArticulo; actual: Forma; cerrar: () => void; restaurar: () => void }) {
  const d = React.useMemo(() => diferencias(version.cuerpo, actual.cuerpo), [version.cuerpo, actual.cuerpo]);
  const r = resumenDiff(d);
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal aria-label="Comparar versiones" onClick={cerrar}>
      <div className="w-full max-w-3xl rounded-3xl bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1"><h3 className="font-display text-lg font-semibold">Comparar con la versión de {hace(version.creadoEn)}</h3><p className="text-xs text-muted-foreground">En verde lo que tiene ahora el artículo y la versión no; en rojo lo que tenía la versión. <b className="text-foreground">+{r.agregadas} −{r.quitadas}</b> líneas.</p></div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted"><X className="size-4" /></button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto p-5 font-mono text-[12.5px] leading-relaxed">
          {version.titulo !== actual.titulo && <p className="mb-3 rounded-lg bg-surface-muted px-3 py-2 font-sans text-xs"><b>Título:</b> <span className="text-rose-600 line-through">{version.titulo}</span> → <span className="text-emerald-700 dark:text-emerald-300">{actual.titulo}</span></p>}
          {d.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap px-2 ${l.tipo === "agregada" ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200" : l.tipo === "quitada" ? "bg-rose-500/15 text-rose-900 line-through dark:text-rose-200" : "text-muted-foreground"}`}>{l.texto || " "}</div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
          <button type="button" onClick={restaurar} className={botonPrimario}><RotateCcw className="size-4" /> Usar esta versión</button>
          <p className="text-xs text-muted-foreground">Reemplaza el título, el resumen y el texto del editor; no se guarda hasta que guardes.</p>
        </div>
      </div>
    </div>
  );
}
