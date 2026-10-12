"use client";

import * as React from "react";
import { Check, CheckCircle2, Copy, Download, ExternalLink, FileText, Library, Loader2, Play, Search, Trash2, TriangleAlert, UploadCloud, X } from "lucide-react";

/**
 * Documentos: se sube un archivo (PDF, Word, texto...), el servidor saca su texto, lo divide en fragmentos, los vectoriza y los guarda
 * en Supabase para buscarlos por significado. Un archivo se sube por partes (Vercel no admite más de 4,5 MB por petición); la cola
 * sigue trabajando aunque se cambie de pestaña (la pantalla se queda montada), pero no si se cierra la página.
 */

type Documento = {
  id: string;
  titulo: string;
  archivo: string | null;
  tipo: string | null;
  bytes: number | null;
  paginas: number | null;
  caracteres: number | null;
  fragmentos: number;
  vectorizados: number;
  estado: "subiendo" | "procesando" | "listo" | "error";
  error: string | null;
  modelo: string | null;
  etiquetas: string[];
  creadoEn: string;
};
type Estado = {
  configurada: boolean;
  tabla: boolean;
  documentos: Documento[];
  sql?: string;
  editorSql?: string;
  error?: string;
  vectores?: { listo: boolean; proveedor?: string; modelo?: string; dimensiones?: number };
  limites?: { maxBytes: number; tamParte: number; extensiones: string[] };
};
type Avance = { fragmentos: number; vectorizados: number; pendientes: number; listo: boolean };
type Hallazgo = { documentoId: string; titulo: string; posicion: number; pagina: number | null; contenido: string; similitud: number };
type Fase = "espera" | "subiendo" | "procesando" | "vectorizando" | "listo" | "error";
type Item = { clave: string; archivo: File; titulo: string; etiquetas: string[]; fase: Fase; progreso: number; detalle: string; error?: string };

const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";
const numero = (n: number) => n.toLocaleString("es-CO");
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FORMATOS = ".pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.log";

