"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Bold, Check, ChevronRight, Heading2, List, Loader2, PenLine, Plus, Quote, Save, Search, Send, Sparkles, Trash2 } from "lucide-react";

import { aHtml, auditar, palabras, puntajeSeo, type Nota } from "@/lib/redactor/analisis";

import { usePeticion } from "../analisis-publicaciones/peticion";

type Grafica = { tipo: "barras" | "lineas" | "torta"; titulo: string; fuente: string; datos: { etiqueta: string; valor: number }[] };
type Fuente = { titulo: string; url: string };
type Guardada = {
  id: string; titulo: string; resumen: string; cuerpo: string; claves: string[]; palabraClave: string; portadaUrl: string; portadaAlt: string; seccion: string; region: string;
  seoTitulo: string; seoDescripcion: string; grafica: Grafica | null; material: string; fuentes: Fuente[]; modo: "manual" | "ia"; tono: string; estado: string;
  generadaConIa: boolean; revisada: boolean; actualizadoEn: string;
};
type Estado = {
  id: string | null; modo: "manual" | "ia"; tema: string; enfoque: string; tono: string; palabras: number; titulo: string; resumen: string; cuerpo: string; claves: string[]; palabraClave: string;
  portadaUrl: string; portadaAlt: string; seccion: string; region: string; seoTitulo: string; seoDescripcion: string; seoAlternativas: string[]; grafica: Grafica | null;
  material: string; fuentes: Fuente[]; generadaConIa: boolean; revisada: boolean; estado: string;
};

const PASOS = [
  { id: "tema", etiqueta: "Título y contexto" }, { id: "resumen", etiqueta: "Resumen" }, { id: "claves", etiqueta: "Palabras clave" }, { id: "portada", etiqueta: "Imagen" },
  { id: "seccion", etiqueta: "Sección" }, { id: "cuerpo", etiqueta: "Cuerpo" }, { id: "grafica", etiqueta: "Gráfica" }, { id: "seo", etiqueta: "Buscadores" }, { id: "vista", etiqueta: "Vista previa" },
] as const;
type PasoId = (typeof PASOS)[number]["id"];
const SECCIONES = ["Política", "Economía", "Seguridad", "Campo", "Educación", "Regiones", "Opinión", "Institucional"];
const DEPARTAMENTOS = ["Nacional", "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"];
const vacio = (modo: "manual" | "ia"): Estado => ({ id: null, modo, tema: "", enfoque: "", tono: "institucional", palabras: 450, titulo: "", resumen: "", cuerpo: "", claves: [], palabraClave: "", portadaUrl: "", portadaAlt: "", seccion: "", region: "Nacional", seoTitulo: "", seoDescripcion: "", seoAlternativas: [], grafica: null, material: "", fuentes: [], generadaConIa: false, revisada: false, estado: "borrador" });
const desde = (g: Guardada): Estado => ({ ...vacio(g.modo), ...g, tema: g.titulo, seoAlternativas: [], grafica: g.grafica ?? null, estado: g.estado });

const campo = "w-full rounded-xl border border-border bg-surface px-4 py-3 text-[15px] outline-none transition placeholder:text-muted-foreground/60 hover:border-foreground/25 focus:border-brand focus:ring-4 focus:ring-brand/10";
const boton = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const botonPrimario = `${boton} bg-brand text-brand-foreground hover:opacity-90`;
const botonContorno = `${boton} border border-border bg-surface hover:bg-surface-muted`;

