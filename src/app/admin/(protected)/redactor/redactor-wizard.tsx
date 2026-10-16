"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, PenLine, Plus, Search, Send, Sparkles, Trash2 } from "lucide-react";

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

const campo = "mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand";
const etiqueta = "block text-xs font-semibold text-muted-foreground";

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
  const nota: Nota | null = e ? { titulo: e.titulo, resumen: e.resumen, cuerpo: e.cuerpo, claves: e.claves, palabraClave: e.palabraClave, portadaUrl: e.portadaUrl, portadaAlt: e.portadaAlt, seoTitulo: e.seoTitulo, seoDescripcion: e.seoDescripcion } : null;
  const seo = React.useMemo(() => (nota ? puntajeSeo(nota) : null), [nota]);
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

  // ------------------------------------------------------------------ lista de notas
  if (!e) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => { setE(vacio("ia")); setPaso("tema"); setMsg(null); setAud(null); }} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"><Sparkles className="size-4" aria-hidden="true" />Nueva nota con IA</button>
          <button type="button" onClick={() => { setE(vacio("manual")); setPaso("tema"); setMsg(null); setAud(null); }} className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold"><PenLine className="size-4" aria-hidden="true" />Nueva nota manual</button>
        </div>
        {lista.estado === "cargando" && <p className="text-sm text-muted-foreground">Leyendo tus notas…</p>}
        {lista.estado === "error" && <p className="text-sm text-red-700">{lista.error}</p>}
        {lista.estado === "listo" && !lista.data.disponible && (
          <div className="rounded-xl bg-amber-500/10 p-3 text-sm">
            <p className="font-semibold">Para guardar las notas falta crear la tabla del redactor en Supabase (puedes escribir sin guardar).</p>
            {lista.data.sql && <textarea readOnly value={lista.data.sql} rows={6} className={`${campo} font-mono text-xs`} onFocus={(ev) => ev.currentTarget.select()} />}
          </div>
        )}
        {lista.estado === "listo" && lista.data.notas.length > 0 && (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {lista.data.notas.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <button type="button" onClick={() => { setE(desde(n)); setPaso(n.cuerpo ? "cuerpo" : "tema"); setMsg(null); setAud(null); }} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold">{n.titulo || "Sin título"}</span>
                  <span className="text-xs text-muted-foreground">{n.modo === "ia" ? "Con IA" : "Manual"} · {n.estado} · {new Date(n.actualizadoEn).toLocaleString("es-CO")}</span>
                </button>
                <button type="button" aria-label="Borrar la nota" onClick={() => window.confirm("¿Borrar esta nota?") && void api(`/api/admin/redactor?id=${n.id}`, { method: "DELETE" }).then(() => setV((x) => x + 1))} className="rounded-full border border-border p-2"><Trash2 className="size-4" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------ asistente
  const i = PASOS.findIndex((p) => p.id === paso);
  const nombres = e.modo === "ia" ? PASOS : PASOS.map((p) => (p.id === "tema" ? { ...p, etiqueta: "Título" } : p));
  const anterior = PASOS[i - 1]?.id;
  const siguiente = PASOS[i + 1];
  const numPal = palabras(e.cuerpo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setE(null)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">← Mis notas</button>
        <span className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold">{e.modo === "ia" ? "Modo IA" : "Modo manual"}</span>
        {e.generadaConIa && !e.revisada && <span className="rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">Generada con IA · sin revisar</span>}
      </div>

      <ol className="flex flex-wrap gap-1.5">
        {nombres.map((p, k) => (
          <li key={p.id}>
            <button type="button" onClick={() => setPaso(p.id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${p.id === paso ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`}>
              <span className={`grid size-4 place-items-center rounded-full text-[10px] ${k < i ? "bg-emerald-500 text-white" : "bg-black/10"}`}>{k < i ? <Check className="size-3" aria-hidden="true" /> : k + 1}</span>
              {p.etiqueta}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="min-w-0 rounded-2xl border border-border bg-surface p-5">
          {paso === "tema" && (
            <div className="space-y-4">
              {e.modo === "ia" ? (
                <>
                  <label className={etiqueta}>Tema de la nota<input className={campo} value={e.tema} onChange={(ev) => set({ tema: ev.target.value })} placeholder="p. ej. La alianza presenta su propuesta de seguridad rural" maxLength={400} /></label>
                  <label className={etiqueta}>Enfoque (opcional)<input className={campo} value={e.enfoque} onChange={(ev) => set({ enfoque: ev.target.value })} placeholder="qué ángulo quieres destacar" maxLength={400} /></label>
                  <label className={etiqueta}>Material: datos, citas, documentos. Es la única base de los hechos de la nota.
                    <textarea className={`${campo} min-h-48 font-mono text-xs`} value={e.material} onChange={(ev) => set({ material: ev.target.value })} placeholder="Pega aquí lo que sabes: cifras, fechas, nombres, declaraciones textuales…" />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={!!ocupado || e.tema.trim().length < 5} onClick={() => void dossier()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50">{ocupado === "dossier" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Search className="size-3.5" aria-hidden="true" />}Armar dossier con fuentes de la web</button>
                    <span className="text-xs text-muted-foreground">{e.material.length.toLocaleString("es-CO")} caracteres de material{e.fuentes.length ? ` · ${e.fuentes.length} fuentes` : ""}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className={etiqueta}>Tono<select className={campo} value={e.tono} onChange={(ev) => set({ tono: ev.target.value })}><option value="institucional">Institucional</option><option value="cercano">Cercano</option><option value="combativo">Combativo</option></select></label>
                    <label className={etiqueta}>Extensión (palabras)<select className={campo} value={e.palabras} onChange={(ev) => set({ palabras: Number(ev.target.value) })}>{[250, 450, 700, 1000].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
                    <label className={etiqueta}>Región<select className={campo} value={e.region} onChange={(ev) => set({ region: ev.target.value })}>{DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}</select></label>
                  </div>
                  <button type="button" disabled={!!ocupado || e.tema.trim().length < 5} onClick={() => void generar()} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50">{ocupado === "generar" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}Redactar borrador con IA</button>
                  <p className="text-xs text-muted-foreground">Sin material suficiente no se redacta. La IA solo usa lo que escribas arriba; las cifras y las citas del resultado se comprueban con el programa.</p>
                </>
              ) : (
                <label className={etiqueta}>Título<input className={campo} value={e.titulo} onChange={(ev) => set({ titulo: ev.target.value })} maxLength={160} /></label>
              )}
            </div>
          )}
          {paso === "resumen" && (
            <div className="space-y-3">
              <label className={etiqueta}>Título<input className={campo} value={e.titulo} onChange={(ev) => set({ titulo: ev.target.value })} maxLength={160} /></label>
              <label className={etiqueta}>Resumen (entradilla de la nota)<textarea className={`${campo} min-h-28`} value={e.resumen} onChange={(ev) => set({ resumen: ev.target.value })} maxLength={400} /></label>
              <p className="text-xs text-muted-foreground">{e.resumen.length} caracteres.</p>
            </div>
          )}
          {paso === "claves" && (
            <div className="space-y-3">
              <label className={etiqueta}>Palabra clave de enfoque<input className={campo} value={e.palabraClave} onChange={(ev) => set({ palabraClave: ev.target.value })} maxLength={80} /></label>
              <label className={etiqueta}>Etiquetas (separadas por coma)<input className={campo} value={e.claves.join(", ")} onChange={(ev) => set({ claves: ev.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12) })} /></label>
            </div>
          )}
          {paso === "portada" && (
            <div className="space-y-3">
              <label className={etiqueta}>Dirección (URL) de la imagen<input className={campo} value={e.portadaUrl} onChange={(ev) => set({ portadaUrl: ev.target.value })} placeholder="https://…" /></label>
              <label className={etiqueta}>Texto alternativo (describe la imagen)<input className={campo} value={e.portadaAlt} onChange={(ev) => set({ portadaAlt: ev.target.value })} maxLength={300} /></label>
              {e.portadaUrl && /^https:\/\//.test(e.portadaUrl) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.portadaUrl} alt={e.portadaAlt} className="max-h-56 rounded-xl object-cover" referrerPolicy="no-referrer" />}
            </div>
          )}
          {paso === "seccion" && (
            <div className="space-y-3">
              <label className={etiqueta}>Sección<select className={campo} value={e.seccion} onChange={(ev) => set({ seccion: ev.target.value })}><option value="">Elige una sección</option>{SECCIONES.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className={etiqueta}>Región o departamento<select className={campo} value={e.region} onChange={(ev) => set({ region: ev.target.value })}>{DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}</select></label>
              <p className="text-xs text-muted-foreground">La firma es de quien escribe: {`la persona que inició sesión`}.</p>
            </div>
          )}
          {paso === "cuerpo" && (
            <div className="space-y-3">
              <label className={etiqueta}>Cuerpo de la nota (subtítulos con «## », listas con «- », citas con «&gt; »)
                <textarea className={`${campo} min-h-[26rem] font-serif text-[15px] leading-relaxed`} value={e.cuerpo} onChange={(ev) => set({ cuerpo: ev.target.value, revisada: false })} />
              </label>
              <p className="text-xs text-muted-foreground">{numPal} palabras.</p>
              {auditoria && e.cuerpo && (
                <div className={`rounded-xl p-3 text-xs ${auditoria.sinRespaldo.length ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
                  <p className="flex items-center gap-1.5 font-semibold">{auditoria.sinRespaldo.length ? <AlertTriangle className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
                    {auditoria.sinRespaldo.length ? `${auditoria.sinRespaldo.length} cifras o citas no constan en el material: verifícalas o quítalas` : `Auditoría: ${auditoria.cifras} cifras y ${auditoria.citas} citas, todas respaldadas por el material`}</p>
                  {auditoria.sinRespaldo.length > 0 && <ul className="mt-1 list-disc pl-5">{auditoria.sinRespaldo.map((h, k) => <li key={k}><strong>{h.tipo === "cifra" ? "Cifra" : "Cita"}:</strong> {h.texto}</li>)}</ul>}
                </div>
              )}
            </div>
          )}
          {paso === "grafica" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Opcional. Solo con datos reales y su fuente.</p>
              {e.grafica ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className={etiqueta}>Título<input className={campo} value={e.grafica.titulo} onChange={(ev) => set({ grafica: { ...e.grafica!, titulo: ev.target.value } })} /></label>
                    <label className={etiqueta}>Fuente<input className={campo} value={e.grafica.fuente} onChange={(ev) => set({ grafica: { ...e.grafica!, fuente: ev.target.value } })} placeholder="entidad y año" /></label>
                    <label className={etiqueta}>Tipo<select className={campo} value={e.grafica.tipo} onChange={(ev) => set({ grafica: { ...e.grafica!, tipo: ev.target.value as Grafica["tipo"] } })}><option value="barras">Barras</option><option value="lineas">Líneas</option><option value="torta">Torta</option></select></label>
                  </div>
                  <label className={etiqueta}>Datos (una línea por dato: «Etiqueta: valor»)
                    <textarea className={`${campo} min-h-32 font-mono text-xs`} value={e.grafica.datos.map((d) => `${d.etiqueta}: ${d.valor}`).join("\n")} onChange={(ev) => set({ grafica: { ...e.grafica!, datos: ev.target.value.split("\n").map((l) => l.split(":")).filter((p) => p.length >= 2 && Number.isFinite(Number(p[p.length - 1]))).map((p) => ({ etiqueta: p.slice(0, -1).join(":").trim(), valor: Number(p[p.length - 1]) })) } })} />
                  </label>
                  <button type="button" onClick={() => set({ grafica: null })} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">Quitar la gráfica</button>
                </>
              ) : (
                <button type="button" onClick={() => set({ grafica: { tipo: "barras", titulo: "", fuente: "", datos: [] } })} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold"><Plus className="size-3.5" aria-hidden="true" />Agregar una gráfica</button>
              )}
            </div>
          )}
          {paso === "seo" && (
            <div className="space-y-3">
              {e.seoAlternativas.length > 0 && (
                <div className={etiqueta}>Alternativas de título para buscadores
                  <div className="mt-1.5 flex flex-col gap-1.5">{e.seoAlternativas.map((t) => <button key={t} type="button" onClick={() => set({ seoTitulo: t })} className={`rounded-xl border px-3 py-2 text-left text-sm font-normal ${e.seoTitulo === t ? "border-brand bg-brand-soft" : "border-border"}`}>{t}</button>)}</div>
                </div>
              )}
              <label className={etiqueta}>Título para buscadores ({(e.seoTitulo || e.titulo).length} caracteres)<input className={campo} value={e.seoTitulo} onChange={(ev) => set({ seoTitulo: ev.target.value })} maxLength={120} placeholder={e.titulo} /></label>
              <label className={etiqueta}>Descripción ({(e.seoDescripcion || e.resumen).length} caracteres)<textarea className={`${campo} min-h-24`} value={e.seoDescripcion} onChange={(ev) => set({ seoDescripcion: ev.target.value })} maxLength={300} placeholder={e.resumen} /></label>
            </div>
          )}
          {paso === "vista" && (
            <div className="space-y-4">
              <article className="mx-auto max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">{e.seccion || "Sin sección"}{e.region && e.region !== "Nacional" ? ` · ${e.region}` : ""}</p>
                <h2 className="mt-1 font-serif text-3xl font-bold leading-tight">{e.titulo || "Sin título"}</h2>
                {e.resumen && <p className="mt-2 text-lg text-muted-foreground">{e.resumen}</p>}
                {e.portadaUrl && /^https:\/\//.test(e.portadaUrl) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={e.portadaUrl} alt={e.portadaAlt} className="mt-4 w-full rounded-xl object-cover" referrerPolicy="no-referrer" />}
                <div className="prose-sm mt-4 space-y-3 text-[15px] leading-relaxed [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: aHtml(e.cuerpo) }} />
                {e.grafica && e.grafica.datos.length > 0 && (
                  <figure className="mt-4 rounded-xl border border-border p-3">
                    <figcaption className="text-sm font-semibold">{e.grafica.titulo || "Gráfica"}</figcaption>
                    {e.grafica.datos.map((d) => { const max = Math.max(...e.grafica!.datos.map((x) => x.valor), 1); return <div key={d.etiqueta} className="mt-1.5 text-xs"><div className="flex justify-between"><span>{d.etiqueta}</span><span className="tabular-nums">{d.valor.toLocaleString("es-CO")}</span></div><div className="h-2 rounded bg-surface-muted"><div className="h-2 rounded bg-brand" style={{ width: `${(Math.max(d.valor, 0) / max) * 100}%` }} /></div></div>; })}
                    <p className="mt-2 text-[11px] text-muted-foreground">Fuente: {e.grafica.fuente || "sin indicar"}</p>
                  </figure>
                )}
                {e.fuentes.length > 0 && <div className="mt-4 text-xs text-muted-foreground"><p className="font-semibold">Fuentes del dossier</p><ul className="list-disc pl-5">{e.fuentes.map((f) => <li key={f.url}><a className="underline" href={f.url} target="_blank" rel="noreferrer noopener">{f.titulo || f.url}</a></li>)}</ul></div>}
              </article>
              <div className="space-y-3 rounded-xl bg-surface-muted p-4 text-sm">
                {e.generadaConIa && (
                  <label className="flex items-start gap-2 text-xs font-semibold"><input type="checkbox" className="mt-0.5" checked={e.revisada} onChange={(ev) => set({ revisada: ev.target.checked })} />Lo revisé: leí la nota completa y verifiqué las cifras y las citas.</label>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={!!ocupado} onClick={() => void guardar("borrador")} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">Guardar borrador</button>
                  <button type="button" disabled={!!ocupado} onClick={() => void guardar("revision")} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">Enviar a revisión</button>
                  <select value={portalId} onChange={(ev) => setPortalId(ev.target.value)} className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold" aria-label="Portal">
                    <option value="">Enviar a un portal…</option>
                    {portales.estado === "listo" && portales.data.portales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <button type="button" disabled={!portalId || !!ocupado || (e.generadaConIa && !e.revisada)} onClick={() => void enviar()} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground disabled:opacity-50">{ocupado === "enviar" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Send className="size-3.5" aria-hidden="true" />}Enviar como borrador</button>
                </div>
                <p className="text-xs text-muted-foreground">El Redactor no publica: la nota llega al portal como borrador y una persona la publica allí.</p>
              </div>
            </div>
          )}

          {msg && <p role="status" className={`mt-4 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.texto}</p>}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
            <button type="button" disabled={!anterior} onClick={() => anterior && setPaso(anterior)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-40"><ArrowLeft className="size-3.5" aria-hidden="true" />Atrás</button>
            <div className="flex items-center gap-2">
              <button type="button" disabled={!!ocupado} onClick={() => void guardar()} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">{ocupado === "guardar" ? "Guardando…" : "Guardar"}</button>
              {siguiente && <button type="button" onClick={() => setPaso(siguiente.id)} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground">Siguiente · {siguiente.etiqueta}<ArrowRight className="size-3.5" aria-hidden="true" /></button>}
            </div>
          </div>
        </section>

        {seo && (
          <aside className="h-fit rounded-2xl border border-border bg-surface p-4 text-sm lg:sticky lg:top-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SEO en vivo</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{seo.puntos}<span className="text-base font-medium text-muted-foreground"> · {seo.nivel}</span></p>
            <div className="mt-3 space-y-2">
              {seo.grupos.map((g) => (
                <div key={g.grupo} className="text-xs">
                  <div className="flex justify-between"><span>{({ contenido: "Contenido útil y confiable", ficha: "Ficha en buscadores", imagen: "Imagen y Discover", lectura: "Lectura y estructura" } as const)[g.grupo]}</span><span className="tabular-nums">{g.pct}%</span></div>
                  <div className="mt-0.5 h-1.5 rounded bg-surface-muted"><div className="h-1.5 rounded bg-brand" style={{ width: `${g.pct}%` }} /></div>
                </div>
              ))}
            </div>
            <ul className="mt-4 space-y-1.5 text-xs">
              {[...seo.criterios].sort((a, b) => Number(a.ok) - Number(b.ok)).map((c) => (
                <li key={c.texto}>
                  <button type="button" onClick={() => setPaso(({ cuerpo: "cuerpo", seo: "seo", claves: "claves", portada: "portada" } as Record<string, PasoId>)[c.paso])} className="flex w-full items-start gap-1.5 text-left hover:underline">
                    <span className={`mt-0.5 shrink-0 font-bold ${c.ok ? "text-emerald-600" : "text-amber-600"}`}>{c.ok ? "✓" : "!"}</span>
                    <span className={c.ok ? "text-muted-foreground" : ""}>{c.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
