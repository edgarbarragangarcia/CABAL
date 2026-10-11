"use client";

import * as React from "react";
import { Loader2, Megaphone, Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";

import { EspacioAnuncio } from "@/components/portales/cms";
import { construirAmbiente } from "@/components/portales/marco";
import { anuncioVigente } from "@/lib/portales/cms/puro";
import { tematicaDe, type EspacioId } from "@/lib/portales/cms/tematicas";
import { anuncioSchema, type AjustesPortal, type Anuncio } from "@/lib/portales/cms/tipos";
import type { Portal } from "@/lib/portales/store";
import { botonPrimario, botonSecundario, campo, datosVistaPrevia, etiquetaCampo, mensajeDe, numero, pedir, tarjeta, type AnuncioBorrador } from "./comun";

/**
 * Publicidad: cada portal tiene sus propios espacios (según su temática) y sus propios anuncios; nada se comparte entre portales
 * salvo la base de datos. Los anuncios de texto o de imagen se programan por fechas y se reparten según su prioridad. Cada
 * visita cuenta una impresión y cada clic pasa por el portal, que lo cuenta y lleva al anunciante.
 */

const vacio = (espacio: EspacioId): AnuncioBorrador => ({ espacio, nombre: "", anunciante: "", formato: "texto", titulo: "", texto: "", boton: "", imagenUrl: "", destinoUrl: "", desde: null, hasta: null, estado: "activo", prioridad: 1 });
const aBorrador = (a: Anuncio): AnuncioBorrador => ({ espacio: a.espacio, nombre: a.nombre, anunciante: a.anunciante, formato: a.formato, titulo: a.titulo, texto: a.texto, boton: a.boton, imagenUrl: a.imagenUrl, destinoUrl: a.destinoUrl, desde: a.desde, hasta: a.hasta, estado: a.estado, prioridad: a.prioridad });
const ctr = (a: Anuncio) => (a.impresiones > 0 ? `${((a.clics / a.impresiones) * 100).toFixed(1).replace(".", ",")} %` : "—");
const fechaCorta = (f: string | null) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : null);

function Vigencia({ a }: { a: Anuncio }) {
  if (a.estado === "pausado") return <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">En pausa</span>;
  if (!anuncioVigente(a)) return <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">Fuera de fechas</span>;
  return <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">En emisión</span>;
}

