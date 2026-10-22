"use client";

import * as React from "react";
import type { ECharts, EChartsOption } from "echarts";
import { Loader2, RefreshCw, Search } from "lucide-react";

import { useTheme } from "@/components/animations/theme-provider";

type Punto = { dane: string; nombre: string; departamento: string; lat: number; lon: number; total: number };
type Datos = {
  actualizado: string; hayDatos: boolean; webhook: boolean;
  totales: { leads: number; conCiudad: number; conDepartamento: number; ubicadosEnMapa: number; sinUbicar: number };
  municipios: Punto[]; departamentos: { codigo: string; nombre: string; total: number }[]; sinUbicar: { nombre: string; total: number }[];
};

const n = (v: number) => Math.round(v).toLocaleString("es-CO");
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "—");
const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Persona = { id: number; nombre: string; estado: string | null; barrio: string | null; localidad: string | null; profesion: string | null; gremio: string | null; creado_en: string | null };

/** Las personas (leads guardados en Supabase) de la ciudad elegida. */
function PersonasDeCiudad({ dane, nombre }: { dane: string; nombre: string }) {
  const [filas, setFilas] = React.useState<{ dane: string; personas: Persona[]; total: number; pagina: number; error?: string } | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const pedir = React.useCallback(async (pagina: number) => {
    setCargando(true);
    try {
      const r = await fetch(`/api/admin/red-crm/leads?dane=${dane}&pagina=${pagina}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo leer.");
      setFilas((f) => ({ dane, total: j.total, pagina, personas: pagina > 1 && f?.dane === dane ? [...f.personas, ...j.personas] : j.personas }));
    } catch (e) {
      setFilas({ dane, personas: [], total: 0, pagina: 1, error: e instanceof Error ? e.message : "No se pudo leer." });
    } finally {
      setCargando(false);
    }
  }, [dane]);
  React.useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/red-crm/leads?dane=${dane}&pagina=1`, { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "No se pudo leer."); if (vivo) setFilas({ dane, total: j.total, pagina: 1, personas: j.personas }); })
      .catch((e: Error) => { if (vivo) setFilas({ dane, personas: [], total: 0, pagina: 1, error: e.message }); });
    return () => { vivo = false; };
  }, [dane]);
  const f = filas?.dane === dane ? filas : null;
  if (!f) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Trayendo las personas de {nombre}…</p>;
  if (f.error) return <p role="alert" className="text-sm text-red-800">{f.error}</p>;
  if (f.total === 0) return <p className="text-sm text-muted-foreground">Todavía no hay personas guardadas para {nombre}. Usa «Guardar todos los leads» arriba para traerlas del CRM a Supabase.</p>;
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">{n(f.total)} personas guardadas en {nombre}:</p>
      <div className="max-h-96 overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[32rem] text-left text-xs">
          <thead className="sticky top-0 bg-surface-muted text-[11px] tracking-wide text-muted-foreground uppercase"><tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Etapa</th><th className="px-3 py-2">Barrio / localidad</th><th className="px-3 py-2">Profesión</th><th className="px-3 py-2">Gremio</th></tr></thead>
          <tbody>{f.personas.map((p) => <tr key={p.id} className="border-t border-border/60"><td className="px-3 py-1.5 font-semibold">{p.nombre}</td><td className="px-3 py-1.5">{p.estado ?? "—"}</td><td className="px-3 py-1.5">{[p.barrio, p.localidad].filter(Boolean).join(" · ") || "—"}</td><td className="px-3 py-1.5">{p.profesion ?? "—"}</td><td className="px-3 py-1.5">{p.gremio ?? "—"}</td></tr>)}</tbody>
        </table>
      </div>
      {f.personas.length < f.total && <button type="button" disabled={cargando} onClick={() => void pedir(f.pagina + 1)} className="mt-2 rounded-full border border-border px-4 py-1.5 text-xs font-semibold hover:bg-surface-muted disabled:opacity-50">{cargando ? "Cargando…" : `Ver más (${n(f.total - f.personas.length)} restantes)`}</button>}
    </div>
  );
}

