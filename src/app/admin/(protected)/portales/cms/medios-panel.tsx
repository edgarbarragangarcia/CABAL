"use client";

import * as React from "react";
import { Check, Copy, ImagePlus, Images, Loader2, Search, Trash2, TriangleAlert, UploadCloud, X } from "lucide-react";

import type { Medio } from "@/lib/portales/cms/medios-puro";
import type { Portal } from "@/lib/portales/store";
import { botonPrimario, botonSecundario, campo, etiquetaCampo, hace, mensajeDe, numero, pedir, tarjeta } from "./comun";

/**
 * Biblioteca de medios del portal: sube imágenes (se comprimen en el navegador si son grandes), les pone texto alternativo y
 * las deja listas para usar de portada o dentro de un texto. `SelectorMedios` es la misma biblioteca como ventana para elegir.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const LADO_MAX = 2400;

const tamano = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/** Reduce una foto grande antes de subirla: máximo 2.400 px de lado y WebP; las que ya son livianas pasan igual. */
async function prepararImagen(archivo: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) {
    if (archivo.size > MAX_BYTES) throw new Error(`«${archivo.name}» pesa más de 4 MB.`);
    return archivo;
  }
  if (archivo.size <= 1.2 * 1024 * 1024) {
    const bmp = await createImageBitmap(archivo).catch(() => null);
    if (!bmp) return archivo;
    const grande = Math.max(bmp.width, bmp.height) > LADO_MAX;
    bmp.close();
    if (!grande) return archivo;
  }
  const bmp = await createImageBitmap(archivo).catch(() => null);
  if (!bmp) {
    if (archivo.size > MAX_BYTES) throw new Error(`«${archivo.name}» pesa más de 4 MB y no se pudo reducir.`);
    return archivo;
  }
  const k = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bmp.width * k);
  lienzo.height = Math.round(bmp.height * k);
  lienzo.getContext("2d")!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close();
  for (const calidad of [0.86, 0.72, 0.58]) {
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/webp", calidad));
    if (blob && blob.size <= MAX_BYTES) return new File([blob], archivo.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  }
  throw new Error(`«${archivo.name}» es demasiado pesada incluso reducida.`);
}

export async function subirImagen(portalId: string, archivo: File): Promise<Medio> {
  const listo = await prepararImagen(archivo);
  const f = new FormData();
  f.append("archivo", listo);
  const r = await fetch(`/api/admin/portales/${portalId}/medios`, { method: "POST", body: f });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error ?? `No se pudo subir la imagen (${r.status}).`);
  return b.medio as Medio;
}

/** Sube varias imágenes de a una y avisa de cada resultado. */
function useSubidas(portalId: string, alSubir: (m: Medio) => void) {
  const [enCurso, setEnCurso] = React.useState(0);
  const [errores, setErrores] = React.useState<string[]>([]);
  const subir = React.useCallback(
    async (archivos: File[]) => {
      setErrores([]);
      setEnCurso((n) => n + archivos.length);
      for (const a of archivos) {
        try {
          alSubir(await subirImagen(portalId, a));
        } catch (e) {
          setErrores((l) => [...l, mensajeDe(e, `No se pudo subir «${a.name}».`)]);
        } finally {
          setEnCurso((n) => n - 1);
        }
      }
    },
    [portalId, alSubir]
  );
  return { enCurso, errores, subir, limpiar: () => setErrores([]) };
}

function useMedios(portalId: string) {
  const [medios, setMedios] = React.useState<Medio[] | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let cancelado = false;
    pedir<{ medios: Medio[] }>(`/api/admin/portales/${portalId}/medios`, "GET")
      .then((r) => {
        if (!cancelado) setMedios(r.medios);
      })
      .catch((e) => {
        if (!cancelado) setError(mensajeDe(e, "No se pudo abrir la biblioteca. ¿Ya ejecutaste supabase/portales-cms-pro.sql?"));
      });
    return () => {
      cancelado = true;
    };
  }, [portalId]);
  return { medios, setMedios, error };
}

