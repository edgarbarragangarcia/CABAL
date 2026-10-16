"use client";

import * as React from "react";
import { FileText, Loader2, Mic, Trash2, Upload, Video } from "lucide-react";

import { GoogleDrive } from "@/components/admin/google-drive";

import { usePeticion } from "../analisis-publicaciones/peticion";

type Fuente = { id: string; tipo: "archivo" | "youtube" | "texto"; titulo: string; fuente: string | null; formato: string; palabras: number; caracteres: number; paginas: number | null; activo: boolean; creadoEn: string; vistaPrevia: string };
type Huella = {
  textos: number; palabras: number; frases: number; palabrasPorFrase: number; frasePercentil90: number; palabrasPorParrafo: number;
  signos: Record<"interrogacion" | "exclamacion" | "puntosSuspensivos" | "rayas" | "parentesis" | "comillas" | "dosPuntos" | "emojis" | "hashtags" | "mayusculas", number>;
  tratamiento: Record<"usted" | "ustedes" | "nosotros" | "yo" | "colombianos", number>;
  frasesFrecuentes: { texto: string; veces: number }[]; palabrasFrecuentes: { texto: string; veces: number }[]; aperturas: { texto: string; veces: number }[]; vocabularioTotal: number;
};
type Resp = { disponible: boolean; sql?: string; fuentes: Fuente[]; huella: Huella | null; formatos: string[] };

