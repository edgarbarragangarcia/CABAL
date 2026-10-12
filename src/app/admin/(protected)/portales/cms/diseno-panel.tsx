"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Loader2, Monitor, MousePointerClick, Redo2, Rocket, Smartphone, Tablet, Undo2 } from "lucide-react";

import {
  CONTROLES, FUENTES, FUENTES_IDS, REGIONES, SECCIONES_INICIO,
  type ControlRegion, type DisenoPortal, type EstiloNota, type EstiloRegion, type FuenteId, type RegionId, type SeccionId,
} from "@/lib/portales/diseno/tipos";
import type { Portal } from "@/lib/portales/store";
import { botonPrimario, botonSecundario, campo, etiquetaCampo, hace, mensajeDe, pedir, tarjeta } from "./comun";

/**
 * Diseño del sitio de un portal: todo lo que se ve se cambia aquí sin tocar código y sin desplegar. Los cambios se guardan solos
 * como borrador y se ven en la página real (vista previa con el borrador aplicado); «Publicar» los pone en línea y se pueden
 * deshacer. Hacer clic en una parte de la página elige esa región en el editor.
 */

type Datos = {
  publicado: DisenoPortal;
  borrador: DisenoPortal | null;
  hayAnterior: boolean;
  publicadoEn: string | null;
  portal: { slug: string; nombre: string; plantilla: string; colorPrimario: string };
  menu: { id: string; texto: string }[];
  articulos: { id: string; titulo: string; categoria: string }[];
  secciones: { servicios: boolean; pasos: boolean; preguntas: boolean; articulos: boolean; eventos: boolean };
};

const PAGINAS = [
  { ruta: "", texto: "Inicio" },
  { ruta: "/articulos", texto: "Artículos" },
  { ruta: "/eventos", texto: "Eventos" },
];
const DISPOSITIVOS = [
  { id: "movil", texto: "Celular", ancho: 390, icono: Smartphone },
  { id: "tableta", texto: "Tableta", ancho: 820, icono: Tablet },
  { id: "escritorio", texto: "Escritorio", ancho: 0, icono: Monitor },
] as const;

const clonar = (d: DisenoPortal): DisenoPortal => JSON.parse(JSON.stringify(d)) as DisenoPortal;
const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ----------------------------------------------------------- controles ---- */

function CampoColor({ etiqueta, valor, onCambio }: { etiqueta: string; valor?: string; onCambio: (v: string | undefined) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-semibold text-muted-foreground">{etiqueta}</span>
      <span className="flex items-center gap-1.5">
        <input type="color" aria-label={etiqueta} value={valor ?? "#888888"} onChange={(e) => onCambio(e.target.value)} className={`h-8 w-10 cursor-pointer rounded border border-border bg-transparent ${valor ? "" : "opacity-40"}`} />
        <button type="button" disabled={!valor} onClick={() => onCambio(undefined)} className="rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-border disabled:opacity-40">{valor ? "Quitar" : "Plantilla"}</button>
      </span>
    </div>
  );
}

function Rango({ etiqueta, valor, min, max, paso = 1, unidad = "", defecto, onCambio }: { etiqueta: string; valor?: number | null; min: number; max: number; paso?: number; unidad?: string; defecto: number; onCambio: (v: number | undefined) => void }) {
  const v = valor ?? defecto;
  return (
    <label className="block text-xs">
      <span className="mb-1 flex items-center justify-between font-semibold text-muted-foreground">
        {etiqueta}
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-foreground">{valor === null || valor === undefined ? "plantilla" : `${v}${unidad}`}</span>
          {valor !== null && valor !== undefined && <button type="button" onClick={() => onCambio(undefined)} className="rounded-full px-2 py-0.5 text-[11px] ring-1 ring-border">Quitar</button>}
        </span>
      </span>
      <input type="range" min={min} max={max} step={paso} value={v} onChange={(e) => onCambio(Number(e.target.value))} className="w-full accent-[var(--brand,#0f766e)]" />
    </label>
  );
}

function Selector<T extends string>({ etiqueta, valor, opciones, onCambio }: { etiqueta: string; valor: T; opciones: { id: T; texto: string }[]; onCambio: (v: T) => void }) {
  return (
    <label className="block text-xs">
      <span className={etiquetaCampo}>{etiqueta}</span>
      <select value={valor} onChange={(e) => onCambio(e.target.value as T)} className={campo}>{opciones.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}</select>
    </label>
  );
}