/** Un campo del formulario: etiqueta clara, ayuda opcional y, a la derecha, un contador. */
function Campo({ etiqueta, ayuda, contador, children }: { etiqueta: string; ayuda?: string; contador?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{etiqueta}</span>
        {contador && <span className="text-xs tabular-nums">{contador}</span>}
      </div>
      {children}
      {ayuda && <p className="mt-1.5 text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

/** «56 / 65»: verde dentro del rango, ámbar fuera. */
function Rango({ n, min, max }: { n: number; min: number; max: number }) {
  const ok = n >= min && n <= max;
  return <span className={ok ? "font-semibold text-emerald-600" : "text-amber-600"}>{n} <span className="text-muted-foreground">/ {min}–{max}</span></span>;
}

/** El puntaje de SEO como un anillo. */
function Anillo({ puntos }: { puntos: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = puntos >= 80 ? "#059669" : puntos >= 50 ? "#d97706" : "#dc2626";
  return (
    <svg viewBox="0 0 80 80" className="size-20 shrink-0" role="img" aria-label={`Puntaje ${puntos} de 100`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="7" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(puntos / 100) * c} ${c}`} transform="rotate(-90 40 40)" />
      <text x="40" y="46" textAnchor="middle" className="fill-current text-[22px] font-bold">{puntos}</text>
    </svg>
  );
}

const AYUDA_PASO: Record<PasoId, { titulo: string; ayuda: string }> = {
  tema: { titulo: "Título y contexto", ayuda: "El tema y el material de donde saldrán los hechos." },
  resumen: { titulo: "Resumen", ayuda: "La entradilla: lo esencial en dos frases." },
  claves: { titulo: "Palabras clave", ayuda: "Lo que buscará la gente para llegar a esta nota." },
  portada: { titulo: "Imagen", ayuda: "La portada de la nota, con su texto alternativo." },
  seccion: { titulo: "Sección y lugar", ayuda: "Dónde se publica y de qué región habla." },
  cuerpo: { titulo: "Cuerpo", ayuda: "El texto de la nota. Las cifras y citas se comprueban contra el material." },
  grafica: { titulo: "Gráfica", ayuda: "Opcional, solo con datos reales y su fuente." },
  seo: { titulo: "Buscadores", ayuda: "Cómo aparecerá la nota en Google." },
  vista: { titulo: "Vista previa", ayuda: "Revisa cómo queda y envíala." },
};

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-surface-muted text-muted-foreground" },
  revision: { texto: "En revisión", clase: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  enviada: { texto: "Enviada al portal", clase: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" },
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return j;
}

/** El redactor: una nota en nueve pasos, con IA (solo desde el material del periodista) o a mano. La IA nunca publica. */
export function RedactorWizard() {
  const [v, setV] = React.useState(0);
  const lista = usePeticion<{ disponible: boolean; sql?: string; notas: Guardada[] }>(`/api/admin/redactor?v=${v}`);
  const [e, setE] = React.useState<Estado | null>(null);
  const [paso, setPaso] = React.useState<PasoId>("tema");
  const [ocupado, setOcupado] = React.useState<"" | "guardar" | "generar" | "dossier" | "enviar">("");
  const [msg, setMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [aud, setAud] = React.useState<ReturnType<typeof auditar> | null>(null);
  const portales = usePeticion<{ portales: { id: string; nombre: string }[] }>(e && paso === "vista" ? "/api/admin/portales" : null);
  const [portalId, setPortalId] = React.useState("");

  const set = (c: Partial<Estado>) => setE((x) => (x ? { ...x, ...c } : x));
  const seo = React.useMemo(() => {
    if (!e) return null;
    const nota: Nota = { titulo: e.titulo, resumen: e.resumen, cuerpo: e.cuerpo, claves: e.claves, palabraClave: e.palabraClave, portadaUrl: e.portadaUrl, portadaAlt: e.portadaAlt, seoTitulo: e.seoTitulo, seoDescripcion: e.seoDescripcion };
    return puntajeSeo(nota);
  }, [e]);
  const auditoria = React.useMemo(() => (e && e.cuerpo ? auditar(e.cuerpo, e.material) : aud), [e, aud]);

  async function guardar(estado?: "borrador" | "revision") {
    if (!e) return null;
    setOcupado("guardar");
    try {
      const r = await api<{ nota: Guardada }>("/api/admin/redactor", {
        method: "POST",
        body: JSON.stringify({ id: e.id, titulo: e.titulo, resumen: e.resumen, cuerpo: e.cuerpo, claves: e.claves, palabraClave: e.palabraClave, portadaUrl: e.portadaUrl, portadaAlt: e.portadaAlt, seccion: e.seccion, region: e.region, seoTitulo: e.seoTitulo, seoDescripcion: e.seoDescripcion, grafica: e.grafica, material: e.material, fuentes: e.fuentes, modo: e.modo, tono: e.tono, generadaConIa: e.generadaConIa, revisada: e.revisada, ...(estado ? { estado } : {}) }),
      });
      set({ id: r.nota.id, estado: r.nota.estado });
      setMsg({ ok: true, texto: estado === "revision" ? "Enviada a revisión." : "Borrador guardado." });
      setV((n) => n + 1);
      return r.nota.id;
    } catch (err) {
      setMsg({ ok: false, texto: err instanceof Error ? err.message : "No se pudo guardar." });
      return null;
    } finally {
      setOcupado("");
    }
  }

  async function generar() {
    if (!e) return;
    setMsg(null);
    setOcupado("generar");
    try {
      const r = await api<{ borrador?: { titulo: string; cuerpo: string; resumen: string; palabraClave: string; claves: string[]; seoTitulos: string[]; seoDescripcion: string }; auditoria?: ReturnType<typeof auditar>; insuficiente?: boolean; pedir?: string }>("/api/admin/redactor/generar", {
        method: "POST", body: JSON.stringify({ accion: "borrador", tema: e.tema, enfoque: e.enfoque || undefined, material: e.material, tono: e.tono, palabras: e.palabras, region: e.region !== "Nacional" ? e.region : undefined }),
      });
      if (r.insuficiente) return setMsg({ ok: false, texto: `Falta material: ${r.pedir}` });
      const b = r.borrador!;
      set({ titulo: b.titulo, cuerpo: b.cuerpo, resumen: b.resumen, palabraClave: b.palabraClave, claves: b.claves, seoAlternativas: b.seoTitulos, seoTitulo: b.seoTitulos[0] ?? "", seoDescripcion: b.seoDescripcion, generadaConIa: true, revisada: false });
      setAud(r.auditoria ?? null);
      setMsg({ ok: true, texto: "Borrador listo. Revísalo: la IA no publica nada." });
      setPaso("resumen");
    } catch (err) {
      setMsg({ ok: false, texto: err instanceof Error ? err.message : "No se pudo generar." });
    } finally {
      setOcupado("");
    }
  }

  async function dossier() {
    if (!e) return;
    setMsg(null);
    setOcupado("dossier");
    try {
      const r = await api<{ dossier: string; fuentes: Fuente[] }>("/api/admin/redactor/generar", { method: "POST", body: JSON.stringify({ accion: "dossier", tema: e.tema }) });
      set({ material: `${e.material ? `${e.material}\n\n` : ""}${r.dossier}`, fuentes: [...e.fuentes, ...r.fuentes].filter((f, i, a) => a.findIndex((g) => g.url === f.url) === i) });
      setMsg({ ok: true, texto: "Dossier agregado al material. Léelo y corrígelo antes de redactar." });
    } catch (err) {
      setMsg({ ok: false, texto: err instanceof Error ? err.message : "No se pudo armar el dossier." });
    } finally {
      setOcupado("");
    }
  }

  async function enviar() {
    if (!e || !portalId) return;
    const id = (await guardar()) ?? e.id;
    if (!id) return;
    setOcupado("enviar");
    try {
      await api("/api/admin/redactor/enviar", { method: "POST", body: JSON.stringify({ id, portalId }) });
      set({ estado: "enviada" });
      setMsg({ ok: true, texto: "Enviada al portal como borrador sin revisar: allí una persona la revisa y la publica." });
      setV((n) => n + 1);
    } catch (err) {
      setMsg({ ok: false, texto: err instanceof Error ? err.message : "No se pudo enviar." });
    } finally {
      setOcupado("");
    }
  }

  // ------------------------------------------------------------------ inicio: elegir cómo escribir y ver las notas
  if (!e) {
    const nueva = (modo: "ia" | "manual") => { setE(vacio(modo)); setPaso("tema"); setMsg(null); setAud(null); };
    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => nueva("ia")} className="group relative rounded-2xl border border-brand/30 bg-brand-soft p-6 text-left transition hover:border-brand hover:shadow-md">
            <span className="absolute top-4 right-4 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-brand-foreground uppercase">Recomendado</span>
            <span className="grid size-11 place-items-center rounded-full bg-brand text-brand-foreground"><Sparkles className="size-5" aria-hidden="true" /></span>
            <h3 className="mt-4 text-xl"><span className="font-light">Escribir </span><span className="font-bold">con IA</span></h3>
            <p className="mt-1.5 text-sm text-muted-foreground">Das el tema y tu material; la IA arma el borrador solo con lo que tú le entregaste. Cifras y citas se comprueban.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">Empezar<ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" /></span>
          </button>
          <button type="button" onClick={() => nueva("manual")} className="group rounded-2xl border border-border bg-surface p-6 text-left transition hover:border-foreground/30 hover:shadow-md">
            <span className="grid size-11 place-items-center rounded-full bg-surface-muted"><PenLine className="size-5" aria-hidden="true" /></span>
            <h3 className="mt-4 text-xl"><span className="font-light">Escribir </span><span className="font-bold">a mano</span></h3>
            <p className="mt-1.5 text-sm text-muted-foreground">Redactas tú el texto. Te acompañan el puntaje de buscadores y la vista previa.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">Empezar<ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" /></span>
          </button>
        </div>

        <section>
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Tus notas</h3>
          {lista.estado === "cargando" && <p className="text-sm text-muted-foreground">Leyendo tus notas…</p>}
          {lista.estado === "error" && <p className="text-sm text-red-700">{lista.error}</p>}
          {lista.estado === "listo" && !lista.data.disponible && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <p className="font-semibold">Para guardar las notas falta crear la tabla del redactor en Supabase.</p>
              <p className="mt-0.5 text-muted-foreground">Puedes escribir sin guardar. Copia este SQL, pégalo en Supabase › SQL Editor › Run y recarga.</p>
              {lista.data.sql && <textarea readOnly value={lista.data.sql} rows={6} className={`${campo} mt-3 font-mono text-xs`} onFocus={(ev) => ev.currentTarget.select()} />}
            </div>
          )}
          {lista.estado === "listo" && lista.data.disponible && lista.data.notas.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Todavía no hay notas. Empieza una arriba.</div>
          )}
          {lista.estado === "listo" && lista.data.notas.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.data.notas.map((n) => {
                const est = ESTADOS[n.estado] ?? ESTADOS.borrador;
                return (
                  <li key={n.id} className="group relative flex flex-col rounded-2xl border border-border bg-surface p-4 transition hover:border-foreground/30 hover:shadow-md">
                    <button type="button" onClick={() => { setE(desde(n)); setPaso(n.cuerpo ? "cuerpo" : "tema"); setMsg(null); setAud(null); }} className="flex-1 text-left">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${est.clase}`}>{est.texto}</span>
                        {n.modo === "ia" && <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">Con IA</span>}
                      </span>
                      <span className="mt-2 line-clamp-2 block text-base leading-snug font-semibold">{n.titulo || "Sin título"}</span>
                      <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{n.resumen || "Sin resumen."}</span>
                    </button>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(n.actualizadoEn).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
                      <button type="button" aria-label="Borrar la nota" onClick={() => window.confirm("¿Borrar esta nota?") && void api(`/api/admin/redactor?id=${n.id}`, { method: "DELETE" }).then(() => setV((x) => x + 1))} className="rounded-full p-1.5 opacity-0 transition hover:bg-surface-muted group-hover:opacity-100 focus:opacity-100"><Trash2 className="size-4" aria-hidden="true" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    );
  }

  // ------------------------------------------------------------------ asistente
  const i = PASOS.findIndex((p) => p.id === paso);
  const anterior = PASOS[i - 1]?.id;
  const siguiente = PASOS[i + 1];
  const numPal = palabras(e.cuerpo);
  const info = AYUDA_PASO[paso];
  const tituloPaso = paso === "tema" && e.modo === "manual" ? "Título" : info.titulo;
  const materialListo = Math.min(100, Math.round((e.material.trim().length / 200) * 100));
  const bloqueIa = e.modo === "ia" && paso === "tema";

  function formato(antes: string, despues = "", enLinea = false) {
    const el = document.getElementById("cuerpo-nota") as HTMLTextAreaElement | null;
    if (!el || !e) return;
    const a = el.selectionStart;
    const b = el.selectionEnd;
    const sel = e.cuerpo.slice(a, b) || "texto";
    const prefijo = !enLinea && a > 0 && e.cuerpo[a - 1] !== "\n" ? "\n\n" : "";
    const nuevo = `${e.cuerpo.slice(0, a)}${prefijo}${antes}${sel}${despues}${e.cuerpo.slice(b)}`;
    set({ cuerpo: nuevo, revisada: false });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + prefijo.length + antes.length, a + prefijo.length + antes.length + sel.length); });
  }

  // El editor ocupa siempre la misma altura: lo único que se desplaza es el contenido de cada paso, por dentro. Nada se mueve de lugar.
  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[36rem] flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setE(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Mis notas</button>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-surface-muted px-3 py-1">{e.modo === "ia" ? "Con IA" : "A mano"}</span>
          {e.generadaConIa && !e.revisada && <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-800 dark:text-amber-300">Generada con IA · sin revisar</span>}
          {e.estado !== "borrador" && <span className={`rounded-full px-3 py-1 ${(ESTADOS[e.estado] ?? ESTADOS.borrador).clase}`}>{(ESTADOS[e.estado] ?? ESTADOS.borrador).texto}</span>}
        </div>
      </div>

      {/* Pasos: una línea continua con el progreso; en pantallas chicas se desplaza de lado. */}
      <nav aria-label="Pasos" className="shrink-0 overflow-x-auto pb-1 [scrollbar-width:none]">
        <ol className="flex min-w-max items-start">
          {PASOS.map((p, k) => {
            const hecho = k < i;
            const actual = k === i;
            return (
              <li key={p.id} className="flex items-start">
                <button type="button" onClick={() => setPaso(p.id)} className="group flex w-20 flex-col items-center gap-1.5 text-center" aria-current={actual ? "step" : undefined}>
                  <span className={`grid size-8 place-items-center rounded-full border-2 text-xs font-bold transition ${actual ? "border-brand bg-brand text-brand-foreground" : hecho ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface text-muted-foreground group-hover:border-foreground/40"}`}>
                    {hecho ? <Check className="size-4" aria-hidden="true" /> : k + 1}
                  </span>
                  <span className={`text-[11px] leading-tight ${actual ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>{p.id === "tema" && e.modo === "manual" ? "Título" : p.etiqueta}</span>
                </button>
                {k < PASOS.length - 1 && <span aria-hidden="true" className={`mt-4 h-0.5 w-4 shrink-0 ${hecho ? "bg-brand" : "bg-border"}`} />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
          <header className="shrink-0 border-b border-border px-6 pt-4 pb-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Paso {i + 1} de {PASOS.length}</p>
            <h3 className="mt-0.5 text-2xl font-bold tracking-tight">{tituloPaso}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{info.ayuda}</p>
          </header>

          <div className={`min-h-0 flex-1 px-6 py-5 ${paso === "cuerpo" ? "flex flex-col gap-4 overflow-hidden" : "space-y-5 overflow-y-auto"}`}>
            {paso === "tema" && (e.modo === "ia" ? (
              <>
                <Campo etiqueta="Tema de la nota"><input className={campo} value={e.tema} onChange={(ev) => set({ tema: ev.target.value })} placeholder="p. ej. La alianza presenta su propuesta de seguridad rural" maxLength={400} /></Campo>
                <Campo etiqueta="Enfoque" ayuda="Opcional: el ángulo que quieres destacar."><input className={campo} value={e.enfoque} onChange={(ev) => set({ enfoque: ev.target.value })} maxLength={400} /></Campo>
                <Campo etiqueta="Material" ayuda="Es la única base de los hechos: la IA no usa nada que no esté aquí." contador={<span className={materialListo >= 100 ? "font-semibold text-emerald-600" : "text-amber-600"}>{e.material.trim().length.toLocaleString("es-CO")} caracteres · mínimo 200</span>}>
                  <textarea className={`${campo} min-h-52 font-mono text-[13px] leading-relaxed`} value={e.material} onChange={(ev) => set({ material: ev.target.value })} placeholder="Pega aquí lo que sabes: cifras, fechas, nombres, declaraciones textuales…" />
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-muted"><div className={`h-full rounded-full transition-all ${materialListo >= 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${materialListo}%` }} /></div>
                </Campo>
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted p-3">
                  <button type="button" disabled={!!ocupado || e.tema.trim().length < 5} onClick={() => void dossier()} className={botonContorno}>{ocupado === "dossier" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}Armar dossier con fuentes de la web</button>
                  <span className="text-xs text-muted-foreground">{e.fuentes.length ? `${e.fuentes.length} fuentes agregadas` : "Si no tienes material, la IA busca fuentes públicas y tú las revisas."}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo etiqueta="Tono"><select className={campo} value={e.tono} onChange={(ev) => set({ tono: ev.target.value })}><option value="institucional">Institucional</option><option value="cercano">Cercano</option><option value="combativo">Combativo</option></select></Campo>
                  <Campo etiqueta="Extensión"><select className={campo} value={e.palabras} onChange={(ev) => set({ palabras: Number(ev.target.value) })}>{[250, 450, 700, 1000].map((n) => <option key={n} value={n}>{n} palabras</option>)}</select></Campo>
                  <Campo etiqueta="Región"><select className={campo} value={e.region} onChange={(ev) => set({ region: ev.target.value })}>{DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}</select></Campo>
                </div>
              </>
            ) : (
              <Campo etiqueta="Título de la nota" contador={<Rango n={e.titulo.length} min={30} max={65} />}><input className={`${campo} text-lg font-semibold`} value={e.titulo} onChange={(ev) => set({ titulo: ev.target.value })} maxLength={160} autoFocus /></Campo>
            ))}

            {paso === "resumen" && (
              <>
                <Campo etiqueta="Título" contador={<Rango n={e.titulo.length} min={30} max={65} />}><input className={`${campo} text-lg font-semibold`} value={e.titulo} onChange={(ev) => set({ titulo: ev.target.value })} maxLength={160} /></Campo>
                <Campo etiqueta="Resumen" contador={<Rango n={e.resumen.length} min={70} max={160} />}><textarea className={`${campo} min-h-32 leading-relaxed`} value={e.resumen} onChange={(ev) => set({ resumen: ev.target.value })} maxLength={400} /></Campo>
              </>
            )}

            {paso === "claves" && (
              <>
                <Campo etiqueta="Palabra clave de enfoque" ayuda="La frase principal que debe aparecer en el título y en el primer párrafo."><input className={campo} value={e.palabraClave} onChange={(ev) => set({ palabraClave: ev.target.value })} maxLength={80} /></Campo>
                <Campo etiqueta="Etiquetas" ayuda="Separadas por coma. Mínimo tres." contador={<span className={e.claves.length >= 3 ? "font-semibold text-emerald-600" : "text-amber-600"}>{e.claves.length}</span>}>
                  <input className={campo} value={e.claves.join(", ")} onChange={(ev) => set({ claves: ev.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12) })} />
                  {e.claves.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{e.claves.map((c) => <span key={c} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{c}</span>)}</div>}
                </Campo>
              </>
            )}

            {paso === "portada" && (
              <>
                <Campo etiqueta="Dirección (URL) de la imagen" ayuda="Pega el enlace de una imagen que tengas derecho a usar."><input className={campo} value={e.portadaUrl} onChange={(ev) => set({ portadaUrl: ev.target.value })} placeholder="https://…" /></Campo>
                <Campo etiqueta="Texto alternativo" ayuda="Describe lo que se ve, para quien no puede verla y para los buscadores." contador={<Rango n={e.portadaAlt.length} min={10} max={300} />}><input className={campo} value={e.portadaAlt} onChange={(ev) => set({ portadaAlt: ev.target.value })} maxLength={300} /></Campo>
                {/^https:\/\//.test(e.portadaUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.portadaUrl} alt={e.portadaAlt} className="aspect-video w-full max-w-md rounded-xl border border-border object-cover" referrerPolicy="no-referrer" />
                ) : <div className="grid aspect-video w-full max-w-md place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">La imagen aparecerá aquí</div>}
              </>
            )}

            {paso === "seccion" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Sección"><select className={campo} value={e.seccion} onChange={(ev) => set({ seccion: ev.target.value })}><option value="">Elige una sección</option>{SECCIONES.map((x) => <option key={x}>{x}</option>)}</select></Campo>
                <Campo etiqueta="Región o departamento"><select className={campo} value={e.region} onChange={(ev) => set({ region: ev.target.value })}>{DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}</select></Campo>
                <p className="text-xs text-muted-foreground sm:col-span-2">La firma de la nota es de quien la escribe: la persona que inició sesión.</p>
              </div>
            )}

            {paso === "cuerpo" && (
              <>
                <div className="flex min-h-72 flex-1 flex-col overflow-hidden rounded-xl border border-border focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                  <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-muted px-2 py-1.5">
                    {[
                      { t: "Subtítulo", i: Heading2, f: () => formato("## ", "") },
                      { t: "Negrita", i: Bold, f: () => formato("**", "**", true) },
                      { t: "Lista", i: List, f: () => formato("- ", "") },
                      { t: "Cita", i: Quote, f: () => formato("> ", "") },
                    ].map(({ t, i: I, f }) => <button key={t} type="button" onClick={f} title={t} aria-label={t} className="rounded-lg p-2 text-muted-foreground hover:bg-surface hover:text-foreground"><I className="size-4" aria-hidden="true" /></button>)}
                    <span className="ml-auto pr-2 text-xs tabular-nums text-muted-foreground">{numPal} palabras</span>
                  </div>
                  <textarea id="cuerpo-nota" className="block min-h-0 w-full flex-1 resize-none bg-surface px-5 py-4 font-serif text-[16px] leading-[1.75] outline-none" value={e.cuerpo} onChange={(ev) => set({ cuerpo: ev.target.value, revisada: false })} placeholder="Escribe o pega el texto de la nota…" />
                </div>
                {auditoria && e.cuerpo && (
                  <div className={`rounded-xl border p-4 text-sm ${auditoria.sinRespaldo.length ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                    <p className="flex items-center gap-2 font-semibold">
                      {auditoria.sinRespaldo.length ? <AlertTriangle className="size-4 text-amber-600" aria-hidden="true" /> : <Check className="size-4 text-emerald-600" aria-hidden="true" />}
                      {auditoria.sinRespaldo.length ? `${auditoria.sinRespaldo.length} cifra(s) o cita(s) no constan en el material` : `Auditoría limpia: ${auditoria.cifras} cifras y ${auditoria.citas} citas respaldadas`}
                    </p>
                    {auditoria.sinRespaldo.length > 0 && <ul className="mt-2 space-y-1 text-[13px]">{auditoria.sinRespaldo.map((h, k) => <li key={k}><span className="mr-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold uppercase">{h.tipo}</span>{h.texto}</li>)}</ul>}
                    {auditoria.sinRespaldo.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Verifícalas con una fuente o quítalas antes de enviar la nota.</p>}
                  </div>
                )}
              </>
            )}

            {paso === "grafica" && (e.grafica ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo etiqueta="Título"><input className={campo} value={e.grafica.titulo} onChange={(ev) => set({ grafica: { ...e.grafica!, titulo: ev.target.value } })} /></Campo>
                  <Campo etiqueta="Fuente"><input className={campo} value={e.grafica.fuente} onChange={(ev) => set({ grafica: { ...e.grafica!, fuente: ev.target.value } })} placeholder="entidad y año" /></Campo>
                  <Campo etiqueta="Tipo"><select className={campo} value={e.grafica.tipo} onChange={(ev) => set({ grafica: { ...e.grafica!, tipo: ev.target.value as Grafica["tipo"] } })}><option value="barras">Barras</option><option value="lineas">Líneas</option><option value="torta">Torta</option></select></Campo>
                </div>
                <Campo etiqueta="Datos" ayuda="Una línea por dato, con el formato «Etiqueta: valor».">
                  <textarea className={`${campo} min-h-36 font-mono text-[13px]`} defaultValue={e.grafica.datos.map((d) => `${d.etiqueta}: ${d.valor}`).join("\n")} onChange={(ev) => set({ grafica: { ...e.grafica!, datos: ev.target.value.split("\n").map((l) => l.split(":")).filter((q) => q.length >= 2 && Number.isFinite(Number(q[q.length - 1]))).map((q) => ({ etiqueta: q.slice(0, -1).join(":").trim(), valor: Number(q[q.length - 1]) })) } })} />
                </Campo>
                <button type="button" onClick={() => set({ grafica: null })} className={botonContorno}>Quitar la gráfica</button>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">Esta nota no lleva gráfica. Puedes seguir sin ella.</p>
                <button type="button" onClick={() => set({ grafica: { tipo: "barras", titulo: "", fuente: "", datos: [] } })} className={`${botonContorno} mt-3`}><Plus className="size-4" aria-hidden="true" />Agregar una gráfica</button>
              </div>
            ))}

            {paso === "seo" && (
              <>
                {e.seoAlternativas.length > 0 && (
                  <Campo etiqueta="Alternativas de título">
                    <div className="space-y-2">{e.seoAlternativas.map((t) => <button key={t} type="button" onClick={() => set({ seoTitulo: t })} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition ${e.seoTitulo === t ? "border-brand bg-brand-soft font-semibold" : "border-border hover:border-foreground/30"}`}><span>{t}</span>{e.seoTitulo === t && <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />}</button>)}</div>
                  </Campo>
                )}
                <Campo etiqueta="Título para buscadores" contador={<Rango n={(e.seoTitulo || e.titulo).length} min={30} max={65} />}><input className={campo} value={e.seoTitulo} onChange={(ev) => set({ seoTitulo: ev.target.value })} maxLength={120} placeholder={e.titulo} /></Campo>
                <Campo etiqueta="Descripción" contador={<Rango n={(e.seoDescripcion || e.resumen).length} min={70} max={160} />}><textarea className={`${campo} min-h-24`} value={e.seoDescripcion} onChange={(ev) => set({ seoDescripcion: ev.target.value })} maxLength={300} placeholder={e.resumen} /></Campo>
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Así se verá en Google</p>
                  <p className="mt-2 truncate text-lg text-sky-700 dark:text-sky-300">{e.seoTitulo || e.titulo || "Título de la nota"}</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">tusitio.com › {(e.seccion || "nota").toLowerCase()}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{e.seoDescripcion || e.resumen || "La descripción de la nota aparecerá aquí."}</p>
                </div>
              </>
            )}

            {paso === "vista" && (
              <>
                <article className="mx-auto max-w-2xl rounded-2xl border border-border p-6">
                  <p className="text-xs font-bold tracking-wide text-brand uppercase">{e.seccion || "Sin sección"}{e.region && e.region !== "Nacional" ? ` · ${e.region}` : ""}</p>
                  <h2 className="mt-2 font-serif text-3xl leading-tight font-bold">{e.titulo || "Sin título"}</h2>
                  {e.resumen && <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{e.resumen}</p>}
                  {/^https:\/\//.test(e.portadaUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.portadaUrl} alt={e.portadaAlt} className="mt-5 aspect-video w-full rounded-xl object-cover" referrerPolicy="no-referrer" />
                  )}
                  <div className="mt-5 space-y-4 font-serif text-[17px] leading-[1.75] [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-brand/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h3]:mt-6 [&_h3]:font-sans [&_h3]:text-xl [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-6" dangerouslySetInnerHTML={{ __html: aHtml(e.cuerpo) }} />
                  {e.grafica && e.grafica.datos.length > 0 && (
                    <figure className="mt-6 rounded-xl bg-surface-muted p-4">
                      <figcaption className="text-sm font-semibold">{e.grafica.titulo || "Gráfica"}</figcaption>
                      {e.grafica.datos.map((d) => { const max = Math.max(...e.grafica!.datos.map((x) => x.valor), 1); return <div key={d.etiqueta} className="mt-2 text-xs"><div className="flex justify-between"><span>{d.etiqueta}</span><span className="tabular-nums">{d.valor.toLocaleString("es-CO")}</span></div><div className="mt-0.5 h-2 rounded-full bg-border"><div className="h-2 rounded-full bg-brand" style={{ width: `${(Math.max(d.valor, 0) / max) * 100}%` }} /></div></div>; })}
                      <p className="mt-3 text-[11px] text-muted-foreground">Fuente: {e.grafica.fuente || "sin indicar"}</p>
                    </figure>
                  )}
                  {e.fuentes.length > 0 && <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground"><p className="font-semibold">Fuentes</p><ul className="mt-1 list-disc space-y-0.5 pl-5">{e.fuentes.map((f) => <li key={f.url}><a className="underline" href={f.url} target="_blank" rel="noreferrer noopener">{f.titulo || f.url}</a></li>)}</ul></div>}
                </article>

                <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface-muted p-5">
                  {e.generadaConIa && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface p-3 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={e.revisada} onChange={(ev) => set({ revisada: ev.target.checked })} /><span><strong>Lo revisé.</strong> Leí la nota completa y verifiqué cada cifra y cada cita.</span></label>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={!!ocupado} onClick={() => void guardar("borrador")} className={botonContorno}>Guardar borrador</button>
                    <button type="button" disabled={!!ocupado} onClick={() => void guardar("revision")} className={botonContorno}>Enviar a revisión</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    <select value={portalId} onChange={(ev) => setPortalId(ev.target.value)} className={`${campo} !w-auto min-w-52 !rounded-full !py-2.5 text-sm`} aria-label="Portal">
                      <option value="">Elige un portal…</option>
                      {portales.estado === "listo" && portales.data.portales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <button type="button" disabled={!portalId || !!ocupado || (e.generadaConIa && !e.revisada)} onClick={() => void enviar()} className={botonPrimario}>{ocupado === "enviar" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}Enviar al portal como borrador</button>
                  </div>
                  <p className="text-xs text-muted-foreground">El Redactor no publica nada: la nota llega al portal como borrador y una persona la publica allí.</p>
                </div>
              </>
            )}

            {msg && <p role="status" className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>{msg.texto}</p>}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-6 py-3">
            <button type="button" disabled={!anterior} onClick={() => anterior && setPaso(anterior)} className={botonContorno}><ArrowLeft className="size-4" aria-hidden="true" />Atrás</button>
            <div className="flex flex-wrap items-center gap-2">
              {bloqueIa ? (
                <button type="button" disabled={!!ocupado || e.tema.trim().length < 5} onClick={() => void generar()} className={botonPrimario}>{ocupado === "generar" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}{ocupado === "generar" ? "Redactando…" : "Redactar borrador con IA"}</button>
              ) : (
                <>
                  <button type="button" disabled={!!ocupado} onClick={() => void guardar()} className={botonContorno}><Save className="size-4" aria-hidden="true" />{ocupado === "guardar" ? "Guardando…" : "Guardar"}</button>
                  {siguiente && <button type="button" onClick={() => setPaso(siguiente.id)} className={botonPrimario}>{siguiente.etiqueta}<ArrowRight className="size-4" aria-hidden="true" /></button>}
                </>
              )}
            </div>
          </footer>
        </section>

        {seo && (
          <aside className="hidden min-h-0 overflow-y-auto rounded-2xl border border-border bg-surface p-5 lg:block">
            <div className="flex items-center gap-4">
              <Anillo puntos={seo.puntos} />
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">SEO en vivo</p>
                <p className="text-xl font-bold">{seo.nivel}</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {seo.grupos.map((g) => (
                <div key={g.grupo}>
                  <div className="flex justify-between text-xs"><span className="font-medium">{({ contenido: "Contenido útil y confiable", ficha: "Ficha en buscadores", imagen: "Imagen y Discover", lectura: "Lectura y estructura" } as const)[g.grupo]}</span><span className="tabular-nums text-muted-foreground">{g.pct}%</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className={`h-full rounded-full ${g.pct >= 80 ? "bg-emerald-500" : g.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${g.pct}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Por mejorar</p>
              <ul className="space-y-1">
                {seo.criterios.filter((c) => !c.ok).map((c) => (
                  <li key={c.texto}><button type="button" onClick={() => setPaso(({ cuerpo: "cuerpo", seo: "seo", claves: "claves", portada: "portada" } as Record<string, PasoId>)[c.paso])} className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface-muted"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-500" /><span className="flex-1">{c.texto}</span><ChevronRight className="mt-0.5 size-3.5 shrink-0 opacity-0 transition group-hover:opacity-60" aria-hidden="true" /></button></li>
                ))}
                {seo.criterios.every((c) => c.ok) && <li className="px-2 py-1.5 text-[13px] font-medium text-emerald-600">Todo cumplido.</li>}
              </ul>
              <details className="mt-3 text-[13px]">
                <summary className="cursor-pointer px-2 py-1 text-xs font-semibold text-muted-foreground">Cumplido ({seo.criterios.filter((c) => c.ok).length})</summary>
                <ul className="mt-1 space-y-1">{seo.criterios.filter((c) => c.ok).map((c) => <li key={c.texto} className="flex items-start gap-2 px-2 py-1 text-muted-foreground"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />{c.texto}</li>)}</ul>
              </details>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