function tamano(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function hace(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "ahora";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

async function pedir<T>(url: string, metodo: "GET" | "POST" | "PUT" | "DELETE", cuerpo?: unknown, bruto?: Blob): Promise<T> {
  const r = await fetch(url, {
    method: metodo,
    headers: bruto ? { "Content-Type": "application/octet-stream" } : cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: bruto ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
    cache: "no-store",
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error ?? (r.status === 504 ? "La operación tardó demasiado." : r.status === 413 ? "El archivo es demasiado grande." : `No fue posible completar la acción (${r.status}).`));
  return b as T;
}

const FASE_TEXTO: Record<Fase, string> = { espera: "En cola", subiendo: "Subiendo", procesando: "Extrayendo el texto", vectorizando: "Vectorizando", listo: "Listo", error: "Con error" };

export function DocumentosTab() {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [cola, setCola] = React.useState<Item[]>([]);
  const [etiquetas, setEtiquetas] = React.useState("");
  const [arrastrando, setArrastrando] = React.useState(false);
  const [copiado, setCopiado] = React.useState(false);
  const [vectorizando, setVectorizando] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [consulta, setConsulta] = React.useState("");
  const [buscando, setBuscando] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState<{ consulta: string; resultados: Hallazgo[]; avisos: string[] } | null>(null);
  const trabajando = React.useRef(false);
  const entrada = React.useRef<HTMLInputElement>(null);

  const recargar = React.useCallback(async () => {
    try {
      setEstado(await pedir<Estado>("/api/admin/documentos", "GET"));
    } catch (e) {
      setEstado({ configurada: true, tabla: false, documentos: [], error: e instanceof Error ? e.message : "No se pudo leer." });
    }
  }, []);
  React.useEffect(() => {
    let cancelado = false;
    pedir<Estado>("/api/admin/documentos", "GET")
      .catch((e): Estado => ({ configurada: true, tabla: false, documentos: [], error: e instanceof Error ? e.message : "No se pudo leer." }))
      .then((d) => { if (!cancelado) setEstado(d); });
    return () => { cancelado = true; };
  }, []);

  const cambiar = (clave: string, cambios: Partial<Item>) => setCola((c) => c.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)));

  /** Vectoriza un documento llamando una y otra vez hasta que termine (cada llamada cabe en una función de Vercel). */
  async function vectorizarHasta(id: string, alAvanzar: (a: Avance) => void) {
    let sinAvance = 0;
    let previo = -1;
    for (;;) {
      const a = await pedir<Avance>("/api/admin/documentos/vectorizar", "POST", { id });
      alAvanzar(a);
      if (a.listo) return;
      sinAvance = a.vectorizados > previo ? 0 : sinAvance + 1;
      previo = a.vectorizados;
      if (sinAvance >= 3) throw new Error("No se pudo seguir vectorizando: no hubo avance en tres intentos seguidos.");
    }
  }

  async function procesar(item: Item, tamParte: number) {
    const { clave, archivo } = item;
    try {
      cambiar(clave, { fase: "subiendo", progreso: 0, detalle: "Registrando…" });
      const { id } = await pedir<{ id: string }>("/api/admin/documentos", "POST", { titulo: item.titulo, archivo: archivo.name, bytes: archivo.size, etiquetas: item.etiquetas });
      const partes = Math.max(1, Math.ceil(archivo.size / tamParte));
      for (let n = 0; n < partes; n++) {
        const trozo = archivo.slice(n * tamParte, (n + 1) * tamParte);
        for (let intento = 1; ; intento++) {
          try {
            await pedir(`/api/admin/documentos/parte?id=${id}&n=${n}`, "PUT", undefined, trozo);
            break;
          } catch (e) {
            if (intento >= 3) throw e;
            await esperar(1500 * intento);
          }
        }
        cambiar(clave, { progreso: Math.round(((n + 1) / partes) * 100), detalle: `Parte ${n + 1} de ${partes}` });
      }
      cambiar(clave, { fase: "procesando", progreso: 100, detalle: "Sacando el texto y dividiéndolo en fragmentos…" });
      const { documento } = await pedir<{ documento: Documento }>("/api/admin/documentos/procesar", "POST", { id, partes });
      cambiar(clave, { fase: "vectorizando", progreso: 0, detalle: `${numero(documento.fragmentos)} fragmentos` });
      await recargar();
      await vectorizarHasta(id, (a) => cambiar(clave, { progreso: Math.round((a.vectorizados / Math.max(1, a.fragmentos)) * 100), detalle: `${numero(a.vectorizados)} de ${numero(a.fragmentos)} fragmentos` }));
      cambiar(clave, { fase: "listo", progreso: 100, detalle: `${numero(documento.fragmentos)} fragmentos guardados en Supabase` });
    } catch (e) {
      cambiar(clave, { fase: "error", error: e instanceof Error ? e.message : "No fue posible cargar el documento." });
    } finally {
      await recargar();
    }
  }

  /** Atiende la cola de a un archivo; si llegan más mientras trabaja, los toma también. */
  async function atender(nuevos: Item[]) {
    setCola((c) => [...c, ...nuevos]);
    if (trabajando.current) return;
    trabajando.current = true;
    try {
      const tamParte = estado?.limites?.tamParte ?? 3.5 * 1024 * 1024;
      const hechos = new Set<string>();
      let pendientes = nuevos;
      while (pendientes.length > 0) {
        for (const item of pendientes) {
          hechos.add(item.clave);
          await procesar(item, tamParte);
        }
        // Los que se agregaron durante el trabajo ya están en la cola: se leen de nuevo desde el estado.
        pendientes = await new Promise<Item[]>((resolver) => setCola((c) => { resolver(c.filter((i) => i.fase === "espera" && !hechos.has(i.clave))); return c; }));
      }
    } finally {
      trabajando.current = false;
    }
  }

  function agregar(archivos: FileList | File[]) {
    setAviso(null);
    const permitidas = (estado?.limites?.extensiones ?? []).map((e) => e.toLowerCase());
    const maximo = estado?.limites?.maxBytes ?? 40 * 1024 * 1024;
    const tags = etiquetas.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
    const validos: Item[] = [];
    const rechazados: string[] = [];
    for (const archivo of Array.from(archivos)) {
      const ext = archivo.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
      if (permitidas.length && !permitidas.includes(ext)) rechazados.push(`${archivo.name}: formato .${ext || "desconocido"} no admitido`);
      else if (archivo.size > maximo) rechazados.push(`${archivo.name}: pesa más de ${tamano(maximo)}`);
      else if (archivo.size === 0) rechazados.push(`${archivo.name}: está vacío`);
      else validos.push({ clave: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${archivo.name}`, archivo, titulo: archivo.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || archivo.name, etiquetas: tags, fase: "espera", progreso: 0, detalle: "En cola" });
    }
    if (rechazados.length) setAviso({ ok: false, texto: rechazados.join(" · ") });
    if (validos.length) void atender(validos);
  }

  async function continuar(d: Documento) {
    setAviso(null);
    setVectorizando(d.id);
    try {
      await vectorizarHasta(d.id, () => void 0);
      setAviso({ ok: true, texto: `«${d.titulo}» quedó vectorizado.` });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible vectorizar." });
    } finally {
      setVectorizando(null);
      await recargar();
    }
  }

  async function eliminar(d: Documento) {
    if (!window.confirm(`¿Eliminar «${d.titulo}»? Se borran sus fragmentos, sus vectores y el archivo guardado.`)) return;
    setAviso(null);
    try {
      await pedir(`/api/admin/documentos?id=${d.id}`, "DELETE");
      setAviso({ ok: true, texto: `«${d.titulo}» se eliminó.` });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible eliminar." });
    }
    await recargar();
  }

  async function descargar(d: Documento) {
    try {
      const { url } = await pedir<{ url: string }>(`/api/admin/documentos?descargar=${d.id}`, "GET");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible bajar el archivo." });
    }
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (consulta.trim().length < 2) return;
    setBuscando(true);
    setAviso(null);
    try {
      const r = await pedir<{ resultados: Hallazgo[]; avisos: string[] }>("/api/admin/documentos/buscar", "POST", { consulta: consulta.trim(), cantidad: 8 });
      setBusqueda({ consulta: consulta.trim(), ...r });
    } catch (err) {
      setAviso({ ok: false, texto: err instanceof Error ? err.message : "No fue posible buscar." });
    } finally {
      setBuscando(false);
    }
  }

  const documentos = estado?.documentos ?? [];
  const listos = documentos.filter((d) => d.estado === "listo").length;
  const fragmentosTotal = documentos.reduce((s, d) => s + d.vectorizados, 0);
  const enCola = cola.filter((i) => i.fase !== "listo" && i.fase !== "error").length;

  return (
    // `contain: inline-size`: el SQL y la tabla (con su desplazamiento propio) no deben ensanchar la página.
    <div className="space-y-5 [contain:inline-size]">
      <div className={`${tarjeta} p-5`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Library className="size-6" /></span>
          <div className="min-w-[min(100%,16rem)] flex-1">
            <h2 className="font-display text-lg font-semibold">Documentos</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Sube documentos (PDF, Word, texto, Markdown, CSV o HTML): el servidor saca su texto, lo divide en fragmentos, los vectoriza y los guarda en Supabase para buscarlos por significado, no solo por palabras. El archivo original también queda guardado.
            </p>
          </div>
          <button type="button" onClick={recargar} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border hover:bg-surface-muted">Actualizar</button>
        </div>
      </div>

      {!estado && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Consultando Supabase…</p>}
      {estado?.error && <p className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{estado.error}</p>}
      {estado && !estado.configurada && <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">Falta conectar Supabase: define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.</p>}

      {estado && estado.configurada && !estado.tabla && !estado.error && (
        <section className={`${tarjeta} space-y-3 border-amber-400/50 p-5`}>
          <h3 className="font-display text-lg font-semibold">Un paso para guardar los documentos</h3>
          <p className="text-sm text-muted-foreground">Hace falta crear las tablas en tu base de Supabase (una sola vez): copia este SQL y ejecútalo en el editor SQL. Activa pgvector (los vectores), crea las tablas de documentos y fragmentos y la función de búsqueda, y deja todo cerrado a la llave pública.</p>
          <pre className="max-h-56 overflow-auto rounded-xl bg-[#0f1613] p-4 text-xs leading-relaxed text-emerald-100">{estado.sql}</pre>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(estado.sql ?? ""); setCopiado(true); setTimeout(() => setCopiado(false), 1600); }} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">{copiado ? <Check className="size-4" /> : <Copy className="size-4" />}{copiado ? "Copiado" : "Copiar SQL"}</button>
            {estado.editorSql && <a href={estado.editorSql} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Abrir el editor SQL de Supabase <ExternalLink className="size-4" /></a>}
            <button type="button" onClick={recargar} className="ml-auto rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border hover:bg-surface-muted">Ya la ejecuté, comprobar</button>
          </div>
        </section>
      )}

      {estado?.tabla && (
        <>
          <section className={`${tarjeta} space-y-4 p-5`}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" /> Conectado: tablas listas</span>
              <span className="text-muted-foreground"><b className="text-foreground">{numero(documentos.length)}</b> documentos · <b className="text-foreground">{numero(listos)}</b> listos · <b className="text-foreground">{numero(fragmentosTotal)}</b> fragmentos vectorizados</span>
            </div>

            {estado.vectores?.listo ? (
              <p className="text-xs text-muted-foreground">Se vectoriza con <b className="text-foreground">{estado.vectores.proveedor === "gemini" ? "Gemini" : estado.vectores.proveedor === "openai" ? "OpenAI" : "vectores de prueba"}</b> ({estado.vectores.modelo}, {estado.vectores.dimensiones} dimensiones), con la clave de Configuración.</p>
            ) : (
              <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>Para vectorizar hace falta una clave de Gemini o de OpenAI (Claude no ofrece vectores). Agrégala en <a href="/admin/configuracion" className="font-semibold underline">Configuración</a>; mientras tanto puedes subir los archivos, pero no se vectorizarán.</span>
              </p>
            )}

            <div
              role="button"
              tabIndex={0}
              onClick={() => entrada.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") entrada.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files); }}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${arrastrando ? "border-brand bg-brand-soft/60" : "border-border hover:border-brand/60 hover:bg-surface-muted/50"}`}
            >
              <UploadCloud className="size-8 text-brand" aria-hidden="true" />
              <p className="text-sm font-semibold">Arrastra tus documentos aquí o haz clic para elegirlos</p>
              <p className="text-xs text-muted-foreground">PDF, Word (.docx), texto, Markdown, CSV o HTML · hasta {tamano(estado.limites?.maxBytes ?? null)} cada uno · los PDF deben tener texto (no escaneados)</p>
              <input ref={entrada} type="file" multiple accept={FORMATOS} className="sr-only" onChange={(e) => { if (e.target.files) agregar(e.target.files); e.target.value = ""; }} />
            </div>
            <label className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold">Etiquetas</span>
              <input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="opcional, separadas por coma: plan de gobierno, Bolívar" className="min-w-[min(100%,18rem)] flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-brand" />
            </label>

            {aviso && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${aviso.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"}`}>{aviso.texto}</p>}

            {cola.length > 0 && (
              <ul className="space-y-2">
                {cola.map((i) => (
                  <li key={i.clave} className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {i.fase === "listo" ? <CheckCircle2 className="size-4 text-emerald-600" /> : i.fase === "error" ? <TriangleAlert className="size-4 text-rose-600" /> : i.fase === "espera" ? <FileText className="size-4 text-muted-foreground" /> : <Loader2 className="size-4 animate-spin text-brand" />}
                      <span className="min-w-0 flex-1 truncate font-semibold">{i.titulo}</span>
                      <span className="text-xs text-muted-foreground">{tamano(i.archivo.size)} · {FASE_TEXTO[i.fase]}</span>
                      {(i.fase === "listo" || i.fase === "error") && <button type="button" aria-label="Quitar de la lista" onClick={() => setCola((c) => c.filter((x) => x.clave !== i.clave))} className="rounded-full p-1 text-muted-foreground hover:bg-surface-muted"><X className="size-3.5" /></button>}
                    </div>
                    {i.fase === "error" ? (
                      <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{i.error}</p>
                    ) : (
                      <>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${i.progreso}%` }} /></div>
                        <p className="mt-1 text-xs text-muted-foreground">{i.detalle}</p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {enCola > 0 && <p className="text-xs text-muted-foreground">Puedes cambiar de pestaña: la carga sigue mientras esta página esté abierta.</p>}
          </section>

          <section className={`${tarjeta} space-y-3 p-5`}>
            <h3 className="font-display text-lg font-semibold">Buscar por significado</h3>
            <form onSubmit={buscar} className="flex flex-wrap gap-2">
              <div className="relative min-w-[min(100%,18rem)] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Pregunta o tema, p. ej. «qué propone sobre seguridad rural»" className="w-full rounded-full border border-border bg-surface py-2 pr-4 pl-9 text-sm outline-none focus:border-brand" />
              </div>
              <button type="submit" disabled={buscando || consulta.trim().length < 2 || !estado.vectores?.listo || listos + documentos.filter((d) => d.vectorizados > 0).length === 0} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{buscando ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar</button>
            </form>
            {busqueda && (
              <div className="space-y-2">
                {busqueda.avisos.map((a) => <p key={a} className="rounded-xl bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">{a}</p>)}
                {busqueda.resultados.length === 0 && busqueda.avisos.length === 0 && <p className="text-sm text-muted-foreground">No se encontró nada parecido a «{busqueda.consulta}».</p>}
                <ol className="space-y-2">
                  {busqueda.resultados.map((h) => (
                    <li key={`${h.documentoId}-${h.posicion}`} className="rounded-xl border border-border p-3">
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{h.titulo}</span>
                        {h.pagina !== null && <span>· página {h.pagina}</span>}
                        <span>· fragmento {h.posicion + 1}</span>
                        <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">{Math.round(h.similitud * 100)} % de parecido</span>
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">{h.contenido}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          <section className={`${tarjeta} overflow-hidden`}>
            {documentos.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Todavía no hay documentos. Sube el primero arriba.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="border-b border-border bg-surface-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Documento</th>
                      <th className="px-3 py-3 font-semibold">Tipo</th>
                      <th className="px-3 py-3 font-semibold">Tamaño</th>
                      <th className="px-3 py-3 font-semibold">Páginas</th>
                      <th className="px-3 py-3 font-semibold">Fragmentos</th>
                      <th className="px-3 py-3 font-semibold">Estado</th>
                      <th className="px-3 py-3 font-semibold">Subido</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map((d) => {
                      const incompleto = d.estado === "procesando" || (d.estado === "error" && d.fragmentos > 0 && d.vectorizados < d.fragmentos);
                      return (
                        <tr key={d.id} className="border-b border-border/60 last:border-0 align-top">
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{d.titulo}</p>
                            {d.etiquetas.length > 0 && <p className="mt-0.5 flex flex-wrap gap-1">{d.etiquetas.map((t) => <span key={t} className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>)}</p>}
                            {d.error && d.estado !== "listo" && <p className="mt-0.5 max-w-md text-xs text-rose-700 dark:text-rose-300">{d.error}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground uppercase">{d.tipo ?? "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{tamano(d.bytes)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{d.paginas ?? "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{d.fragmentos > 0 ? `${numero(d.vectorizados)} / ${numero(d.fragmentos)}` : "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${d.estado === "listo" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : d.estado === "error" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-amber-500/15 text-amber-800 dark:text-amber-300"}`}>
                              {d.estado === "listo" ? "Listo" : d.estado === "error" ? "Con error" : d.estado === "subiendo" ? "Subiendo" : "Vectorizando"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{hace(d.creadoEn)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {incompleto && (
                                <button type="button" disabled={vectorizando === d.id} onClick={() => continuar(d)} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted disabled:opacity-50">
                                  {vectorizando === d.id ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Continuar
                                </button>
                              )}
                              {d.estado !== "subiendo" && d.fragmentos > 0 && <button type="button" aria-label={`Bajar el original de ${d.titulo}`} title="Bajar el archivo original" onClick={() => descargar(d)} className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-muted"><Download className="size-4" /></button>}
                              <button type="button" aria-label={`Eliminar ${d.titulo}`} title="Eliminar" onClick={() => eliminar(d)} className="rounded-full p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-700"><Trash2 className="size-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