function Interruptor({ etiqueta, valor, onCambio, ayuda }: { etiqueta: string; valor: boolean; onCambio: (v: boolean) => void; ayuda?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-xs">
      <input type="checkbox" checked={valor} onChange={(e) => onCambio(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand,#0f766e)]" />
      <span><span className="font-semibold">{etiqueta}</span>{ayuda && <span className="block text-muted-foreground">{ayuda}</span>}</span>
    </label>
  );
}

function Grupo({ titulo, descripcion, abierto, alAbrir, children }: { titulo: string; descripcion?: string; abierto: boolean; alAbrir: (abierto: boolean) => void; children: React.ReactNode }) {
  return (
    <details open={abierto} onToggle={(e) => alAbrir((e.currentTarget as HTMLDetailsElement).open)} className="group rounded-2xl border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span><span className="block text-sm font-semibold">{titulo}</span>{descripcion && <span className="block text-[11px] text-muted-foreground">{descripcion}</span>}</span>
        <span aria-hidden="true" className="text-muted-foreground transition group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-3.5 border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}

const opcionesFuente = FUENTES_IDS.map((id) => ({ id, texto: FUENTES[id].nombre }));

/* --------------------------------------------------------------- panel ---- */

export function DisenoPanel({ portal }: { portal: Portal }) {
  const [datos, setDatos] = React.useState<Datos | null>(null);
  const [error, setError] = React.useState("");
  const [d, setD] = React.useState<DisenoPortal | null>(null);
  const [pasado, setPasado] = React.useState<DisenoPortal[]>([]);
  const [futuro, setFuturo] = React.useState<DisenoPortal[]>([]);
  const [guardando, setGuardando] = React.useState<"" | "guardando" | "guardado" | "error">("");
  const [ocupado, setOcupado] = React.useState(false);
  const [mensaje, setMensaje] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [abiertos, setAbiertos] = React.useState<Record<string, boolean>>({ apariencia: true });
  const [region, setRegion] = React.useState<RegionId>("hero");
  const [notaId, setNotaId] = React.useState("");
  const [pagina, setPagina] = React.useState("");
  const [dispositivo, setDispositivo] = React.useState<(typeof DISPOSITIVOS)[number]["id"]>("escritorio");
  const [seleccionar, setSeleccionar] = React.useState(true);
  const [version, setVersion] = React.useState(0);
  const marco = React.useRef<HTMLIFrameElement>(null);
  const ultimoEnviado = React.useRef("");

  // Carga inicial (y deja la cookie de la vista previa).
  React.useEffect(() => {
    let cancelado = false;
    pedir<Datos>(`/api/admin/portales/${portal.id}/diseno`, "GET")
      .then((r) => {
        if (cancelado) return;
        setDatos(r);
        const inicial = clonar(r.borrador ?? r.publicado);
        ultimoEnviado.current = JSON.stringify(inicial);
        setD(inicial);
      })
      .catch((e) => !cancelado && setError(mensajeDe(e, "No se pudo abrir el diseño del portal.")));
    return () => { cancelado = true; };
  }, [portal.id]);

  // Autoguardado del borrador (con una pausa: no se guarda en cada tecla).
  React.useEffect(() => {
    if (!d) return;
    const texto = JSON.stringify(d);
    if (texto === ultimoEnviado.current) return;
    const t = setTimeout(async () => {
      setGuardando("guardando");
      try {
        await pedir(`/api/admin/portales/${portal.id}/diseno`, "PUT", { diseno: d });
        ultimoEnviado.current = texto;
        setGuardando("guardado");
        setVersion((n) => n + 1); // recarga la vista previa con el borrador
      } catch {
        setGuardando("error");
      }
    }, 900);
    return () => clearTimeout(t);
  }, [d, portal.id]);

  // Clic en la página → elegir la región (o la nota) en el editor.
  React.useEffect(() => {
    const alMensaje = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || !ev.data || typeof ev.data !== "object") return;
      if (ev.data.tipo === "portal-region" && REGIONES.some((r) => r.id === ev.data.region)) {
        setRegion(ev.data.region as RegionId);
        setAbiertos((a) => ({ ...a, regiones: true, ...(typeof ev.data.nota === "string" ? { notas: true } : {}) }));
        if (typeof ev.data.nota === "string") setNotaId(ev.data.nota);
      }
      if (ev.data.tipo === "portal-listo") marco.current?.contentWindow?.postMessage({ tipo: "portal-modo", seleccionar }, window.location.origin);
    };
    window.addEventListener("message", alMensaje);
    return () => window.removeEventListener("message", alMensaje);
  }, [seleccionar]);

  React.useEffect(() => {
    marco.current?.contentWindow?.postMessage({ tipo: "portal-modo", seleccionar }, window.location.origin);
  }, [seleccionar]);

  const cambiar = React.useCallback((f: (n: DisenoPortal) => void) => {
    setD((prev) => {
      if (!prev) return prev;
      const n = clonar(prev);
      f(n);
      if (igual(n, prev)) return prev;
      setPasado((p) => [...p.slice(-49), prev]);
      setFuturo([]);
      return n;
    });
  }, []);

  const deshacerLocal = () => {
    if (!d || pasado.length === 0) return;
    setFuturo((f) => [...f, d]);
    setD(pasado[pasado.length - 1]);
    setPasado((p) => p.slice(0, -1));
  };
  const rehacerLocal = () => {
    if (!d || futuro.length === 0) return;
    setPasado((p) => [...p, d]);
    setD(futuro[futuro.length - 1]);
    setFuturo((f) => f.slice(0, -1));
  };

  async function accion(que: "publicar" | "deshacer" | "descartar") {
    if (!d) return;
    setOcupado(true);
    setMensaje(null);
    try {
      // Asegura que el servidor tiene lo último antes de publicar.
      if (que === "publicar" && JSON.stringify(d) !== ultimoEnviado.current) {
        await pedir(`/api/admin/portales/${portal.id}/diseno`, "PUT", { diseno: d });
        ultimoEnviado.current = JSON.stringify(d);
      }
      const r = await pedir<Omit<Datos, "portal" | "menu" | "articulos" | "secciones">>(`/api/admin/portales/${portal.id}/diseno`, "POST", { accion: que });
      setDatos((x) => (x ? { ...x, publicado: r.publicado, borrador: r.borrador, hayAnterior: r.hayAnterior, publicadoEn: r.publicadoEn } : x));
      const nuevo = clonar(r.borrador ?? r.publicado);
      ultimoEnviado.current = JSON.stringify(nuevo);
      setD(nuevo);
      setPasado([]);
      setFuturo([]);
      setVersion((n) => n + 1);
      setMensaje({ ok: true, texto: que === "publicar" ? "Publicado: el sitio ya se ve con este diseño." : que === "deshacer" ? "Se volvió al diseño anterior." : "Se descartaron los cambios sin publicar." });
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeDe(e, "No se pudo completar la acción.") });
    } finally {
      setOcupado(false);
    }
  }

  if (error) return <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>;
  if (!datos || !d) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Abriendo el diseño…</p>;

  const sinPublicar = !igual(d, datos.publicado);
  const abrir = (k: string) => ({ abierto: !!abiertos[k], alAbrir: (v: boolean) => setAbiertos((a) => ({ ...a, [k]: v })) });
  const modoActual = d.base.modo;
  const ancho = DISPOSITIVOS.find((x) => x.id === dispositivo)!.ancho;

  /* ---- regiones */
  const estiloRegion = (d.regiones[region] ?? {}) as EstiloRegion;
  const controles = new Set<ControlRegion>(CONTROLES[region]);
  const ponerRegion = <K extends keyof EstiloRegion>(k: K, v: EstiloRegion[K] | undefined) =>
    cambiar((n) => {
      const e = { ...(n.regiones[region] ?? {}) } as EstiloRegion;
      if (v === undefined || v === false) delete e[k];
      else e[k] = v;
      if (Object.keys(e).length === 0) delete n.regiones[region];
      else n.regiones[region] = e;
    });
  const ponerColorModo = (modo: "claro" | "oscuro", k: "fondo" | "texto" | "acento", v: string | undefined) =>
    cambiar((n) => {
      const e = { ...(n.regiones[region] ?? {}) } as EstiloRegion;
      const m = { ...(e[modo] ?? {}) };
      if (v === undefined) delete m[k];
      else m[k] = v;
      if (Object.keys(m).length === 0) delete e[modo];
      else e[modo] = m;
      if (Object.keys(e).length === 0) delete n.regiones[region];
      else n.regiones[region] = e;
    });

  /* ---- notas */
  const nota = (d.notas[notaId] ?? {}) as EstiloNota;
  const ponerNota = <K extends keyof EstiloNota>(k: K, v: EstiloNota[K] | undefined) =>
    cambiar((n) => {
      const e = { ...(n.notas[notaId] ?? {}) } as EstiloNota;
      if (v === undefined || v === false) delete e[k];
      else e[k] = v;
      if (Object.keys(e).length === 0) delete n.notas[notaId];
      else n.notas[notaId] = e;
    });

  /* ---- menú: lo que el editor ya ordenó va primero; el resto, detrás */
  const menuOrdenado = (() => {
    const guardados = d.menu.map((m) => m.id);
    const enOrden = [...guardados.filter((id) => datos.menu.some((x) => x.id === id)), ...datos.menu.map((x) => x.id).filter((id) => !guardados.includes(id))];
    return enOrden.map((id) => ({ id, base: datos.menu.find((x) => x.id === id)!.texto, aj: d.menu.find((m) => m.id === id) }));
  })();
  const moverMenu = (i: number, delta: number) =>
    cambiar((n) => {
      const ids = menuOrdenado.map((m) => m.id);
      const j = i + delta;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      n.menu = ids.map((id) => ({ ...(n.menu.find((m) => m.id === id) ?? { id }) }));
    });
  const ajustarMenu = (id: string, cambio: { texto?: string; oculto?: boolean }) =>
    cambiar((n) => {
      const ids = menuOrdenado.map((m) => m.id);
      n.menu = ids.map((i) => ({ ...(n.menu.find((m) => m.id === i) ?? { id: i }) }));
      const it = n.menu.find((m) => m.id === id)!;
      if ("texto" in cambio) {
        if (cambio.texto) it.texto = cambio.texto;
        else delete it.texto;
      }
      if ("oculto" in cambio) {
        if (cambio.oculto) it.oculto = true;
        else delete it.oculto;
      }
    });

  /* ---- secciones del inicio */
  const disponiblesSec = SECCIONES_INICIO.filter((s) => (s.id === "servicios" ? datos.secciones.servicios : s.id === "pasos" ? datos.secciones.pasos : s.id === "preguntas" ? datos.secciones.preguntas : s.id === "articulos" ? datos.secciones.articulos : s.id === "eventos" ? datos.secciones.eventos : true));
  const moverSeccion = (id: SeccionId, delta: number) =>
    cambiar((n) => {
      const o = [...n.secciones.orden];
      const i = o.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= o.length) return;
      [o[i], o[j]] = [o[j], o[i]];
      n.secciones.orden = o;
    });
  const alternarSeccion = (id: SeccionId) =>
    cambiar((n) => {
      n.secciones.ocultas = n.secciones.ocultas.includes(id) ? n.secciones.ocultas.filter((x) => x !== id) : [...n.secciones.ocultas, id];
    });

  const colores = (modo: "claro" | "oscuro") => d.base[modo];
  const ponerColorBase = (modo: "claro" | "oscuro", k: keyof DisenoPortal["base"]["claro"], v: string | undefined) =>
    cambiar((n) => {
      if (v === undefined) delete n.base[modo][k];
      else n.base[modo][k] = v;
    });

  return (
    <div className="space-y-4">
      <div className={`${tarjeta} flex flex-wrap items-center gap-2 p-3`}>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-semibold">Diseño del sitio</p>
          <p className="text-xs text-muted-foreground">
            {sinPublicar ? "Hay cambios sin publicar" : "Lo publicado coincide con lo que ves"}
            {datos.publicadoEn && ` · última publicación ${hace(datos.publicadoEn)}`}
            {guardando === "guardando" && " · guardando…"}
            {guardando === "guardado" && " · borrador guardado"}
            {guardando === "error" && " · no se pudo guardar el borrador"}
          </p>
        </div>
        <button type="button" onClick={deshacerLocal} disabled={pasado.length === 0} className={botonSecundario} aria-label="Deshacer el último cambio"><Undo2 className="size-4" /></button>
        <button type="button" onClick={rehacerLocal} disabled={futuro.length === 0} className={botonSecundario} aria-label="Rehacer"><Redo2 className="size-4" /></button>
        <button type="button" onClick={() => accion("descartar")} disabled={ocupado || (!datos.borrador && !sinPublicar)} className={botonSecundario}>Descartar cambios</button>
        <button type="button" onClick={() => accion("deshacer")} disabled={ocupado || !datos.hayAnterior} className={botonSecundario}>Deshacer la publicación</button>
        <button type="button" onClick={() => accion("publicar")} disabled={ocupado || !sinPublicar} className={botonPrimario}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Publicar</button>
      </div>
      {mensaje && <p role="status" className={`rounded-xl px-4 py-2.5 text-sm ${mensaje.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"}`}>{mensaje.texto}</p>}

      <div className="grid gap-4 xl:grid-cols-[23rem_minmax(0,1fr)]">
        <div className="space-y-3 xl:max-h-[calc(100dvh-13rem)] xl:overflow-y-auto xl:pr-1">
          <Grupo titulo="Apariencia general" descripcion="Modo, colores, tipografías y tamaños de todo el sitio" {...abrir("apariencia")}>
            <Selector etiqueta="Modo" valor={modoActual} opciones={[{ id: "plantilla", texto: "El de la plantilla" }, { id: "claro", texto: "Claro" }, { id: "oscuro", texto: "Oscuro" }]} onCambio={(v) => cambiar((n) => { n.base.modo = v; })} />
            {(["claro", "oscuro"] as const).map((m) => (
              <fieldset key={m} className="space-y-2 rounded-xl bg-surface-muted/60 p-3">
                <legend className="px-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">Colores en modo {m}</legend>
                <CampoColor etiqueta="Color principal" valor={colores(m).acento} onCambio={(v) => ponerColorBase(m, "acento", v)} />
                <CampoColor etiqueta="Segundo color" valor={colores(m).acento2} onCambio={(v) => ponerColorBase(m, "acento2", v)} />
                <CampoColor etiqueta="Fondo" valor={colores(m).fondo} onCambio={(v) => ponerColorBase(m, "fondo", v)} />
                <CampoColor etiqueta="Fondo de secciones alternas" valor={colores(m).alterno} onCambio={(v) => ponerColorBase(m, "alterno", v)} />
                <CampoColor etiqueta="Texto" valor={colores(m).texto} onCambio={(v) => ponerColorBase(m, "texto", v)} />
              </fieldset>
            ))}
            <Selector etiqueta="Tipografía de los títulos" valor={d.base.fuenteTitulos} opciones={opcionesFuente} onCambio={(v: FuenteId) => cambiar((n) => { n.base.fuenteTitulos = v; })} />
            <Selector etiqueta="Tipografía del texto" valor={d.base.fuenteTexto} opciones={opcionesFuente} onCambio={(v: FuenteId) => cambiar((n) => { n.base.fuenteTexto = v; })} />
            <Rango etiqueta="Tamaño del contenido" valor={d.base.escala === 100 ? null : d.base.escala} min={80} max={140} unidad=" %" defecto={100} onCambio={(v) => cambiar((n) => { n.base.escala = v ?? 100; })} />
            <Rango etiqueta="Bordes de las tarjetas" valor={d.base.radio} min={0} max={48} unidad=" px" defecto={28} onCambio={(v) => cambiar((n) => { n.base.radio = v ?? null; })} />
            <Rango etiqueta="Ancho máximo del contenido" valor={d.base.anchoMax} min={640} max={1920} paso={20} unidad=" px" defecto={1152} onCambio={(v) => cambiar((n) => { n.base.anchoMax = v ?? null; })} />
          </Grupo>

          <Grupo titulo="Regiones" descripcion="Cambia cada parte de la página por separado (o haz clic en ella)" {...abrir("regiones")}>
            <div className="flex flex-wrap gap-1.5">
              {REGIONES.map((r) => (
                <button key={r.id} type="button" onClick={() => setRegion(r.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${region === r.id ? "bg-brand text-brand-foreground" : "ring-1 ring-border hover:bg-surface-muted"}`}>
                  {r.nombre}{d.regiones[r.id] ? " •" : ""}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{REGIONES.find((r) => r.id === region)?.ayuda}</p>
            {controles.has("ocultar") && <Interruptor etiqueta="Ocultar esta región" valor={!!estiloRegion.oculto} onCambio={(v) => ponerRegion("oculto", v)} />}
            {controles.has("fondo") && <CampoColor etiqueta="Fondo" valor={estiloRegion.fondo} onCambio={(v) => ponerRegion("fondo", v)} />}
            {controles.has("degradado") && <CampoColor etiqueta="Degradado hasta" valor={estiloRegion.fondo2} onCambio={(v) => ponerRegion("fondo2", v)} />}
            {controles.has("texto") && <CampoColor etiqueta="Color del texto" valor={estiloRegion.texto} onCambio={(v) => ponerRegion("texto", v)} />}
            {controles.has("acento") && <CampoColor etiqueta="Color de acento (botones, enlaces)" valor={estiloRegion.acento} onCambio={(v) => ponerRegion("acento", v)} />}
            {(controles.has("fondo") || controles.has("texto") || controles.has("acento")) && (
              <details className="rounded-xl bg-surface-muted/60 p-3 text-xs">
                <summary className="cursor-pointer font-semibold">Colores distintos en modo claro y oscuro</summary>
                <div className="mt-3 space-y-3">
                  {(["claro", "oscuro"] as const).map((m) => (
                    <fieldset key={m} className="space-y-2">
                      <legend className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">Solo en modo {m}</legend>
                      {controles.has("fondo") && <CampoColor etiqueta="Fondo" valor={estiloRegion[m]?.fondo} onCambio={(v) => ponerColorModo(m, "fondo", v)} />}
                      {controles.has("texto") && <CampoColor etiqueta="Texto" valor={estiloRegion[m]?.texto} onCambio={(v) => ponerColorModo(m, "texto", v)} />}
                      {controles.has("acento") && <CampoColor etiqueta="Acento" valor={estiloRegion[m]?.acento} onCambio={(v) => ponerColorModo(m, "acento", v)} />}
                    </fieldset>
                  ))}
                </div>
              </details>
            )}
            {controles.has("fuentes") && (
              <>
                <Selector etiqueta="Tipografía de los títulos" valor={estiloRegion.fuenteTitulos ?? "plantilla"} opciones={opcionesFuente} onCambio={(v: FuenteId) => ponerRegion("fuenteTitulos", v === "plantilla" ? undefined : v)} />
                <Selector etiqueta="Tipografía del texto" valor={estiloRegion.fuenteTexto ?? "plantilla"} opciones={opcionesFuente} onCambio={(v: FuenteId) => ponerRegion("fuenteTexto", v === "plantilla" ? undefined : v)} />
              </>
            )}
            {controles.has("escala") && <Rango etiqueta="Tamaño del contenido" valor={estiloRegion.escala} min={70} max={160} unidad=" %" defecto={100} onCambio={(v) => ponerRegion("escala", v)} />}
            {controles.has("padding") && (
              <>
                <Rango etiqueta="Espacio arriba" valor={estiloRegion.padArriba} min={0} max={200} unidad=" px" defecto={80} onCambio={(v) => ponerRegion("padArriba", v)} />
                <Rango etiqueta="Espacio abajo" valor={estiloRegion.padAbajo} min={0} max={200} unidad=" px" defecto={80} onCambio={(v) => ponerRegion("padAbajo", v)} />
              </>
            )}
            {controles.has("radio") && <Rango etiqueta="Bordes redondeados" valor={estiloRegion.radio} min={0} max={48} unidad=" px" defecto={24} onCambio={(v) => ponerRegion("radio", v)} />}
            {controles.has("ancho") && <Rango etiqueta="Ancho máximo" valor={estiloRegion.anchoMax} min={640} max={1920} paso={20} unidad=" px" defecto={1152} onCambio={(v) => ponerRegion("anchoMax", v)} />}
            {controles.has("alinear") && <Selector etiqueta="Alineación del texto" valor={estiloRegion.alinear ?? "izquierda"} opciones={[{ id: "izquierda", texto: "Izquierda" }, { id: "centro", texto: "Centro" }, { id: "derecha", texto: "Derecha" }]} onCambio={(v) => ponerRegion("alinear", v)} />}
          </Grupo>

          <Grupo titulo="Secciones del inicio" descripcion="El orden de las secciones y cuáles se ven" {...abrir("secciones")}>
            <ul className="space-y-1.5">
              {d.secciones.orden.filter((id) => disponiblesSec.some((s) => s.id === id)).map((id, i, lista) => {
                const oculta = d.secciones.ocultas.includes(id);
                return (
                  <li key={id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <span className={`min-w-0 flex-1 truncate ${oculta ? "text-muted-foreground line-through" : "font-medium"}`}>{SECCIONES_INICIO.find((s) => s.id === id)?.nombre}</span>
                    <button type="button" onClick={() => moverSeccion(id, -1)} disabled={i === 0} aria-label="Subir" className="rounded-full p-1.5 ring-1 ring-border disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                    <button type="button" onClick={() => moverSeccion(id, 1)} disabled={i === lista.length - 1} aria-label="Bajar" className="rounded-full p-1.5 ring-1 ring-border disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                    <button type="button" onClick={() => alternarSeccion(id)} aria-label={oculta ? "Mostrar" : "Ocultar"} className="rounded-full p-1.5 ring-1 ring-border">{oculta ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>
                  </li>
                );
              })}
            </ul>
          </Grupo>

          <Grupo titulo="Menú" descripcion="Orden, nombres y enlaces visibles del encabezado" {...abrir("menu")}>
            <ul className="space-y-1.5">
              {menuOrdenado.map((m, i) => (
                <li key={m.id} className="flex items-center gap-1.5 rounded-xl border border-border px-2 py-1.5">
                  <input value={m.aj?.texto ?? ""} placeholder={m.base} onChange={(e) => ajustarMenu(m.id, { texto: e.target.value })} aria-label={`Nombre de ${m.base}`} maxLength={40} className={`${campo} !py-1.5 ${m.aj?.oculto ? "opacity-50" : ""}`} />
                  <button type="button" onClick={() => moverMenu(i, -1)} disabled={i === 0} aria-label="Subir" className="rounded-full p-1.5 ring-1 ring-border disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                  <button type="button" onClick={() => moverMenu(i, 1)} disabled={i === menuOrdenado.length - 1} aria-label="Bajar" className="rounded-full p-1.5 ring-1 ring-border disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                  <button type="button" onClick={() => ajustarMenu(m.id, { oculto: !m.aj?.oculto })} aria-label={m.aj?.oculto ? "Mostrar" : "Ocultar"} className="rounded-full p-1.5 ring-1 ring-border">{m.aj?.oculto ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>
                </li>
              ))}
            </ul>
          </Grupo>

          <Grupo titulo="Cintillo de titulares" descripcion="Una franja en movimiento bajo el encabezado" {...abrir("cintillo")}>
            <Interruptor etiqueta="Mostrar el cintillo" valor={d.cintillo.activo} onCambio={(v) => cambiar((n) => { n.cintillo.activo = v; })} />
            <Selector etiqueta="De dónde salen los textos" valor={d.cintillo.origen} opciones={[{ id: "articulos", texto: "Los últimos artículos" }, { id: "mensajes", texto: "Mensajes propios" }]} onCambio={(v) => cambiar((n) => { n.cintillo.origen = v; })} />
            <label className="block text-xs"><span className={etiquetaCampo}>Etiqueta</span><input value={d.cintillo.etiqueta} maxLength={24} onChange={(e) => cambiar((n) => { n.cintillo.etiqueta = e.target.value; })} className={campo} /></label>
            {d.cintillo.origen === "articulos" ? (
              <Rango etiqueta="Cuántos titulares" valor={d.cintillo.cantidad} min={3} max={12} defecto={6} onCambio={(v) => cambiar((n) => { n.cintillo.cantidad = v ?? 6; })} />
            ) : (
              <label className="block text-xs"><span className={etiquetaCampo}>Mensajes (uno por línea)</span><textarea rows={4} value={d.cintillo.mensajes.join("\n")} onChange={(e) => cambiar((n) => { n.cintillo.mensajes = e.target.value.split("\n").slice(0, 12); })} className={campo} /></label>
            )}
            <Rango etiqueta="Velocidad" valor={d.cintillo.velocidad} min={1} max={10} defecto={4} onCambio={(v) => cambiar((n) => { n.cintillo.velocidad = v ?? 4; })} />
          </Grupo>

          <Grupo titulo="Ventana emergente" descripcion="Un aviso que aparece a los pocos segundos" {...abrir("emergente")}>
            <Interruptor etiqueta="Mostrar la ventana emergente" valor={d.emergente.activo} onCambio={(v) => cambiar((n) => { n.emergente.activo = v; })} />
            <label className="block text-xs"><span className={etiquetaCampo}>Título</span><input value={d.emergente.titulo} maxLength={90} onChange={(e) => cambiar((n) => { n.emergente.titulo = e.target.value; })} className={campo} /></label>
            <label className="block text-xs"><span className={etiquetaCampo}>Texto</span><textarea rows={3} value={d.emergente.texto} maxLength={280} onChange={(e) => cambiar((n) => { n.emergente.texto = e.target.value; })} className={campo} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs"><span className={etiquetaCampo}>Botón</span><input value={d.emergente.boton} maxLength={30} onChange={(e) => cambiar((n) => { n.emergente.boton = e.target.value; })} className={campo} /></label>
              <label className="block text-xs"><span className={etiquetaCampo}>Enlace</span><input value={d.emergente.enlace} placeholder="https://… o /p/…" onChange={(e) => cambiar((n) => { n.emergente.enlace = e.target.value; })} className={campo} /></label>
            </div>
            <Rango etiqueta="Aparece a los" valor={d.emergente.retardoSeg} min={0} max={60} unidad=" s" defecto={6} onCambio={(v) => cambiar((n) => { n.emergente.retardoSeg = v ?? 6; })} />
            <Selector etiqueta="Cuántas veces se muestra" valor={d.emergente.frecuencia} opciones={[{ id: "sesion", texto: "Una vez por visita" }, { id: "dia", texto: "Una vez al día" }, { id: "siempre", texto: "Siempre" }]} onCambio={(v) => cambiar((n) => { n.emergente.frecuencia = v; })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs"><span className={etiquetaCampo}>Desde</span><input type="date" value={d.emergente.desde ?? ""} onChange={(e) => cambiar((n) => { n.emergente.desde = e.target.value || null; })} className={campo} /></label>
              <label className="block text-xs"><span className={etiquetaCampo}>Hasta</span><input type="date" value={d.emergente.hasta ?? ""} onChange={(e) => cambiar((n) => { n.emergente.hasta = e.target.value || null; })} className={campo} /></label>
            </div>
          </Grupo>

          <Grupo titulo="Notas" descripcion="El tamaño, el orden y el aspecto de cada artículo" {...abrir("notas")}>
            {datos.articulos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Cuando publiques artículos podrás darle a cada uno su propio aspecto.</p>
            ) : (
              <>
                <label className="block text-xs">
                  <span className={etiquetaCampo}>Artículo</span>
                  <select value={notaId} onChange={(e) => setNotaId(e.target.value)} className={campo}>
                    <option value="">Elige un artículo…</option>
                    {datos.articulos.map((a) => <option key={a.id} value={a.id}>{d.notas[a.id] ? "• " : ""}{a.titulo}</option>)}
                  </select>
                </label>
                {notaId && (
                  <div className="space-y-3.5">
                    <Selector etiqueta="Tamaño de la tarjeta" valor={nota.tamano ?? "M"} opciones={[{ id: "S", texto: "Pequeña" }, { id: "M", texto: "Normal" }, { id: "L", texto: "Grande (ocupa dos columnas)" }]} onCambio={(v) => ponerNota("tamano", v === "M" ? undefined : v)} />
                    <Rango etiqueta="Tamaño del título" valor={nota.escalaTitulo} min={70} max={200} unidad=" %" defecto={100} onCambio={(v) => ponerNota("escalaTitulo", v)} />
                    <Interruptor etiqueta="Título en negrita" valor={!!nota.negrita} onCambio={(v) => ponerNota("negrita", v)} />
                    <Interruptor etiqueta="Título en cursiva" valor={!!nota.cursiva} onCambio={(v) => ponerNota("cursiva", v)} />
                    <CampoColor etiqueta="Color del título" valor={nota.colorTitulo} onCambio={(v) => ponerNota("colorTitulo", v)} />
                    <Rango etiqueta="Alto de la imagen" valor={nota.imagenAlto} min={80} max={800} paso={10} unidad=" px" defecto={220} onCambio={(v) => ponerNota("imagenAlto", v)} />
                    <Interruptor etiqueta="Sin imagen" valor={!!nota.sinImagen} onCambio={(v) => ponerNota("sinImagen", v)} />
                    <Rango etiqueta="Lugar fijo (1 = primera)" valor={nota.fijar} min={1} max={20} defecto={1} onCambio={(v) => ponerNota("fijar", v)} />
                    <Interruptor etiqueta="Ocultar esta nota del inicio y del listado" valor={!!nota.oculta} onCambio={(v) => ponerNota("oculta", v)} />
                  </div>
                )}
              </>
            )}
          </Grupo>
        </div>

        <div className={`${tarjeta} min-w-0 overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <select value={pagina} onChange={(e) => { setPagina(e.target.value); setVersion((n) => n + 1); }} aria-label="Página que se ve" className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold">
              {PAGINAS.map((p) => <option key={p.ruta} value={p.ruta}>{p.texto}</option>)}
            </select>
            <div className="inline-flex rounded-full bg-surface-muted p-0.5">
              {DISPOSITIVOS.map((x) => (
                <button key={x.id} type="button" onClick={() => setDispositivo(x.id)} aria-label={x.texto} aria-pressed={dispositivo === x.id} className={`rounded-full p-1.5 ${dispositivo === x.id ? "bg-surface shadow-sm" : "text-muted-foreground"}`}><x.icono className="size-4" /></button>
              ))}
            </div>
            <button type="button" onClick={() => setSeleccionar((s) => !s)} aria-pressed={seleccionar} className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${seleccionar ? "bg-brand text-brand-foreground" : "ring-1 ring-border"}`}>
              <MousePointerClick className="size-3.5" /> {seleccionar ? "Clic para elegir una parte" : "Navegando por el sitio"}
            </button>
            <a href={`/p/${datos.portal.slug}${pagina}`} target="_blank" rel="noreferrer noopener" className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border">Abrir aparte</a>
          </div>
          <div className="flex justify-center bg-surface-muted/60 p-2">
            <iframe
              ref={marco}
              key={`${version}-${pagina}`}
              src={`/p/${datos.portal.slug}${pagina}`}
              title="Vista previa del sitio con el borrador aplicado"
              onLoad={() => marco.current?.contentWindow?.postMessage({ tipo: "portal-modo", seleccionar }, window.location.origin)}
              style={ancho ? { width: ancho } : undefined}
              className="h-[calc(100dvh-16rem)] min-h-[32rem] w-full max-w-full rounded-xl bg-white shadow-sm"
            />
          </div>
          <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground"><Check className="size-3" /> La vista previa muestra el borrador; el público ve lo último que publiques.</p>
        </div>
      </div>
    </div>
  );
}