const FORMATO: Record<string, string> = { general: "General", x: "Trinos de X", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", columna: "Columnas", discurso: "Discursos", entrevista: "Entrevistas" };
const campo = "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/60 hover:border-foreground/25 focus:border-brand focus:ring-4 focus:ring-brand/10";
const n = (v: number) => v.toLocaleString("es-CO");

type Estado = { nombre: string; fase: "espera" | "subiendo" | "ok" | "error" | "repetido" | "aviso"; texto?: string };
type Vectores = { disponible: boolean; total: number; vectorizados: number; pendientes: number; modelo: string | null; hayClave: boolean; error?: string };
const PARTE = 3.5 * 1024 * 1024;

async function enviar(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; j: { error?: string; palabras?: number; paginas?: number | null; titulo?: string; automatica?: boolean; duplicado?: boolean; aviso?: string } }> {
  try {
    const r = await fetch(url, init);
    return { ok: r.ok, status: r.status, j: (await r.json().catch(() => ({}))) as never };
  } catch {
    return { ok: false, status: 0, j: { error: "Sin conexión con el servidor." } };
  }
}

/** La voz de la Dra.: los textos reales de donde el Redactor aprende a escribir exactamente como ella. */
export function VozPanel() {
  const [v, setV] = React.useState(0);
  const r = usePeticion<Resp>(`/api/admin/voz?v=${v}`);
  const [formato, setFormato] = React.useState("general");
  const [subidas, setSubidas] = React.useState<Estado[]>([]);
  const [ocupado, setOcupado] = React.useState(false);
  const [urls, setUrls] = React.useState("");
  const [resultadosYt, setResultadosYt] = React.useState<(Estado & { url: string })[]>([]);
  const [pegado, setPegado] = React.useState<{ abierto: boolean; titulo: string; texto: string; fuente: string; msg?: string }>({ abierto: false, titulo: "", texto: "", fuente: "" });
  const [abierta, setAbierta] = React.useState<string | null>(null);
  const [arrastrando, setArrastrando] = React.useState(false);
  const [drive, setDrive] = React.useState(false);
  const [vec, setVec] = React.useState<Vectores | null>(null);
  const [vectorizando, setVectorizando] = React.useState(false);
  const vecInicial = usePeticion<Vectores>(`/api/admin/voz/vectorizar?v=${v}`);
  const entrada = React.useRef<HTMLInputElement>(null);
  const recargar = () => setV((x) => x + 1);

  /** Vectoriza lo pendiente de a ratos de ~35 s hasta terminar: así «lee» todo lo cargado por significado. */
  async function vectorizarTodo() {
    setVectorizando(true);
    try {
      for (let i = 0; i < 200; i++) {
        const res = await enviar("/api/admin/voz/vectorizar", { method: "POST" });
        const e = res.j as unknown as Vectores;
        setVec(e);
        if (!res.ok || e.error || e.pendientes === 0) break;
      }
    } finally {
      setVectorizando(false);
    }
  }

  async function subir(archivos: File[]) {
    if (!archivos.length) return;
    setOcupado(true);
    const lista: Estado[] = archivos.map((f) => ({ nombre: f.name, fase: "espera" }));
    setSubidas(lista);
    for (let i = 0; i < archivos.length; i++) {
      lista[i] = { ...lista[i], fase: "subiendo" };
      setSubidas([...lista]);
      let res;
      if (archivos[i].size > PARTE) {
        // Archivo grande: sube en partes de 3,5 MB (Vercel no admite más de 4,5 MB por petición) y luego se lee completo.
        const id = crypto.randomUUID();
        const n = Math.ceil(archivos[i].size / PARTE);
        let falla: string | null = null;
        for (let k = 0; k < n && !falla; k++) {
          lista[i] = { ...lista[i], fase: "subiendo", texto: `Subiendo parte ${k + 1} de ${n}…` };
          setSubidas([...lista]);
          const parte = await enviar(`/api/admin/voz/parte?id=${id}&n=${k}`, { method: "PUT", body: archivos[i].slice(k * PARTE, (k + 1) * PARTE) });
          if (!parte.ok) falla = parte.j.error ?? "No se pudo subir una parte del archivo.";
        }
        res = falla ? { ok: false, status: 500, j: { error: falla } } : await enviar("/api/admin/voz/agregar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archivoId: id, partes: n, nombre: archivos[i].name, formato }) });
      } else {
        const fd = new FormData();
        fd.append("archivo", archivos[i]);
        fd.append("formato", formato);
        res = await enviar("/api/admin/voz/agregar", { method: "POST", body: fd });
      }
      lista[i] = res.ok && res.j.aviso ? { ...lista[i], fase: "aviso", texto: res.j.aviso } : res.ok ? { ...lista[i], fase: "ok", texto: `${n(res.j.palabras ?? 0)} palabras leídas${res.j.paginas ? ` · ${res.j.paginas} páginas` : ""}` } : res.j.duplicado || res.status === 409 ? { ...lista[i], fase: "repetido", texto: "Ya estaba cargado" } : { ...lista[i], fase: "error", texto: res.j.error ?? "No se pudo leer" };
      setSubidas([...lista]);
    }
    setOcupado(false);
    recargar();
    void vectorizarTodo();
  }

  async function traerYoutube() {
    const lista = [...new Set(urls.split(/\s+/).map((u) => u.trim()).filter((u) => /youtu/.test(u)))];
    if (!lista.length) return;
    setOcupado(true);
    const out: (Estado & { url: string })[] = lista.map((u) => ({ url: u, nombre: u, fase: "espera" }));
    setResultadosYt([...out]);
    for (let i = 0; i < lista.length; i++) {
      out[i] = { ...out[i], fase: "subiendo" };
      setResultadosYt([...out]);
      const res = await enviar("/api/admin/voz/agregar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ youtube: lista[i], formato }) });
      out[i] = res.ok ? { ...out[i], nombre: res.j.titulo ?? lista[i], fase: "ok", texto: `${n(res.j.palabras ?? 0)} palabras${res.j.automatica ? " · subtítulos automáticos (pueden traer errores)" : ""}` } : res.status === 409 ? { ...out[i], fase: "repetido", texto: "Ya estaba cargado" } : { ...out[i], fase: "error", texto: res.j.error ?? "No se pudo traer" };
      setResultadosYt([...out]);
    }
    setOcupado(false);
    recargar();
    void vectorizarTodo();
  }

  async function guardarPegado() {
    setOcupado(true);
    const res = await enviar("/api/admin/voz/agregar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: pegado.texto, titulo: pegado.titulo, formato, ...(pegado.fuente ? { fuente: pegado.fuente } : {}) }) });
    setOcupado(false);
    if (res.ok) {
      setPegado({ abierto: false, titulo: "", texto: "", fuente: "" });
      recargar();
      void vectorizarTodo();
    } else setPegado((p) => ({ ...p, msg: res.j.error ?? "No se pudo guardar." }));
  }

  const cambiar = (id: string, c: Record<string, unknown>) => void fetch("/api/admin/voz", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...c }) }).then(recargar);
  const borrar = (f: Fuente) => window.confirm(`¿Quitar «${f.titulo}» de la voz?`) && void fetch(`/api/admin/voz?id=${f.id}`, { method: "DELETE" }).then(recargar);

  if (r.estado === "cargando") return <p className="text-sm text-muted-foreground">Leyendo los textos de la voz…</p>;
  if (r.estado === "error") return <p className="text-sm text-red-700">{r.error}</p>;
  const d = r.data;
  const h = d.huella;
  const calidad = !h ? { t: "Sin textos todavía", c: "bg-surface-muted text-muted-foreground", p: 0 } : h.palabras < 5000 ? { t: "Insuficiente", c: "bg-red-500/15 text-red-700", p: Math.round((h.palabras / 20000) * 100) } : h.palabras < 20000 ? { t: "Básica", c: "bg-amber-500/15 text-amber-800 dark:text-amber-300", p: Math.round((h.palabras / 20000) * 100) } : { t: "Sólida", c: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300", p: 100 };
  const icono = (t: Fuente["tipo"]) => (t === "youtube" ? Video : t === "texto" ? Mic : FileText);
  const marca = (e: Estado) => (e.fase === "ok" ? "text-emerald-700" : e.fase === "error" ? "text-red-700" : e.fase === "repetido" || e.fase === "aviso" ? "text-amber-700" : "text-muted-foreground");

  return (
    <div className="space-y-6">
      {drive && <GoogleDrive alCerrar={() => setDrive(false)} alElegir={subir} />}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-2xl"><span className="font-light">La voz de </span><span className="font-bold">la Dra.</span></h2>
            <p className="mt-1 text-sm text-muted-foreground">Carga aquí lo que ella escribió o dijo: discursos, columnas, trinos, entrevistas y transcripciones de sus videos. El Redactor lee el texto completo, mide cómo escribe (largo de frases, signos, expresiones que repite) y escribe imitándola. Sube solo textos suyos.</p>
          </div>
          <div className="text-right">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${calidad.c}`}>{calidad.t}</span>
            <p className="mt-2 text-2xl font-bold tabular-nums">{n(h?.palabras ?? 0)} <span className="text-sm font-medium text-muted-foreground">palabras</span></p>
            <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, calidad.p)}%` }} /></div>
            <p className="mt-1 text-[11px] text-muted-foreground">Meta: 20.000 palabras o más</p>
          </div>
        </div>
        {!d.disponible && (
          <div className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm">
            <p className="font-semibold">Falta crear la tabla de la voz en Supabase.</p>
            {d.sql && <textarea readOnly value={d.sql} rows={6} className={`${campo} mt-2 font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />}
          </div>
        )}
      </div>

      {d.disponible && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
            <label className="text-sm font-semibold">Lo que cargues ahora es:
              <select className={`${campo} ml-2 !w-auto`} value={formato} onChange={(e) => setFormato(e.target.value)}>{d.formatos.map((f) => <option key={f} value={f}>{FORMATO[f] ?? f}</option>)}</select>
            </label>
            <span className="text-xs text-muted-foreground">Sirve para que, al escribir un trino, el Redactor mire primero sus trinos.</span>
          </div>

          {(() => {
            const e = vec ?? (vecInicial.estado === "listo" ? vecInicial.data : null);
            if (!e || !e.disponible) return e && !e.disponible ? <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm">Para que el Redactor lea por significado falta ejecutar <code>voz.sql</code> de nuevo en Supabase (agrega los vectores).</p> : null;
            const pct = e.total ? Math.round((e.vectorizados / e.total) * 100) : 0;
            return (
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Lectura por significado (vectores en Supabase)</p>
                    <p className="text-xs text-muted-foreground">{e.total === 0 ? "Aún no hay fragmentos." : `${n(e.vectorizados)} de ${n(e.total)} fragmentos leídos${e.modelo ? ` · ${e.modelo}` : ""}. Al escribir, el Redactor busca en todo esto los pasajes suyos más parecidos al tema.`}</p>
                  </div>
                  {e.pendientes > 0 && <button type="button" disabled={vectorizando} onClick={() => void vectorizarTodo()} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60">{vectorizando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{vectorizando ? `Leyendo… ${pct}%` : `Leer los ${n(e.pendientes)} pendientes`}</button>}
                  {e.total > 0 && e.pendientes === 0 && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">Todo leído</span>}
                </div>
                {e.total > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>}
                {!e.hayClave && e.total > 0 && <p className="mt-2 text-xs text-amber-700">Falta una clave de Gemini u OpenAI en Configuración › Inteligencia artificial: Claude no genera vectores.</p>}
                {e.error && <p className="mt-2 text-xs text-red-700">{e.error}</p>}
              </div>
            );
          })()}

          <div className="grid gap-5 lg:grid-cols-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastrando(false); void subir([...e.dataTransfer.files]); }}
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${arrastrando ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}
            >
              <Upload className="mx-auto size-7 text-brand" aria-hidden="true" />
              <p className="mt-2 font-semibold">Arrastra aquí todos los archivos que quieras</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF con texto, Word, TXT, Markdown, CSV o HTML · hasta 40 MB cada uno · se leen por completo</p>
              <input ref={entrada} type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.log" className="hidden" onChange={(e) => { void subir([...(e.target.files ?? [])]); e.target.value = ""; }} />
              <button type="button" disabled={ocupado} onClick={() => entrada.current?.click()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50">{ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}Elegir archivos</button>
              <button type="button" disabled={ocupado} onClick={() => setDrive(true)} className="ml-2 mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50">Desde Google Drive</button>
              {subidas.length > 0 && (
                <ul className="mt-4 max-h-56 space-y-1 overflow-y-auto text-left text-xs">
                  {subidas.map((s, i) => <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted px-3 py-1.5"><span className="min-w-0 truncate font-medium">{s.nombre}</span><span className={`shrink-0 ${marca(s)}`}>{s.fase === "subiendo" ? "Leyendo…" : s.fase === "espera" ? "En fila" : s.texto}</span></li>)}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="flex items-center gap-2 font-semibold"><Video className="size-5 text-brand" aria-hidden="true" />Videos de YouTube</p>
              <p className="mt-1 text-xs text-muted-foreground">Pega los enlaces, uno por línea. Se trae la transcripción de los subtítulos del video.</p>
              <textarea className={`${campo} mt-3 min-h-28 font-mono text-xs`} value={urls} onChange={(e) => setUrls(e.target.value)} placeholder={"https://www.youtube.com/watch?v=…\nhttps://youtu.be/…"} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" disabled={ocupado || !/youtu/.test(urls)} onClick={() => void traerYoutube()} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50">{ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Video className="size-4" aria-hidden="true" />}Traer transcripciones</button>
                <button type="button" onClick={() => setPegado((p) => ({ ...p, abierto: !p.abierto }))} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-muted">Pegar un texto a mano</button>
              </div>
              {resultadosYt.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs">
                  {resultadosYt.map((s, i) => (
                    <li key={i} className="rounded-lg bg-surface-muted px-3 py-1.5">
                      <div className="flex items-start justify-between gap-3"><span className="min-w-0 truncate font-medium">{s.nombre}</span><span className={`shrink-0 ${marca(s)}`}>{s.fase === "subiendo" ? "Trayendo…" : s.fase === "espera" ? "En fila" : s.fase === "error" ? "No se pudo" : s.texto}</span></div>
                      {s.fase === "error" && <p className="mt-1 text-red-700">{s.texto} <button type="button" className="font-semibold underline" onClick={() => setPegado({ abierto: true, titulo: "", texto: "", fuente: s.url })}>Pegar la transcripción de este video</button></p>}
                    </li>
                  ))}
                </ul>
              )}
              {pegado.abierto && (
                <div className="mt-4 space-y-2 rounded-xl border border-border p-3">
                  <input className={campo} placeholder="Título (p. ej. Discurso en el Senado, 12 de marzo)" value={pegado.titulo} onChange={(e) => setPegado((p) => ({ ...p, titulo: e.target.value }))} />
                  {pegado.fuente && <p className="truncate text-xs text-muted-foreground">Fuente: {pegado.fuente}</p>}
                  <textarea className={`${campo} min-h-32`} placeholder="Pega aquí el texto completo, tal como ella lo dijo o escribió" value={pegado.texto} onChange={(e) => setPegado((p) => ({ ...p, texto: e.target.value }))} />
                  {pegado.msg && <p className="text-xs text-red-700">{pegado.msg}</p>}
                  <button type="button" disabled={ocupado || pegado.texto.trim().length < 40 || !pegado.titulo.trim()} onClick={() => void guardarPegado()} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground disabled:opacity-50">Guardar este texto</button>
                </div>
              )}
            </div>
          </div>

          {h && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h3 className="text-lg font-bold">Cómo escribe, medido con sus textos</h3>
              <p className="text-xs text-muted-foreground">Son medidas exactas calculadas con código sobre {n(h.textos)} textos; el Redactor las usa y comprueba cada texto nuevo contra ellas.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[["Palabras por frase", String(h.palabrasPorFrase), `El 90 % no pasa de ${h.frasePercentil90}`], ["Palabras por párrafo", String(h.palabrasPorParrafo), `${n(h.frases)} frases leídas`], ["Vocabulario propio", n(h.vocabularioTotal), "palabras distintas"], ["Trata de usted", String(h.tratamiento.usted + h.tratamiento.ustedes), "por cada 1.000 palabras"]].map(([t, val, sub]) => (
                  <div key={t} className="rounded-xl bg-surface-muted p-3"><p className="text-xs text-muted-foreground">{t}</p><p className="text-2xl font-bold tabular-nums">{val}</p><p className="text-[11px] text-muted-foreground">{sub}</p></div>
                ))}
              </div>
              <div className="mt-4 grid gap-5 text-sm lg:grid-cols-3">
                <div><p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Expresiones que repite</p><div className="flex flex-wrap gap-1.5">{h.frasesFrecuentes.slice(0, 14).map((f) => <span key={f.texto} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{f.texto} <span className="font-normal opacity-70">×{f.veces}</span></span>)}{h.frasesFrecuentes.length === 0 && <span className="text-xs text-muted-foreground">Se verán con más textos.</span>}</div></div>
                <div><p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Palabras más suyas</p><div className="flex flex-wrap gap-1.5">{h.palabrasFrecuentes.slice(0, 16).map((f) => <span key={f.texto} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold">{f.texto} <span className="font-normal text-muted-foreground">×{f.veces}</span></span>)}</div></div>
                <div><p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Signos (por 1.000 palabras)</p><ul className="space-y-0.5 text-xs text-muted-foreground"><li>¿ ? {h.signos.interrogacion} · ¡ ! {h.signos.exclamacion} · … {h.signos.puntosSuspensivos}</li><li>Rayas — {h.signos.rayas} · paréntesis {h.signos.parentesis} · comillas {h.signos.comillas}</li><li>Emojis {h.signos.emojis} · hashtags {h.signos.hashtags} · MAYÚSCULAS {h.signos.mayusculas}</li></ul></div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface">
            <div className="flex items-baseline justify-between border-b border-border px-5 py-3"><h3 className="font-bold">Textos cargados <span className="font-medium text-muted-foreground">{d.fuentes.length}</span></h3><span className="text-xs text-muted-foreground">Lo desactivado no se usa, pero se conserva.</span></div>
            {d.fuentes.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Todavía no hay textos. Carga el primero arriba.</p>}
            <ul className="divide-y divide-border">
              {d.fuentes.map((f) => {
                const I = icono(f.tipo);
                return (
                  <li key={f.id} className={`px-5 py-3 ${f.activo ? "" : "opacity-50"}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <I className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <button type="button" onClick={() => setAbierta(abierta === f.id ? null : f.id)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-semibold">{f.titulo}</span><span className="text-xs text-muted-foreground">{n(f.palabras)} palabras{f.paginas ? ` · ${f.paginas} págs.` : ""} · {new Date(f.creadoEn).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span></button>
                      <select value={f.formato} onChange={(e) => cambiar(f.id, { formato: e.target.value })} aria-label="Formato" className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold">{d.formatos.map((x) => <option key={x} value={x}>{FORMATO[x] ?? x}</option>)}</select>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold"><input type="checkbox" className="accent-[var(--brand)]" checked={f.activo} onChange={(e) => cambiar(f.id, { activo: e.target.checked })} />Usar</label>
                      <button type="button" aria-label={`Quitar ${f.titulo}`} onClick={() => borrar(f)} className="rounded-full p-1.5 hover:bg-surface-muted"><Trash2 className="size-4" aria-hidden="true" /></button>
                    </div>
                    {abierta === f.id && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-muted p-3 font-serif text-[13px] leading-relaxed">{f.vistaPrevia}{f.caracteres > 700 ? "…" : ""}<span className="mt-2 block font-sans text-[11px] text-muted-foreground">Así leyó el sistema el comienzo de este texto ({n(f.caracteres)} caracteres en total). Si se ve mal, vuelve a subirlo en otro formato.</span></p>}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
