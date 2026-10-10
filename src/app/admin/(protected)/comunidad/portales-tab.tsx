"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Eye, History, Layers, Loader2, Monitor, Pause, Pencil, Play, Plus, Rocket, Settings2, Smartphone, Trash2, X } from "lucide-react";

import { PortalView } from "@/components/portales/portal-view";
import { COLORES_SUGERIDOS, PLANTILLAS, SECCIONES, configPorDefecto, plantillaPorId, slugPortal, type ConfigPortal, type PlantillaId } from "@/lib/portales/plantillas";
import type { EstadoPortal, Portal } from "@/lib/portales/store";

/**
 * Portales: generador (elige una plantilla y personalízala con vista previa en vivo), controlador (lista, estados, versiones y
 * registro) y desplegador (deja el portal en línea en /p/<enlace>). Las plantillas son de DEMOSTRACIÓN: contenido de ejemplo.
 */

type Datos = { configurada: boolean; tabla: boolean; portales: Portal[]; sql?: string; editorSql?: string; error?: string };
type Borrador = { id: string | null; plantilla: PlantillaId; slug: string; slugManual: boolean; config: ConfigPortal };
type Sub = "plantillas" | "generador" | "portales";

const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";
const campo = "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";
const ETIQUETA_ESTADO: Record<EstadoPortal, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-surface-muted text-muted-foreground" },
  publicado: { texto: "En línea", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  pausado: { texto: "En pausa", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
};
const EVENTO: Record<string, string> = { creado: "Creado", guardado: "Cambios guardados", desplegado: "Desplegado", pausado: "Puesto en pausa", reanudado: "Vuelto a poner en línea", duplicado: "Creado como copia" };

const nuevoBorrador = (plantilla: PlantillaId): Borrador => {
  const config = configPorDefecto(plantilla);
  return { id: null, plantilla, slug: slugPortal(config.nombre), slugManual: false, config };
};

function hace(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

async function pedir<T>(url: string, metodo: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(url, { method: metodo, headers: cuerpo ? { "Content-Type": "application/json" } : undefined, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error ?? "No fue posible completar la acción.");
  return b as T;
}

/* ------------------------------------------------------------ vista previa */

/** Un portal escalado a miniatura: solo se ve el principio (el hero) y no se puede pulsar. */
function Miniatura({ plantilla, config }: { plantilla: PlantillaId; config: ConfigPortal }) {
  return (
    <div aria-hidden className="pointer-events-none relative h-44 overflow-hidden rounded-xl border border-border bg-white">
      <div className="absolute top-0 left-0 w-[1180px] origin-top-left scale-[0.27]"><PortalView plantilla={plantilla} config={config} enlaces={false} idBase="mini" /></div>
    </div>
  );
}

function Selector({ valor, cambiar }: { valor: "escritorio" | "movil"; cambiar: (v: "escritorio" | "movil") => void }) {
  return (
    <div role="tablist" aria-label="Dispositivo" className="inline-flex rounded-full bg-surface p-1 ring-1 ring-border">
      {([["escritorio", "Escritorio", Monitor], ["movil", "Celular", Smartphone]] as const).map(([id, t, I]) => (
        <button key={id} type="button" role="tab" aria-selected={valor === id} onClick={() => cambiar(id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${valor === id ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}><I className="size-3.5" />{t}</button>
      ))}
    </div>
  );
}

function Marco({ plantilla, config, dispositivo, alto }: { plantilla: PlantillaId; config: ConfigPortal; dispositivo: "escritorio" | "movil"; alto: string }) {
  return (
    <div className={`overflow-auto rounded-2xl border border-border bg-[#e8ecea] p-3 ${alto}`}>
      <div className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg ${dispositivo === "movil" ? "w-[390px] max-w-full" : "w-full"}`}>
        <PortalView plantilla={plantilla} config={config} enlaces={false} idBase="vista" />
      </div>
    </div>
  );
}

function VistaCompleta({ plantilla, cerrar, usar }: { plantilla: PlantillaId; cerrar: () => void; usar: () => void }) {
  const [dispositivo, setDispositivo] = React.useState<"escritorio" | "movil">("escritorio");
  const p = plantillaPorId(plantilla)!;
  React.useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [cerrar]);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal aria-label={`Vista previa: ${p.nombre}`}>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-2xl bg-surface-muted shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3">
          <p className="font-semibold">Plantilla «{p.nombre}» <span className="font-normal text-muted-foreground">· demostración</span></p>
          <Selector valor={dispositivo} cambiar={setDispositivo} />
          <a href={`/p/demo/${plantilla}`} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Abrir en otra pestaña <ExternalLink className="size-4" /></a>
          <button type="button" onClick={usar} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:brightness-110"><Plus className="size-4" /> Usar esta plantilla</button>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full ring-1 ring-border hover:bg-surface-muted"><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
          <div className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg ${dispositivo === "movil" ? "w-[390px] max-w-full" : "w-full"}`}>
            <PortalView plantilla={plantilla} config={configPorDefecto(plantilla)} enlaces={false} idBase="completa" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- despliegue */

const PASOS = ["Validando la configuración", "Generando las páginas", "Publicando en la dirección del portal"];

function Despliegue({ nombre, slug, estado, portal, error, cerrar }: { nombre: string; slug: string; estado: number; portal: Portal | null; error: string; cerrar: () => void }) {
  const [copiado, setCopiado] = React.useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/p/${slug}` : `/p/${slug}`;
  const listo = !!portal && estado >= 3;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal aria-label="Despliegue del portal">
      <div className="w-full max-w-md rounded-3xl bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className={`grid size-11 place-items-center rounded-2xl ${error ? "bg-rose-500/15 text-rose-600" : listo ? "bg-emerald-500/15 text-emerald-600" : "bg-brand-soft text-brand"}`}>{error ? <X className="size-5" /> : listo ? <Check className="size-5" /> : <Rocket className="size-5" />}</span>
          <div><p className="font-display text-xl font-semibold">{error ? "No se pudo desplegar" : listo ? "Portal en línea" : "Desplegando…"}</p><p className="text-sm text-muted-foreground">{nombre}</p></div>
        </div>
        <ol className="mt-5 space-y-2.5">
          {PASOS.map((p, i) => {
            const hecho = estado > i;
            const activo = estado === i && !error;
            return (
              <li key={p} className="flex items-center gap-3 text-sm">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] ${hecho ? "bg-emerald-500 text-white" : activo ? "bg-brand text-brand-foreground" : "bg-surface-muted text-muted-foreground"}`}>{hecho ? <Check className="size-3.5" /> : activo ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}</span>
                <span className={hecho || activo ? "font-medium" : "text-muted-foreground"}>{p}</span>
              </li>
            );
          })}
        </ol>
        {error && <p className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        {listo && portal && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-surface-muted p-3"><code className="min-w-0 flex-1 truncate text-sm">{url}</code><button type="button" onClick={() => { navigator.clipboard?.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-surface">{copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copiado ? "Copiado" : "Copiar"}</button></div>
            <p className="text-xs text-muted-foreground">Versión {portal.version} · desplegada ahora. Es un portal de demostración: no aparece en buscadores.</p>
            <a href={`/p/${slug}`} target="_blank" rel="noreferrer noopener" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:brightness-110"><ExternalLink className="size-4" /> Abrir el portal</a>
          </div>
        )}
        {(listo || error) && <button type="button" onClick={cerrar} className="mt-3 w-full rounded-full px-5 py-2.5 text-sm font-semibold text-muted-foreground ring-1 ring-border hover:bg-surface-muted">{error ? "Cerrar" : "Listo"}</button>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- principal */

export function PortalesTab() {
  const [sub, setSub] = React.useState<Sub>("plantillas");
  const [datos, setDatos] = React.useState<Datos | null>(null);
  const [borrador, setBorrador] = React.useState<Borrador>(() => nuevoBorrador("salud"));
  const [dispositivo, setDispositivo] = React.useState<"escritorio" | "movil">("escritorio");
  const [mensaje, setMensaje] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [vista, setVista] = React.useState<PlantillaId | null>(null);
  const [desp, setDesp] = React.useState<{ nombre: string; slug: string; estado: number; portal: Portal | null; error: string } | null>(null);
  const [copiadoSql, setCopiadoSql] = React.useState(false);

  const cargar = React.useCallback(async () => {
    try { setDatos(await pedir<Datos>("/api/admin/portales", "GET")); } catch (e) { setDatos({ configurada: true, tabla: false, portales: [], error: e instanceof Error ? e.message : "No se pudo leer." }); }
  }, []);
  React.useEffect(() => {
    let cancelado = false;
    pedir<Datos>("/api/admin/portales", "GET")
      .catch((e): Datos => ({ configurada: true, tabla: false, portales: [], error: e instanceof Error ? e.message : "No se pudo leer." }))
      .then((d) => { if (!cancelado) setDatos(d); });
    return () => { cancelado = true; };
  }, []);

  const cfg = borrador.config;
  const plantilla = plantillaPorId(borrador.plantilla)!;
  const set = <K extends keyof ConfigPortal>(k: K, v: ConfigPortal[K]) => setBorrador((b) => ({ ...b, config: { ...b.config, [k]: v } }));
  const slugValido = /^[a-z0-9-]{3,40}$/.test(borrador.slug);
  const puede = !!datos?.tabla && !ocupado && cfg.nombre.trim().length >= 2 && slugValido && cfg.titulo.trim().length >= 3 && cfg.eslogan.trim().length >= 3 && cfg.cta.trim().length >= 2;

  function usarPlantilla(id: PlantillaId) {
    setBorrador(nuevoBorrador(id));
    setMensaje(null);
    setVista(null);
    setSub("generador");
  }

  /** Al cambiar de plantilla se cambian también los textos de ejemplo, pero no lo que la persona ya escribió. */
  function cambiarPlantilla(id: PlantillaId) {
    setBorrador((b) => {
      const antes = plantillaPorId(b.plantilla)!;
      const nueva = plantillaPorId(id)!;
      const c = b.config;
      const config: ConfigPortal = {
        ...c,
        nombre: c.nombre === antes.nombreEjemplo ? nueva.nombreEjemplo : c.nombre,
        titulo: c.titulo === antes.hero.titulo ? nueva.hero.titulo : c.titulo,
        eslogan: c.eslogan === antes.hero.subtitulo ? nueva.hero.subtitulo : c.eslogan,
        cta: c.cta === antes.hero.cta ? nueva.hero.cta : c.cta,
        colorPrimario: c.colorPrimario === antes.colorPrimario ? nueva.colorPrimario : c.colorPrimario,
      };
      return { ...b, plantilla: id, config, slug: b.slugManual || b.id ? b.slug : slugPortal(config.nombre) };
    });
  }

  function editar(p: Portal) {
    setBorrador({ id: p.id, plantilla: p.plantilla, slug: p.slug, slugManual: true, config: p.config });
    setMensaje(null);
    setSub("generador");
  }

  async function guardar(): Promise<Portal | null> {
    setOcupado(true);
    setMensaje(null);
    try {
      const cuerpo = { nombre: cfg.nombre.trim(), slug: borrador.slug, config: { ...cfg, nombre: cfg.nombre.trim() } };
      const r = borrador.id
        ? await pedir<{ portal: Portal }>(`/api/admin/portales/${borrador.id}`, "PATCH", { accion: "guardar", ...cuerpo })
        : await pedir<{ portal: Portal }>("/api/admin/portales", "POST", { ...cuerpo, plantilla: borrador.plantilla });
      setBorrador((b) => ({ ...b, id: r.portal.id, slug: r.portal.slug }));
      await cargar();
      return r.portal;
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : "No se pudo guardar." });
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function guardarBorrador() {
    const p = await guardar();
    if (p) setMensaje({ ok: true, texto: "Borrador guardado. Lo encuentras en «Mis portales»." });
  }

  /** Despliega un portal (guardándolo antes si viene del generador); muestra los pasos mientras se hace de verdad: validar, guardar y publicar. */
  async function desplegar(id: string | null, nombre: string, slug: string, guardarAntes: boolean) {
    const base = { nombre, slug };
    setDesp({ ...base, estado: 0, portal: null, error: "" });
    const minimo = new Promise((r) => setTimeout(r, 1800));
    const avance = setInterval(() => setDesp((d) => (d && d.estado < 2 && !d.error ? { ...d, estado: d.estado + 1 } : d)), 600);
    try {
      let idFinal = id;
      if (guardarAntes) {
        const p = await guardar();
        if (!p) throw new Error("Revisa los datos del portal antes de desplegarlo.");
        idFinal = p.id;
      }
      if (!idFinal) throw new Error("Guarda el portal antes de desplegarlo.");
      const [r] = await Promise.all([pedir<{ portal: Portal }>(`/api/admin/portales/${idFinal}`, "PATCH", { accion: "desplegar" }), minimo]);
      clearInterval(avance);
      setDesp({ ...base, slug: r.portal.slug, estado: 3, portal: r.portal, error: "" });
      await cargar();
    } catch (e) {
      clearInterval(avance);
      setDesp({ ...base, estado: 0, portal: null, error: e instanceof Error ? e.message : "No se pudo desplegar." });
    }
  }

  async function accion(p: Portal, a: "pausar" | "reanudar" | "duplicar") {
    setOcupado(true);
    try {
      await pedir(`/api/admin/portales/${p.id}`, "PATCH", { accion: a });
      await cargar();
      setMensaje({ ok: true, texto: a === "duplicar" ? "Portal duplicado como borrador." : a === "pausar" ? "Portal en pausa: quien entre verá un aviso." : "Portal otra vez en línea." });
    } catch (e) {
      setMensaje({ ok: false, texto: e instanceof Error ? e.message : "No se pudo completar la acción." });
    } finally {
      setOcupado(false);
    }
  }

  async function eliminar(p: Portal) {
    if (!window.confirm(`¿Eliminar «${p.nombre}»? Dejará de estar en línea y no se puede deshacer.`)) return;
    setOcupado(true);
    try { await pedir(`/api/admin/portales/${p.id}`, "DELETE"); await cargar(); if (borrador.id === p.id) setBorrador(nuevoBorrador("salud")); }
    catch (e) { setMensaje({ ok: false, texto: e instanceof Error ? e.message : "No se pudo eliminar." }); }
    finally { setOcupado(false); }
  }

  const portales = datos?.portales ?? [];
  const cuenta = (e: EstadoPortal) => portales.filter((p) => p.estado === e).length;
  const subs: { id: Sub; texto: string; icono: typeof Layers; n?: number }[] = [
    { id: "plantillas", texto: "Plantillas", icono: Layers, n: PLANTILLAS.length },
    { id: "generador", texto: "Generador", icono: Settings2 },
    { id: "portales", texto: "Mis portales", icono: Rocket, n: portales.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Portales" className="inline-flex rounded-full bg-surface p-1 shadow-sm ring-1 ring-border">
          {subs.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={sub === s.id} onClick={() => setSub(s.id)} className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${sub === s.id ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <s.icono className="size-4" />{s.texto}{s.n !== undefined && <span className={`rounded-full px-1.5 text-[11px] ${sub === s.id ? "bg-white/20" : "bg-surface-muted"}`}>{s.n}</span>}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Genera, controla y despliega portales de salud, belleza, motos y carros, y cuidado en el hogar. Plantillas de demostración con contenido de ejemplo.</p>
      </div>

      {datos && !datos.configurada && <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">Falta conectar Supabase: define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel.</p>}
      {datos?.error && <p className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{datos.error}</p>}
      {datos && datos.configurada && !datos.tabla && !datos.error && (
        <section className={`${tarjeta} space-y-3 border-amber-400/50 p-5`}>
          <h2 className="font-display text-lg font-semibold">Un paso para guardar y desplegar portales</h2>
          <p className="text-sm text-muted-foreground">Las plantillas y la vista previa ya funcionan. Para guardar portales y desplegarlos hace falta crear la tabla <code className="rounded bg-surface-muted px-1.5 py-0.5">portales</code> en tu base de Supabase (una sola vez): copia este SQL y ejecútalo en el editor SQL.</p>
          <pre className="max-h-56 overflow-auto rounded-xl bg-[#0f1613] p-4 text-xs leading-relaxed text-emerald-100">{datos.sql}</pre>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(datos.sql ?? ""); setCopiadoSql(true); setTimeout(() => setCopiadoSql(false), 1600); }} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">{copiadoSql ? <Check className="size-4" /> : <Copy className="size-4" />}{copiadoSql ? "Copiado" : "Copiar SQL"}</button>
            {datos.editorSql && <a href={datos.editorSql} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Abrir el editor SQL de Supabase <ExternalLink className="size-4" /></a>}
            <button type="button" onClick={cargar} className="ml-auto rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border hover:bg-surface-muted">Ya la ejecuté, comprobar</button>
          </div>
        </section>
      )}
      {mensaje && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${mensaje.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"}`}>{mensaje.texto}</p>}

      {/* ------------------------------------------------------- plantillas */}
      {sub === "plantillas" && (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {PLANTILLAS.map((p) => (
            <article key={p.id} className={`${tarjeta} flex flex-col gap-4 p-4`}>
              <Miniatura plantilla={p.id} config={configPorDefecto(p.id)} />
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: p.colorPrimario }} /><h3 className="font-display text-lg font-semibold">{p.nombre}</h3></div>
                <p className="mt-1 text-sm text-muted-foreground">{p.descripcion}</p>
                <p className="mt-2 text-xs text-muted-foreground">Incluye: hero, {p.servicios.items.length} servicios, paso a paso, directorio, testimonios, preguntas y contacto.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setVista(p.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border hover:bg-surface-muted"><Eye className="size-4" /> Ver demo</button>
                <button type="button" onClick={() => usarPlantilla(p.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:brightness-110"><Plus className="size-4" /> Usar</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* -------------------------------------------------------- generador */}
      {sub === "generador" && (
        <div className="grid gap-5 xl:grid-cols-[26rem_minmax(0,1fr)]">
          <form onSubmit={(e) => e.preventDefault()} className={`${tarjeta} space-y-5 p-5 xl:max-h-[calc(100dvh-11rem)] xl:overflow-y-auto`}>
            <div>
              <h2 className="font-display text-lg font-semibold">{borrador.id ? "Editar portal" : "Nuevo portal"}</h2>
              <p className="text-xs text-muted-foreground">Los cambios se ven al instante en la vista previa.</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Plantilla</legend>
              <div className="grid grid-cols-2 gap-2">
                {PLANTILLAS.map((p) => (
                  <button key={p.id} type="button" onClick={() => cambiarPlantilla(p.id)} aria-pressed={borrador.plantilla === p.id} disabled={!!borrador.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition disabled:opacity-60 ${borrador.plantilla === p.id ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-surface-muted"}`}><span className="size-3 shrink-0 rounded-full" style={{ background: p.colorPrimario }} />{p.nombre}</button>
                ))}
              </div>
              {borrador.id && <p className="mt-1.5 text-xs text-muted-foreground">La plantilla no se cambia en un portal ya guardado: duplícalo o crea uno nuevo.</p>}
            </fieldset>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Nombre del portal</span>
              <input className={campo} value={cfg.nombre} maxLength={80} onChange={(e) => { set("nombre", e.target.value); if (!borrador.slugManual && !borrador.id) setBorrador((b) => ({ ...b, slug: slugPortal(e.target.value) })); }} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Dirección en línea</span>
              <span className={`flex items-center overflow-hidden rounded-xl border bg-surface text-sm focus-within:border-brand ${slugValido || !borrador.slug ? "border-border" : "border-rose-400"}`}>
                <span className="bg-surface-muted px-3 py-2.5 text-muted-foreground">/p/</span>
                <input className="min-w-0 flex-1 bg-transparent px-2 py-2.5 outline-none" value={borrador.slug} maxLength={40} onChange={(e) => setBorrador((b) => ({ ...b, slug: slugPortal(e.target.value), slugManual: true }))} />
              </span>
              {!slugValido && <span className="mt-1 block text-xs text-rose-600">Usa de 3 a 40 letras minúsculas, números o guiones.</span>}</label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Ciudad</span><input className={campo} value={cfg.ciudad} maxLength={60} onChange={(e) => set("ciudad", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Título principal</span><input className={campo} value={cfg.titulo} maxLength={120} onChange={(e) => set("titulo", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Descripción</span><textarea className={`${campo} resize-none`} rows={3} value={cfg.eslogan} maxLength={260} onChange={(e) => set("eslogan", e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Texto del botón principal</span><input className={campo} value={cfg.cta} maxLength={40} onChange={(e) => set("cta", e.target.value)} /></label>
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Color principal</span>
              <div className="flex flex-wrap items-center gap-2">
                {COLORES_SUGERIDOS.map((c) => <button key={c} type="button" onClick={() => set("colorPrimario", c)} aria-label={`Color ${c}`} aria-pressed={cfg.colorPrimario === c} className={`size-8 rounded-full ring-offset-2 ring-offset-surface transition ${cfg.colorPrimario === c ? "ring-2 ring-foreground" : "hover:scale-110"}`} style={{ background: c }} />)}
                <input type="color" value={cfg.colorPrimario} onChange={(e) => set("colorPrimario", e.target.value)} aria-label="Elegir otro color" className="size-8 cursor-pointer rounded-full border border-border bg-transparent p-0" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">WhatsApp (opcional)</span><input className={campo} inputMode="numeric" placeholder="573001234567" value={cfg.whatsapp} maxLength={15} onChange={(e) => set("whatsapp", e.target.value.replace(/\D/g, ""))} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">Correo (opcional)</span><input className={campo} type="email" placeholder="hola@tuportal.co" value={cfg.correo} maxLength={120} onChange={(e) => set("correo", e.target.value)} /></label>
            </div>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Secciones</legend>
              <div className="flex flex-wrap gap-2">
                {SECCIONES.map((s) => <button key={s.id} type="button" aria-pressed={cfg.secciones[s.id]} onClick={() => set("secciones", { ...cfg.secciones, [s.id]: !cfg.secciones[s.id] })} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${cfg.secciones[s.id] ? "bg-brand text-brand-foreground" : "text-muted-foreground ring-1 ring-border"}`}>{cfg.secciones[s.id] && <Check className="size-3" />}{s.texto}</button>)}
              </div>
            </fieldset>
            <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap gap-2 border-t border-border bg-surface/95 px-5 py-4 backdrop-blur">
              <button type="button" onClick={guardarBorrador} disabled={!puede} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ring-1 ring-border hover:bg-surface-muted disabled:opacity-50">{ocupado ? <Loader2 className="size-4 animate-spin" /> : null} Guardar borrador</button>
              <button type="button" onClick={() => desplegar(borrador.id, cfg.nombre, borrador.slug, true)} disabled={!puede} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:brightness-110 disabled:opacity-50"><Rocket className="size-4" /> Desplegar</button>
              {!datos?.tabla && <p className="w-full text-xs text-muted-foreground">Para guardar y desplegar hay que crear primero la tabla (arriba).</p>}
            </div>
          </form>

          <section className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-lg font-semibold">Vista previa · {plantilla.nombre}</h2>
              <Selector valor={dispositivo} cambiar={setDispositivo} />
              {borrador.id && <a href={`/p/${borrador.slug}`} target="_blank" rel="noreferrer noopener" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">/p/{borrador.slug} <ExternalLink className="size-4" /></a>}
            </div>
            <Marco plantilla={borrador.plantilla} config={cfg} dispositivo={dispositivo} alto="h-[calc(100dvh-13rem)] min-h-[32rem]" />
          </section>
        </div>
      )}

      {/* ------------------------------------------------------ controlador */}
      {sub === "portales" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Portales", portales.length], ["En línea", cuenta("publicado")], ["Borradores", cuenta("borrador")], ["En pausa", cuenta("pausado")]].map(([t, n]) => (
              <div key={t} className={`${tarjeta} p-4`}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t}</p><p className="mt-1 font-display text-3xl font-semibold tabular-nums">{n}</p></div>
            ))}
          </div>
          {portales.length === 0 ? (
            <div className={`${tarjeta} grid place-items-center gap-3 p-14 text-center`}>
              <Rocket className="size-9 text-muted-foreground" />
              <p className="font-semibold">Todavía no has generado ningún portal</p>
              <p className="max-w-sm text-sm text-muted-foreground">Elige una plantilla, personalízala y despliégala: quedará en línea en una dirección propia.</p>
              <button type="button" onClick={() => setSub("plantillas")} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground">Ver las plantillas</button>
            </div>
          ) : (
            <ul className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {portales.map((p) => {
                const e = ETIQUETA_ESTADO[p.estado];
                const pl = plantillaPorId(p.plantilla)!;
                return (
                  <li key={p.id} className={`${tarjeta} flex flex-col gap-4 p-5`}>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: p.config.colorPrimario }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg leading-tight font-semibold">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">{pl.nombre} · {p.config.ciudad || "sin ciudad"} · actualizado {hace(p.actualizadoEn)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${e.clase}`}>{e.texto}{p.version > 0 ? ` · v${p.version}` : ""}</span>
                    </div>
                    <p className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-sm"><code className="min-w-0 flex-1 truncate">/p/{p.slug}</code>{p.estado === "publicado" && <a href={`/p/${p.slug}`} target="_blank" rel="noreferrer noopener" aria-label="Abrir el portal" className="text-brand"><ExternalLink className="size-4" /></a>}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => editar(p)} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted"><Pencil className="size-3.5" /> Editar</button>
                      <button type="button" onClick={() => desplegar(p.id, p.nombre, p.slug, false)} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground hover:brightness-110 disabled:opacity-50"><Rocket className="size-3.5" /> {p.version > 0 ? "Volver a desplegar" : "Desplegar"}</button>
                      {p.estado === "publicado" && <button type="button" onClick={() => accion(p, "pausar")} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted"><Pause className="size-3.5" /> Pausar</button>}
                      {p.estado === "pausado" && <button type="button" onClick={() => accion(p, "reanudar")} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted"><Play className="size-3.5" /> Reanudar</button>}
                      <button type="button" onClick={() => accion(p, "duplicar")} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted"><Copy className="size-3.5" /> Duplicar</button>
                      <button type="button" onClick={() => eliminar(p)} disabled={ocupado} aria-label={`Eliminar ${p.nombre}`} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-500/30 hover:bg-rose-500/10"><Trash2 className="size-3.5" /></button>
                    </div>
                    <details className="group text-sm">
                      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden"><History className="size-3.5" /> Registro de despliegues ({p.eventos.length})</summary>
                      <ol className="mt-2 space-y-1.5 border-l border-border pl-4">
                        {[...p.eventos].reverse().slice(0, 8).map((ev, i) => <li key={i} className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{EVENTO[ev.tipo] ?? ev.tipo}{ev.version ? ` · v${ev.version}` : ""}</span> · {hace(ev.en)}</li>)}
                      </ol>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {vista && <VistaCompleta plantilla={vista} cerrar={() => setVista(null)} usar={() => usarPlantilla(vista)} />}
      {desp && <Despliegue nombre={desp.nombre} slug={desp.slug} estado={desp.estado} portal={desp.portal} error={desp.error} cerrar={() => { setDesp(null); if (desp.portal) setSub("portales"); }} />}
    </div>
  );
}