function Zona({ alSoltar, enCurso, children }: { alSoltar: (a: File[]) => void; enCurso: number; children: React.ReactNode }) {
  const [sobre, setSobre] = React.useState(false);
  const entrada = React.useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); const a = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")); if (a.length) alSoltar(a); }}
      className={`rounded-2xl border-2 border-dashed p-4 transition ${sobre ? "border-brand bg-brand-soft/50" : "border-border"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><UploadCloud className="size-5" /></span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-semibold">Arrastra imágenes aquí o elígelas</p>
          <p className="text-xs text-muted-foreground">JPG, PNG, WebP o GIF. Las fotos grandes se reducen solas antes de subirlas.</p>
        </div>
        <button type="button" onClick={() => entrada.current?.click()} className={botonPrimario}>{enCurso > 0 ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {enCurso > 0 ? `Subiendo ${enCurso}…` : "Elegir imágenes"}</button>
        <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) alSoltar([...e.target.files]); e.target.value = ""; }} />
      </div>
      {children}
    </div>
  );
}

function Rejilla({ medios, elegido, alElegir }: { medios: Medio[]; elegido?: string | null; alElegir: (m: Medio) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {medios.map((m) => (
        <li key={m.id}>
          <button type="button" onClick={() => alElegir(m)} aria-label={`Elegir ${m.nombre}`} className={`group block w-full overflow-hidden rounded-xl border bg-surface text-left transition hover:border-brand ${elegido === m.id ? "border-brand ring-2 ring-brand/30" : "border-border"}`}>
            <span className="block aspect-[4/3] overflow-hidden bg-surface-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniaturas desde Storage */}
              <img src={m.url} alt={m.alt || m.nombre} loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
            </span>
            <span className="block px-2.5 py-2">
              <span className="block truncate text-xs font-semibold">{m.nombre}</span>
              <span className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{tamano(m.bytes)}</span>{!m.alt && <span className="text-amber-700 dark:text-amber-300">sin texto alt.</span>}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------- selector ---- */

/** La biblioteca como ventana: elegir una imagen para la portada o para insertarla en el texto. */
export function SelectorMedios({ portalId, titulo = "Elegir una imagen", alElegir, cerrar }: { portalId: string; titulo?: string; alElegir: (m: Medio) => void; cerrar: () => void }) {
  const { medios, setMedios, error } = useMedios(portalId);
  const [q, setQ] = React.useState("");
  const { enCurso, errores, subir } = useSubidas(portalId, (m) => setMedios((l) => [m, ...(l ?? [])]));
  const visibles = (medios ?? []).filter((m) => !q || `${m.nombre} ${m.alt}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal aria-label={titulo} onClick={cerrar}>
      <div className="w-full max-w-4xl rounded-3xl bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-brand"><Images className="size-5" /></span>
          <div className="min-w-0 flex-1"><h3 className="font-display text-lg font-semibold">{titulo}</h3><p className="text-xs text-muted-foreground">Sube una nueva o elige de la biblioteca.</p></div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted"><X className="size-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <Zona alSoltar={(a) => void subir(a)} enCurso={enCurso}>
            {errores.length > 0 && <ul className="mt-3 space-y-1">{errores.map((e, i) => <li key={i} className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />{e}</li>)}</ul>}
          </Zona>
          {error ? (
            <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{error}</p>
          ) : !medios ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
          ) : medios.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Todavía no hay imágenes. Sube la primera.</p>
          ) : (
            <>
              <label className="flex items-center gap-2 rounded-full border border-border px-4 py-2 focus-within:border-brand"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o texto alternativo…" aria-label="Buscar imágenes" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
              <Rejilla medios={visibles} alElegir={alElegir} />
              {visibles.length === 0 && <p className="text-center text-sm text-muted-foreground">Ninguna imagen coincide.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ panel ---- */

export function MediosPanel({ portal }: { portal: Portal }) {
  const { medios, setMedios, error } = useMedios(portal.id);
  const [q, setQ] = React.useState("");
  const [abierto, setAbierto] = React.useState<Medio | null>(null);
  const { enCurso, errores, subir } = useSubidas(portal.id, (m) => setMedios((l) => [m, ...(l ?? [])]));
  const visibles = (medios ?? []).filter((m) => !q || `${m.nombre} ${m.alt}`.toLowerCase().includes(q.toLowerCase()));
  const sinAlt = (medios ?? []).filter((m) => !m.alt).length;
  const total = (medios ?? []).reduce((s, m) => s + m.bytes, 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-semibold">Medios</h3>
        <p className="text-sm text-muted-foreground">Las imágenes de {portal.nombre}: portadas de artículos, ilustraciones dentro de los textos y piezas de publicidad.</p>
      </div>
      <Zona alSoltar={(a) => void subir(a)} enCurso={enCurso}>
        {errores.length > 0 && <ul className="mt-3 space-y-1">{errores.map((e, i) => <li key={i} className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />{e}</li>)}</ul>}
      </Zona>

      {error ? (
        <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>
      ) : !medios ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
      ) : (
        <section className={`${tarjeta} space-y-4 p-5`}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-full border border-border px-4 py-2 focus-within:border-brand"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imágenes…" aria-label="Buscar imágenes" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            <p className="text-xs text-muted-foreground">{numero(medios.length)} imágenes · {tamano(total)}{sinAlt > 0 ? ` · ${sinAlt} sin texto alternativo` : ""}</p>
          </div>
          {medios.length === 0 ? (
            <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground"><Images className="size-8" />Aún no hay imágenes en este portal.</div>
          ) : (
            <Rejilla medios={visibles} elegido={abierto?.id} alElegir={setAbierto} />
          )}
        </section>
      )}
      {abierto && <DetalleMedio key={abierto.id} portalId={portal.id} medio={abierto} cerrar={() => setAbierto(null)} cambiado={(m) => { setAbierto(m); setMedios((l) => (l ?? []).map((x) => (x.id === m.id ? m : x))); }} borrado={() => { setMedios((l) => (l ?? []).filter((x) => x.id !== abierto.id)); setAbierto(null); }} />}
    </div>
  );
}

function DetalleMedio({ portalId, medio, cerrar, cambiado, borrado }: { portalId: string; medio: Medio; cerrar: () => void; cambiado: (m: Medio) => void; borrado: () => void }) {
  const [alt, setAlt] = React.useState(medio.alt);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState("");
  const [copiado, setCopiado] = React.useState("");
  const [usos, setUsos] = React.useState<{ articulos: string[]; paginas: string[] } | null>(null);

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      cambiado((await pedir<{ medio: Medio }>(`/api/admin/portales/${portalId}/medios/${medio.id}`, "PUT", { alt })).medio);
    } catch (e) {
      setError(mensajeDe(e, "No se pudo guardar."));
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(forzar: boolean) {
    setError("");
    try {
      const r = await fetch(`/api/admin/portales/${portalId}/medios/${medio.id}${forzar ? "?forzar=1" : ""}`, { method: "DELETE" });
      const b = await r.json().catch(() => ({}));
      if (r.status === 409 && b.usos) return setUsos(b.usos);
      if (!r.ok) throw new Error(b.error ?? "No se pudo borrar la imagen.");
      borrado();
    } catch (e) {
      setError(mensajeDe(e, "No se pudo borrar la imagen."));
    }
  }

  const copiar = (texto: string, que: string) => {
    void navigator.clipboard.writeText(texto);
    setCopiado(que);
    setTimeout(() => setCopiado(""), 1800);
  };
  const markdown = `![${alt || medio.nombre}](${medio.url})`;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={cerrar}>
      <aside className="h-full w-full max-w-md space-y-4 overflow-y-auto bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Imagen">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1"><h3 className="truncate font-display text-lg font-semibold">{medio.nombre}</h3><p className="text-xs text-muted-foreground">{tamano(medio.bytes)} · subida {hace(medio.creadoEn)}{medio.subidoPor ? ` por ${medio.subidoPor}` : ""}</p></div>
          <button type="button" aria-label="Cerrar" onClick={cerrar} className="rounded p-1 hover:bg-surface-muted"><X className="size-5" /></button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen desde Storage */}
        <img src={medio.url} alt={medio.alt || medio.nombre} className="max-h-72 w-full rounded-xl border border-border bg-surface-muted object-contain" />
        <label className="block"><span className={etiquetaCampo}>Texto alternativo (lo que lee un lector de pantalla)</span><input className={campo} value={alt} maxLength={160} onChange={(e) => setAlt(e.target.value)} placeholder="Describe lo que se ve, en una frase" /></label>
        <button type="button" onClick={() => void guardar()} disabled={guardando || alt === medio.alt} className={botonPrimario}>{guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar texto alternativo</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copiar(medio.url, "url")} className={botonSecundario}><Copy className="size-4" /> {copiado === "url" ? "Enlace copiado" : "Copiar enlace"}</button>
          <button type="button" onClick={() => copiar(markdown, "md")} className={botonSecundario}><Copy className="size-4" /> {copiado === "md" ? "Copiado" : "Copiar para un texto"}</button>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
        {usos ? (
          <div className="space-y-2 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">Esta imagen está en uso:</p>
            <ul className="list-disc pl-5 text-xs">{[...usos.articulos.map((t) => `Artículo: ${t}`), ...usos.paginas.map((t) => `Página: ${t}`)].map((t) => <li key={t}>{t}</li>)}</ul>
            <p className="text-xs">Si la borras, esos lugares mostrarán un espacio vacío.</p>
            <div className="flex gap-2"><button type="button" onClick={() => void borrar(true)} className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white">Borrar de todos modos</button><button type="button" onClick={() => setUsos(null)} className={botonSecundario}>Conservarla</button></div>
          </div>
        ) : (
          <button type="button" onClick={() => void borrar(false)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300"><Trash2 className="size-3.5" /> Borrar la imagen</button>
        )}
      </aside>
    </div>
  );
}