function FormularioAnuncio({ portal, ajustes, inicial, id, cerrar, guardado }: { portal: Portal; ajustes: AjustesPortal; inicial: AnuncioBorrador; id: string | null; cerrar: () => void; guardado: () => void }) {
  const tematica = tematicaDe(portal.plantilla);
  const [v, setV] = React.useState<AnuncioBorrador>(inicial);
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState("");
  const set = <K extends keyof AnuncioBorrador>(k: K, valor: AnuncioBorrador[K]) => setV((x) => ({ ...x, [k]: valor }));
  const espacio = tematica.espacios.find((e) => e.id === v.espacio)!;

  const prueba = anuncioSchema.safeParse({ ...v, desde: v.desde ?? "", hasta: v.hasta ?? "" });
  // La vista previa usa el mismo componente del sitio público, con este anuncio en su espacio.
  const borradorComoAnuncio: Anuncio | null = prueba.success ? { id: "vista", portalId: portal.id, ...prueba.data, impresiones: 0, clics: 0, creadoEn: "" } : null;
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: false, idBase: "anuncio", cms: datosVistaPrevia(ajustes, borradorComoAnuncio ? { [v.espacio]: borradorComoAnuncio } : {}) });

  async function guardar() {
    if (!prueba.success) {
      setError(prueba.error.issues[0]?.message ?? "Revisa los datos del anuncio.");
      return;
    }
    setOcupado(true);
    setError("");
    try {
      if (id) await pedir(`/api/admin/portales/${portal.id}/anuncios/${id}`, "PUT", { ...v, desde: v.desde ?? "", hasta: v.hasta ?? "" });
      else await pedir(`/api/admin/portales/${portal.id}/anuncios`, "POST", { ...v, desde: v.desde ?? "", hasta: v.hasta ?? "" });
      guardado();
    } catch (e) {
      setError(mensajeDe(e, "No se pudo guardar el anuncio."));
      setOcupado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal aria-label={id ? "Editar anuncio" : "Nuevo anuncio"}>
      <div className="w-full max-w-4xl rounded-3xl bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <h3 className="font-display text-xl font-semibold">{id ? "Editar anuncio" : "Nuevo anuncio"}</h3>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="ml-auto grid size-9 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted"><X className="size-4" /></button>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <label className="block"><span className={etiquetaCampo}>Espacio</span>
              <select className={campo} value={v.espacio} onChange={(e) => set("espacio", e.target.value as EspacioId)}>{tematica.espacios.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
              <span className="mt-1 block text-xs text-muted-foreground">{espacio.donde}. Imagen sugerida: {espacio.medida}. Encaja con: {espacio.sugerencia}</span></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className={etiquetaCampo}>Nombre de la campaña (interno)</span><input className={campo} value={v.nombre} maxLength={80} onChange={(e) => set("nombre", e.target.value)} /></label>
              <label className="block"><span className={etiquetaCampo}>Anunciante</span><input className={campo} value={v.anunciante} maxLength={80} onChange={(e) => set("anunciante", e.target.value)} /></label>
            </div>
            <div className="inline-flex rounded-full bg-surface-muted p-1 text-sm" role="radiogroup" aria-label="Formato">
              {([["texto", "Texto"], ["imagen", "Imagen"]] as const).map(([f, t]) => <button key={f} type="button" role="radio" aria-checked={v.formato === f} onClick={() => set("formato", f)} className={`rounded-full px-4 py-1.5 font-semibold transition ${v.formato === f ? "bg-brand text-brand-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>)}
            </div>
            {v.formato === "texto" ? (
              <>
                <label className="block"><span className={etiquetaCampo}>Título</span><input className={campo} value={v.titulo} maxLength={90} onChange={(e) => set("titulo", e.target.value)} /></label>
                <label className="block"><span className={etiquetaCampo}>Texto (opcional)</span><textarea className={`${campo} resize-none`} rows={2} value={v.texto} maxLength={220} onChange={(e) => set("texto", e.target.value)} /></label>
                <label className="block sm:max-w-xs"><span className={etiquetaCampo}>Texto del botón (opcional)</span><input className={campo} placeholder="Conocer más" value={v.boton} maxLength={30} onChange={(e) => set("boton", e.target.value)} /></label>
              </>
            ) : (
              <label className="block"><span className={etiquetaCampo}>Enlace de la imagen</span><input className={campo} type="url" placeholder="https://…/anuncio.jpg" value={v.imagenUrl} maxLength={500} onChange={(e) => set("imagenUrl", e.target.value)} /><span className="mt-1 block text-xs text-muted-foreground">La imagen debe estar alojada por el anunciante o en un servicio de imágenes (aquí no se suben archivos).</span></label>
            )}
            <label className="block"><span className={etiquetaCampo}>A dónde lleva el clic</span><input className={campo} type="url" placeholder="https://anunciante.co/promocion" value={v.destinoUrl} maxLength={500} onChange={(e) => set("destinoUrl", e.target.value)} /></label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block"><span className={etiquetaCampo}>Desde (opcional)</span><input className={campo} type="date" value={v.desde ?? ""} onChange={(e) => set("desde", e.target.value || null)} /></label>
              <label className="block"><span className={etiquetaCampo}>Hasta (opcional)</span><input className={campo} type="date" value={v.hasta ?? ""} onChange={(e) => set("hasta", e.target.value || null)} /></label>
              <label className="block"><span className={etiquetaCampo}>Prioridad (1 a 10)</span><input className={campo} type="number" min={1} max={10} value={v.prioridad} onChange={(e) => set("prioridad", Math.min(10, Math.max(1, Number(e.target.value) || 1)))} /></label>
            </div>
            <p className="text-xs text-muted-foreground">Si en un mismo espacio hay varios anuncios en emisión, se reparten las visitas según su prioridad: uno de prioridad 3 sale tres veces más que uno de prioridad 1.</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Así se verá</p>
            <div style={vars} className="@container pointer-events-none rounded-2xl bg-[var(--fondo)] p-4 text-[var(--texto)]">
              {borradorComoAnuncio ? <EspacioAnuncio a={a} espacio={v.espacio} /> : <p className="py-10 text-center text-sm text-muted-foreground">Completa el anuncio para ver cómo queda.</p>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-4">
          <button type="button" onClick={guardar} disabled={ocupado} className={botonPrimario}>{ocupado && <Loader2 className="size-4 animate-spin" />} Guardar anuncio</button>
          <button type="button" onClick={cerrar} className={botonSecundario}>Cancelar</button>
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function PublicidadPanel({ portal, ajustes, cambio }: { portal: Portal; ajustes: AjustesPortal; cambio: () => void }) {
  const tematica = tematicaDe(portal.plantilla);
  const [anuncios, setAnuncios] = React.useState<Anuncio[] | null>(null);
  const [error, setError] = React.useState("");
  const [forma, setForma] = React.useState<{ id: string | null; inicial: AnuncioBorrador } | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  const cargar = React.useCallback(async () => {
    try {
      setAnuncios((await pedir<{ anuncios: Anuncio[] }>(`/api/admin/portales/${portal.id}/anuncios`, "GET")).anuncios);
      setError("");
    } catch (e) {
      setError(mensajeDe(e, "No se pudieron leer los anuncios."));
      setAnuncios([]);
    }
  }, [portal.id]);
  React.useEffect(() => {
    let cancelado = false;
    pedir<{ anuncios: Anuncio[] }>(`/api/admin/portales/${portal.id}/anuncios`, "GET")
      .then((r) => { if (!cancelado) setAnuncios(r.anuncios); })
      .catch((e) => { if (!cancelado) { setError(mensajeDe(e, "No se pudieron leer los anuncios.")); setAnuncios([]); } });
    return () => { cancelado = true; };
  }, [portal.id]);

  async function alternar(a: Anuncio) {
    setOcupado(true);
    try {
      await pedir(`/api/admin/portales/${portal.id}/anuncios/${a.id}`, "PUT", { ...aBorrador(a), estado: a.estado === "activo" ? "pausado" : "activo", desde: a.desde ?? "", hasta: a.hasta ?? "" });
      await cargar();
      cambio();
    } catch (e) {
      setError(mensajeDe(e, "No se pudo cambiar el anuncio."));
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar(a: Anuncio) {
    if (!window.confirm(`¿Eliminar el anuncio «${a.nombre}»? También se pierden sus cifras.`)) return;
    setOcupado(true);
    try {
      await pedir(`/api/admin/portales/${portal.id}/anuncios/${a.id}`, "DELETE");
      await cargar();
      cambio();
    } catch (e) {
      setError(mensajeDe(e, "No se pudo eliminar el anuncio."));
    } finally {
      setOcupado(false);
    }
  }

  const lista = anuncios ?? [];
  const enEmision = (e: EspacioId) => lista.filter((a) => a.espacio === e && anuncioVigente(a)).length;
  const totales = lista.reduce((t, a) => ({ i: t.i + a.impresiones, c: t.c + a.clics }), { i: 0, c: 0 });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Espacios publicitarios de {portal.nombre}</h3>
          <p className="text-sm text-muted-foreground">Son propios de este portal y están pensados para su público. Un espacio sin anuncio en emisión queda oculto; el llamado a sumarse a la comunidad se muestra siempre.</p>
        </div>
        <button type="button" onClick={() => setForma({ id: null, inicial: vacio("cabecera") })} className={`${botonPrimario} ml-auto`}><Plus className="size-4" /> Nuevo anuncio</button>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tematica.espacios.map((e) => {
          const n = enEmision(e.id);
          return (
            <li key={e.id} className={`${tarjeta} flex flex-col gap-2 p-4`}>
              <div className="flex items-center gap-2"><Megaphone className="size-4 text-brand" /><p className="font-semibold">{e.nombre}</p><span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${n > 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-surface-muted text-muted-foreground"}`}>{n > 0 ? `${n} en emisión` : "Libre"}</span></div>
              <p className="text-xs text-muted-foreground">{e.donde}.</p>
              <p className="text-xs text-muted-foreground">Imagen: {e.medida}.</p>
              <p className="text-xs text-muted-foreground"><b className="font-semibold text-foreground">Encaja con:</b> {e.sugerencia}</p>
              <button type="button" onClick={() => setForma({ id: null, inicial: vacio(e.id) })} className="mt-auto self-start rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted">+ Anuncio aquí</button>
            </li>
          );
        })}
      </ul>

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
      {!anuncios && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Leyendo anuncios…</p>}

      {anuncios && lista.length === 0 && !error && (
        <div className={`${tarjeta} grid place-items-center gap-2 p-12 text-center`}>
          <Megaphone className="size-8 text-muted-foreground" />
          <p className="font-semibold">Todavía no hay anuncios</p>
          <p className="max-w-md text-sm text-muted-foreground">Crea el primero para un anunciante de este portal: un banner de texto o una imagen, con fechas y prioridad.</p>
        </div>
      )}

      {lista.length > 0 && (
        <section className={`${tarjeta} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
                <tr><th className="px-4 py-3 font-semibold">Anuncio</th><th className="px-3 py-3 font-semibold">Espacio</th><th className="px-3 py-3 font-semibold">Vigencia</th><th className="px-3 py-3 text-right font-semibold">Impresiones</th><th className="px-3 py-3 text-right font-semibold">Clics</th><th className="px-3 py-3 text-right font-semibold">CTR</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3"><p className="font-semibold">{a.nombre}</p><p className="text-xs text-muted-foreground">{a.anunciante || "Sin anunciante"} · {a.formato === "imagen" ? "imagen" : "texto"} · prioridad {a.prioridad}</p></td>
                    <td className="px-3 py-3">{tematica.espacios.find((e) => e.id === a.espacio)?.nombre ?? a.espacio}</td>
                    <td className="px-3 py-3"><Vigencia a={a} />{(a.desde || a.hasta) && <p className="mt-1 text-xs text-muted-foreground">{fechaCorta(a.desde) ?? "siempre"} → {fechaCorta(a.hasta) ?? "sin fin"}</p>}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{numero(a.impresiones)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{numero(a.clics)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{ctr(a)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setForma({ id: a.id, inicial: aBorrador(a) })} aria-label={`Editar ${a.nombre}`} className="grid size-8 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted"><Pencil className="size-3.5" /></button>
                        <button type="button" onClick={() => alternar(a)} disabled={ocupado} aria-label={a.estado === "activo" ? `Pausar ${a.nombre}` : `Reanudar ${a.nombre}`} className="grid size-8 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted disabled:opacity-50">{a.estado === "activo" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}</button>
                        <button type="button" onClick={() => eliminar(a)} disabled={ocupado} aria-label={`Eliminar ${a.nombre}`} className="grid size-8 place-items-center rounded-full text-rose-600 ring-1 ring-rose-500/30 hover:bg-rose-500/10 disabled:opacity-50"><Trash2 className="size-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border bg-surface-muted/40 px-4 py-3 text-xs text-muted-foreground">En total: {numero(totales.i)} impresiones y {numero(totales.c)} clics. Las visitas de buscadores y de vistas previas no se cuentan.</p>
        </section>
      )}

      {forma && <FormularioAnuncio portal={portal} ajustes={ajustes} inicial={forma.inicial} id={forma.id} cerrar={() => setForma(null)} guardado={() => { setForma(null); void cargar(); cambio(); }} />}
    </div>
  );
}