/** Copia los leads (nombre, lugar y campos de segmentación; sin teléfonos ni correos) de Bitrix24 a Supabase. */
function GuardarLeads({ webhook }: { webhook: boolean }) {
  const [guardados, setGuardados] = React.useState<number | null>(null);
  const [avance, setAvance] = React.useState<{ siguiente: number; maxId: number } | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    fetch("/api/admin/red-crm/leads", { cache: "no-store" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "No se pudo leer."); setGuardados(j.guardados); }).catch((e: Error) => setError(e.message));
  }, []);
  async function guardar() {
    setError("");
    let desde = 0;
    try {
      setAvance({ siguiente: 0, maxId: 1 });
      for (;;) {
        const r = await fetch("/api/admin/red-crm/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ desde }) });
        const j = (await r.json().catch(() => ({}))) as { siguiente?: number; maxId?: number; terminado?: boolean; error?: string };
        if (!r.ok || j.siguiente === undefined) throw new Error(j.error ?? "No se pudo guardar.");
        desde = j.siguiente;
        setAvance({ siguiente: desde, maxId: j.maxId ?? 1 });
        if (j.terminado) break;
      }
      const e = await fetch("/api/admin/red-crm/leads", { cache: "no-store" }).then((r) => r.json());
      setGuardados(e.guardados ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setAvance(null);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-sm">
      <p className="min-w-0 flex-1">Leads guardados en Supabase: <b className="tabular-nums">{guardados === null ? "…" : n(guardados)}</b>. Al guardarlos puedes ver las personas de cada ciudad.</p>
      <button type="button" onClick={() => void guardar()} disabled={!!avance || !webhook} title={!webhook ? "Falta BITRIX24_WEBHOOK_URL en el servidor" : undefined} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted disabled:opacity-50">
        {avance && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        {avance ? `Guardando… ${Math.round((avance.siguiente / avance.maxId) * 100)} %` : "Guardar todos los leads"}
      </button>
      {error && <p role="alert" className="w-full rounded-xl bg-red-50 p-2 text-red-800">{error}</p>}
    </div>
  );
}

/** Cuántos leads hay en cada ciudad y departamento (todos los del CRM), con mapa de burbujas y buscador. */
export function RedCrmTodos() {
  const [datos, setDatos] = React.useState<Datos | null>(null);
  const [error, setError] = React.useState("");
  const [calculando, setCalculando] = React.useState<{ hecho: number; total: number } | null>(null);
  const [q, setQ] = React.useState("");
  const [elegido, setElegido] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const [chart, setChart] = React.useState<ECharts | null>(null);
  const [mapaListo, setMapaListo] = React.useState(false);
  const { resolvedTheme } = useTheme();
  const elegir = React.useEffectEvent((d: string) => setElegido(d));

  const leer = React.useCallback(async () => {
    const r = await fetch("/api/admin/red-crm/conteos", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "No se pudieron leer los conteos.");
    setDatos(j as Datos);
  }, []);
  React.useEffect(() => {
    fetch("/api/admin/red-crm/conteos", { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "No se pudieron leer los conteos."); setDatos(j as Datos); })
      .catch((e: Error) => setError(e.message));
  }, []);

  async function calcular() {
    setError("");
    let desde = 0;
    try {
      setCalculando({ hecho: 0, total: 1 });
      for (;;) {
        const r = await fetch("/api/admin/red-crm/conteos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ desde }) });
        const j = (await r.json().catch(() => ({}))) as { siguiente?: number; total?: number; terminado?: boolean; error?: string };
        if (!r.ok || j.siguiente === undefined) throw new Error(j.error ?? "No se pudo calcular.");
        desde = j.siguiente;
        setCalculando({ hecho: desde, total: j.total ?? 1 });
        if (j.terminado) break;
      }
      await leer();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo calcular.");
    } finally {
      setCalculando(null);
    }
  }

  // Mapa de burbujas: se crea cuando ya hay datos que mostrar.
  const hayDatos = !!datos?.hayDatos;
  React.useEffect(() => {
    if (!hayDatos) return;
    let vivo = true;
    let inst: ECharts | null = null;
    let obs: ResizeObserver | null = null;
    (async () => {
      const echarts = await import("echarts");
      if (!vivo || !ref.current) return;
      const r = await fetch("/data/geo/departamentos.json");
      if (!r.ok || !vivo || !ref.current) return;
      echarts.registerMap("colombia", await r.json());
      inst = echarts.init(ref.current);
      inst.on("click", (p) => { const d = (p.data as { dane?: string } | undefined)?.dane; if (d) elegir(d); });
      obs = new ResizeObserver(() => inst?.resize());
      obs.observe(ref.current);
      setChart(inst);
      setMapaListo(true);
    })();
    return () => { vivo = false; obs?.disconnect(); inst?.dispose(); setChart(null); setMapaListo(false); };
  }, [hayDatos]);

  const sel = datos?.municipios.find((m) => m.dane === elegido) ?? null;
  React.useEffect(() => {
    if (!chart || !mapaListo || !datos) return;
    const oscuro = resolvedTheme === "dark";
    const max = Math.max(1, ...datos.municipios.map((m) => m.total));
    const opcion: EChartsOption = {
      tooltip: { confine: true, backgroundColor: oscuro ? "#0e1211" : "#fff", textStyle: { color: oscuro ? "#f2efe7" : "#16170f", fontSize: 12 }, formatter: (p) => { const d = (p as unknown as { data?: { nombre: string; departamento: string; total: number } }).data; return d ? `<b>${esc(d.nombre)}</b>, ${esc(d.departamento)}<br/>${n(d.total)} leads` : ""; } },
      animationDurationUpdate: 700,
      geo: { map: "colombia", roam: false, silent: true, ...(sel ? { center: [sel.lon, sel.lat], zoom: 9 } : { zoom: 1 }), itemStyle: { areaColor: oscuro ? "#1b2220" : "#eef0ea", borderColor: oscuro ? "#33403c" : "#c9ccc0", borderWidth: 0.7 }, label: { show: false } },
      series: [{
        type: "scatter", coordinateSystem: "geo",
        data: datos.municipios.map((m) => ({ dane: m.dane, nombre: m.nombre, departamento: m.departamento, total: m.total, value: [m.lon, m.lat, m.total], symbolSize: 5 + 46 * Math.sqrt(m.total / max), itemStyle: { color: m.dane === elegido ? "#eb6834" : "rgba(42,120,214,0.55)", borderColor: m.dane === elegido ? "#16170f" : "rgba(42,120,214,0.95)", borderWidth: m.dane === elegido ? 2 : 0.8 } })),
        emphasis: { scale: 1.15 },
      }],
    };
    chart.setOption(opcion, { notMerge: true });
  }, [chart, mapaListo, datos, elegido, sel, resolvedTheme]);
  const coincidencias = React.useMemo(() => {
    const t = plano(q.trim());
    if (!datos || t.length < 2) return [];
    return datos.municipios.filter((m) => plano(m.nombre).includes(t) || plano(m.departamento).includes(t)).slice(0, 8);
  }, [datos, q]);
  const tarjeta = "rounded-2xl border border-border bg-surface p-4 shadow-sm";

  if (!datos && !error) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Leyendo…</p>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">Conteo exacto de <b>todos</b> los leads del CRM por ciudad y departamento. No se copian las personas: se le pregunta a Bitrix24 cuántos hay en cada lugar.{datos?.actualizado ? ` Última actualización: ${new Date(datos.actualizado).toLocaleString("es-CO")}.` : ""}</p>
        <button type="button" onClick={() => void calcular()} disabled={!!calculando || (datos !== null && !datos.webhook)} title={datos && !datos.webhook ? "Falta BITRIX24_WEBHOOK_URL en el servidor" : undefined} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">
          {calculando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
          {calculando ? `Contando… ${Math.round((calculando.hecho / calculando.total) * 100)} %` : datos?.hayDatos ? "Actualizar los conteos" : "Calcular los conteos"}
        </button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {datos && !datos.hayDatos && !calculando && <p className="rounded-xl bg-brand-soft p-3 text-sm">Todavía no se han calculado los conteos. Pulsa «Calcular los conteos»: tarda unos 3 minutos y queda guardado en Supabase.{!datos.webhook && " Antes, pon BITRIX24_WEBHOOK_URL en las variables de Vercel."}</p>}

      {datos?.hayDatos && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Leads en el CRM</p><p className="mt-1 text-2xl font-bold tabular-nums">{n(datos.totales.leads)}</p></div>
            <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Con ciudad</p><p className="mt-1 text-2xl font-bold tabular-nums">{n(datos.totales.conCiudad)}</p><p className="text-xs text-muted-foreground">{pct(datos.totales.conCiudad, datos.totales.leads)} del total</p></div>
            <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Con departamento</p><p className="mt-1 text-2xl font-bold tabular-nums">{n(datos.totales.conDepartamento)}</p><p className="text-xs text-muted-foreground">{pct(datos.totales.conDepartamento, datos.totales.leads)} del total</p></div>
            <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ubicados en el mapa</p><p className="mt-1 text-2xl font-bold tabular-nums">{n(datos.totales.ubicadosEnMapa)}</p><p className="text-xs text-muted-foreground">{datos.totales.sinUbicar > 0 ? `${n(datos.totales.sinUbicar)} con una ciudad que no pude ubicar` : "todos los que tienen ciudad"}</p></div>
          </div>

          <div className="relative">
            <label className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2"><Search className="size-4 text-muted-foreground" aria-hidden="true" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Cuántos hay en…? Escribe una ciudad" aria-label="Buscar una ciudad" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            {coincidencias.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                {coincidencias.map((m) => <li key={m.dane}><button type="button" onClick={() => { setElegido(m.dane); setQ(""); }} className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-surface-muted"><span>{m.nombre} <span className="text-xs text-muted-foreground">{m.departamento}</span></span><b className="tabular-nums">{n(m.total)}</b></button></li>)}
              </ul>
            )}
          </div>

          <GuardarLeads webhook={datos.webhook} />

          {sel && (
            <div className={`${tarjeta} space-y-3`}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <p className="text-lg font-bold">{sel.nombre} <span className="text-sm font-normal text-muted-foreground">{sel.departamento}</span></p>
              <p className="text-2xl font-bold tabular-nums text-brand">{n(sel.total)} <span className="text-sm font-normal text-muted-foreground">leads</span></p>
              <p className="text-sm text-muted-foreground">{pct(sel.total, datos.totales.conCiudad)} de los que tienen ciudad · puesto {n(datos.municipios.findIndex((m) => m.dane === sel.dane) + 1)} de {n(datos.municipios.length)}</p>
              <button type="button" onClick={() => setElegido(null)} className="ml-auto text-xs underline">Ver todo el país</button>
              </div>
              <PersonasDeCiudad dane={sel.dane} nombre={sel.nombre} />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <div className="relative overflow-hidden rounded-2xl border border-border">
              <div ref={ref} role="img" aria-label="Mapa de Colombia con un círculo por ciudad, más grande donde hay más leads." className="h-[460px] w-full sm:h-[620px]" />
              {!mapaListo && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Cargando el mapa…</p>}
            </div>
            <div className="space-y-4">
              <div className={tarjeta}>
                <h3 className="text-sm font-semibold">Ciudades con más leads</h3>
                <ol className="mt-2 space-y-1.5">
                  {datos.municipios.slice(0, 15).map((m) => (
                    <li key={m.dane}><button type="button" onClick={() => setElegido(m.dane)} className="block w-full text-left text-xs"><span className="flex justify-between gap-2"><span className="truncate">{m.nombre}</span><b className="tabular-nums">{n(m.total)}</b></span><span className="mt-0.5 block h-1.5 rounded-full bg-border"><span className="block h-1.5 rounded-full bg-brand" style={{ width: `${(m.total / datos.municipios[0].total) * 100}%` }} /></span></button></li>
                  ))}
                </ol>
              </div>
              <div className={tarjeta}>
                <h3 className="text-sm font-semibold">Por departamento</h3>
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1 text-xs">
                  {datos.departamentos.filter((d) => d.total > 0).map((d) => <li key={d.codigo} className="flex justify-between gap-2"><span className="truncate">{d.nombre}</span><b className="tabular-nums">{n(d.total)}</b></li>)}
                </ul>
              </div>
            </div>
          </div>
          {datos.sinUbicar.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold">Ciudades del CRM que no pude ubicar en el mapa ({n(datos.totales.sinUbicar)} leads)</summary>
              <p className="mt-1">{datos.sinUbicar.map((x) => `${x.nombre} (${n(x.total)})`).join(" · ")}</p>
            </details>
          )}
        </>
      )}
    </div>
  );
}
