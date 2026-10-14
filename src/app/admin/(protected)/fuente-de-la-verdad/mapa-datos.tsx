"use client";

import * as React from "react";
import { AlertTriangle, Check, Copy, Database, ExternalLink, RefreshCw } from "lucide-react";

import type { Entidad, ModuloMapa, RespuestaMapa } from "@/lib/gestor/mapa";

import { usePeticion } from "../analisis-publicaciones/peticion";

/**
 * El mapa de lo que hay en Supabase, leído de izquierda a derecha como una red: la base → los módulos del panel → lo que hay
 * dentro de cada uno (un documento, un portal, una elección, un político…). El tamaño del punto crece con su contenido; un
 * punto hueco es algo que todavía no tiene datos o cuyas tablas faltan por crear.
 */

const COLOR: Record<string, string> = { electoral: "#10b981", documentos: "#0ea5e9", monitoreo: "#f43f5e", territorio: "#f59e0b", comunidad: "#a855f7", portales: "#14b8a6", usuarios: "#6366f1", piloto: "#ec4899", camaras: "#eab308" };
// Orden de arriba hacia abajo: primero lo más importante para la Fundación.
const ORDEN = ["documentos", "electoral", "portales", "comunidad", "territorio", "monitoreo", "usuarios", "piloto", "camaras"];
const UNIDAD: Record<string, string> = { documentos: "documento", electoral: "elección", portales: "portal", comunidad: "tipo de dato", territorio: "conjunto de datos", monitoreo: "fuente", usuarios: "usuario", piloto: "registro", camaras: "cámara" };

const W = 880;
const X_BASE = 62;
const X_MODULO = 262;
const X_ENTIDAD = 470;
const FILA = 50;
const SEPARACION = 22;
const ANCHO_MODULO = 168;

const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("es-CO"));
const radio = (cantidad: number, vacia: boolean) => (vacia ? 8 : 9 + Math.min(11, Math.log10(cantidad + 1) * 2.6));

type NodoEntidad = { clave: string; modulo: string; y: number; r: number; entidad: Entidad; vacia: boolean; relleno: boolean };
type NodoModulo = { modulo: ModuloMapa; y: number; faltan: boolean };

function construir(modulos: ModuloMapa[]) {
  const ordenados = [...modulos].sort((a, b) => ORDEN.indexOf(a.id) - ORDEN.indexOf(b.id));
  const entidades: NodoEntidad[] = [];
  const mods: NodoModulo[] = [];
  let y = 36;
  for (const m of ordenados) {
    const faltan = m.tablas.some((t) => t.filas === null);
    const lista: Entidad[] = m.entidades.length > 0 ? m.entidades : [{ id: `${m.id}-vacio`, nombre: faltan ? "Faltan crear las tablas" : "Todavía no hay nada guardado", resumen: faltan ? "Usa «Copiar el SQL que falta»" : "Cuando haya datos aparecerán aquí", cantidad: 0, unidad: "", hijos: [] }];
    const inicio = y;
    for (const e of lista) {
      const relleno = e.cantidad > 0 || e.hijos.length > 0;
      const vacia = !relleno && m.entidades.length === 0 ? true : !relleno;
      entidades.push({ clave: `${m.id}:${e.id}`, modulo: m.id, y, r: radio(e.cantidad, vacia), entidad: e, vacia, relleno });
      y += FILA;
    }
    mods.push({ modulo: m, y: (inicio + y - FILA) / 2, faltan });
    y += SEPARACION;
  }
  return { mods, entidades, alto: y + 10 };
}

export function MapaDatos() {
  const [v, setV] = React.useState(0);
  const r = usePeticion<RespuestaMapa>(`/api/admin/gestor/mapa${v ? `?v=${v}` : ""}`);
  const datos = r.estado === "listo" ? r.data : undefined;
  const [sel, setSel] = React.useState<{ modulo: string; entidad?: string } | null>(null);
  const [copiado, setCopiado] = React.useState<string | null>(null);
  const copiar = (clave: string, texto: string) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado(null), 1600);
  };

  const grafo = React.useMemo(() => (datos ? construir(datos.modulos) : null), [datos]);
  const moduloActual = datos ? datos.modulos.find((m) => m.id === (sel?.modulo ?? ORDEN.find((o) => datos.modulos.some((m) => m.id === o)))) : undefined;
  const entidadActual = moduloActual?.entidades.find((e) => e.id === sel?.entidad);

  const todas = datos?.modulos.flatMap((m) => m.tablas) ?? [];
  const faltan = todas.filter((t) => t.filas === null).length;
  const de = (id: string) => datos?.modulos.find((m) => m.id === id)?.entidades ?? [];
  const portales = de("portales");
  const elecciones = de("electoral");
  const filas = todas.reduce((s, t) => s + (t.filas ?? 0), 0);

  return (
    <div className="space-y-4">
      <style>{`@keyframes mapa-pulso{to{stroke-dashoffset:-24}}.mapa-arista{stroke-dasharray:3 9;animation:mapa-pulso 2.4s linear infinite}@media (prefers-reduced-motion:reduce){.mapa-arista{animation:none}}`}</style>
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">Lo que tiene guardado el panel en Supabase, de izquierda a derecha: la base, sus módulos y lo que hay dentro de cada uno. Toca un módulo o un punto para ver el detalle.</p>
        <button type="button" onClick={() => setV((n) => n + 1)} disabled={r.estado === "cargando"} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
          <RefreshCw className={`size-3 ${r.estado === "cargando" ? "animate-spin" : ""}`} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {r.estado === "error" && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{r.error}</p>}
      {r.estado === "cargando" && !datos && <p className="text-sm text-muted-foreground">Leyendo Supabase…</p>}
      {datos && !datos.conectado && <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">Supabase no está conectado en este entorno (faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).</p>}

      {datos && grafo && (
        <>
          <div className="grid grid-cols-2 gap-2 text-center sm:gap-3 lg:grid-cols-4">
            {[
              { l: "Documentos", v: num(de("documentos").length), d: "en la biblioteca" },
              { l: "Portales", v: num(portales.length), d: `${portales.filter((p) => p.cantidad > 0).length} con contenido` },
              { l: "Elecciones", v: num(elecciones.filter((e) => e.cantidad > 0).length), d: `cargadas de ${elecciones.length}` },
              { l: "Registros", v: num(filas), d: "en todas las tablas" },
            ].map((k) => (
              <div key={k.l} className="rounded-2xl border border-border bg-surface p-3">
                <p className="text-lg font-bold tabular-nums sm:text-2xl">{k.v}</p>
                <p className="text-xs font-semibold">{k.l}</p>
                <p className="text-[11px] text-muted-foreground">{k.d}</p>
              </div>
            ))}
          </div>

          {datos.sqlFaltante && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1 basis-64">Hay <strong>{faltan}</strong> {faltan === 1 ? "tabla" : "tablas"} sin crear. Copia el SQL que falta (ya va en el orden correcto, con lo que cada módulo necesita antes) y ejecútalo una sola vez en el editor SQL de Supabase.</p>
              <button type="button" onClick={() => copiar("todo", datos.sqlFaltante ?? "")} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground">{copiado === "todo" ? <Check className="size-4" /> : <Copy className="size-4" />}{copiado === "todo" ? "Copiado" : "Copiar el SQL que falta"}</button>
              {datos.editorSql && <a href={datos.editorSql} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs font-semibold underline">Abrir el editor SQL <ExternalLink className="size-3.5" /></a>}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="min-w-0 overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-border">
              <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${W} ${grafo.alto}`} className="block h-auto w-full min-w-[700px]" role="img" aria-label="Mapa de lo que hay guardado en Supabase">
                  {/* de la base a cada módulo */}
                  {grafo.mods.map((m) => {
                    const x1 = X_BASE + 46;
                    const x2 = X_MODULO - ANCHO_MODULO / 2;
                    const xm = (x1 + x2) / 2;
                    return <path key={`b-${m.modulo.id}`} d={`M${x1} ${grafo.alto / 2} C${xm} ${grafo.alto / 2} ${xm} ${m.y} ${x2} ${m.y}`} fill="none" stroke={COLOR[m.modulo.id]} strokeOpacity={0.55} strokeWidth={1.6} className="mapa-arista" />;
                  })}
                  {/* de cada módulo a lo que tiene dentro */}
                  {grafo.entidades.map((n) => {
                    const m = grafo.mods.find((x) => x.modulo.id === n.modulo)!;
                    const x1 = X_MODULO + ANCHO_MODULO / 2;
                    const x2 = X_ENTIDAD - n.r;
                    const xm = (x1 + x2) / 2;
                    return <path key={`e-${n.clave}`} d={`M${x1} ${m.y} C${xm} ${m.y} ${xm} ${n.y} ${x2} ${n.y}`} fill="none" stroke={COLOR[n.modulo]} strokeOpacity={n.relleno ? 0.5 : 0.18} strokeWidth={1.2} className={n.relleno ? "mapa-arista" : undefined} />;
                  })}

                  {/* lo que hay dentro */}
                  {grafo.entidades.map((n) => {
                    const activo = sel?.modulo === n.modulo && sel.entidad === n.entidad.id;
                    return (
                      <g key={n.clave} onClick={() => setSel({ modulo: n.modulo, entidad: n.entidad.id })} className="cursor-pointer" role="button" aria-label={`${n.entidad.nombre}: ${n.entidad.resumen}`}>
                        <rect x={X_ENTIDAD - n.r - 6} y={n.y - FILA / 2 + 3} width={W - X_ENTIDAD + n.r} height={FILA - 6} rx={10} fill={activo ? "#ffffff" : "transparent"} fillOpacity={0.08} />
                        <circle cx={X_ENTIDAD} cy={n.y} r={n.r} fill={n.relleno ? COLOR[n.modulo] : "none"} fillOpacity={0.9} stroke={activo ? "#fff" : COLOR[n.modulo]} strokeWidth={activo ? 3 : 1.6} strokeDasharray={n.relleno ? undefined : "3 3"} />
                        <text x={X_ENTIDAD + n.r + 12} y={n.y - 3} className="fill-white text-[14px] font-semibold">{n.entidad.nombre.length > 38 ? `${n.entidad.nombre.slice(0, 37)}…` : n.entidad.nombre}</text>
                        <text x={X_ENTIDAD + n.r + 12} y={n.y + 14} className="fill-slate-300 text-[11.5px]">{n.entidad.resumen.length > 54 ? `${n.entidad.resumen.slice(0, 53)}…` : n.entidad.resumen}</text>
                      </g>
                    );
                  })}

                  {/* los módulos */}
                  {grafo.mods.map((m) => {
                    const activo = (sel?.modulo ?? grafo.mods[0].modulo.id) === m.modulo.id;
                    const cuantos = m.modulo.entidades.length;
                    return (
                      <g key={m.modulo.id} onClick={() => setSel({ modulo: m.modulo.id })} className="cursor-pointer" role="button" aria-label={m.modulo.nombre}>
                        <rect x={X_MODULO - ANCHO_MODULO / 2} y={m.y - 24} width={ANCHO_MODULO} height={48} rx={24} fill="#0f172a" stroke={COLOR[m.modulo.id]} strokeWidth={activo ? 3.5 : 2} strokeDasharray={m.faltan ? "5 4" : undefined} />
                        <text x={X_MODULO} y={m.y - 2} textAnchor="middle" className="fill-white text-[14px] font-bold">{m.modulo.nombre}</text>
                        <text x={X_MODULO} y={m.y + 14} textAnchor="middle" className="fill-slate-300 text-[11px]">{m.faltan && cuantos === 0 ? "faltan tablas" : `${cuantos} ${UNIDAD[m.modulo.id] ?? "elemento"}${cuantos === 1 ? "" : "s"}`}</text>
                      </g>
                    );
                  })}

                  {/* la base */}
                  <circle cx={X_BASE} cy={grafo.alto / 2} r={46} fill="#0f172a" stroke="#34d399" strokeWidth={3.5} />
                  <text x={X_BASE} y={grafo.alto / 2 - 6} textAnchor="middle" className="fill-white text-[14px] font-bold">Supabase</text>
                  <text x={X_BASE} y={grafo.alto / 2 + 10} textAnchor="middle" className="fill-emerald-300 text-[11px] font-semibold">{num(filas)}</text>
                  <text x={X_BASE} y={grafo.alto / 2 + 23} textAnchor="middle" className="fill-emerald-300/80 text-[9.5px]">registros</text>
                </svg>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 px-4 py-2 text-[11px] text-slate-300">
                <span>Punto grande = más contenido</span>
                <span>Punto hueco = todavía sin datos</span>
                <span>Borde punteado = faltan tablas por crear</span>
              </p>
            </div>

            {moduloActual && (
              <aside className="min-w-0 space-y-3 rounded-2xl border border-border bg-surface p-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold"><span className="size-3 rounded-full" style={{ background: COLOR[moduloActual.id] }} />{moduloActual.nombre}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">SQL: {moduloActual.archivo}</p>
                </div>

                {entidadActual && (
                  <div className="rounded-xl bg-surface-muted p-3 text-xs">
                    <p className="text-sm font-semibold">{entidadActual.nombre}</p>
                    <p className="mt-0.5 text-muted-foreground">{entidadActual.resumen}</p>
                    {entidadActual.hijos.length > 0 && (
                      <ul className="mt-2 divide-y divide-border">
                        {entidadActual.hijos.map((h) => <li key={h.nombre} className="flex justify-between gap-2 py-1"><span className="min-w-0 truncate">{h.nombre}</span><span className="tabular-nums font-semibold">{num(h.cantidad)}</span></li>)}
                      </ul>
                    )}
                  </div>
                )}

                {moduloActual.entidades.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Qué hay dentro ({moduloActual.entidades.length})</p>
                    <ul className="mt-1 divide-y divide-border text-xs">
                      {moduloActual.entidades.map((e) => (
                        <li key={e.id}>
                          <button type="button" onClick={() => setSel({ modulo: moduloActual.id, entidad: e.id })} className={`block w-full py-2 text-left hover:text-brand ${entidadActual?.id === e.id ? "font-semibold" : ""}`}>
                            <span className="block truncate">{e.nombre}</span>
                            <span className="block truncate text-[11px] font-normal text-muted-foreground">{e.resumen}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <details className="rounded-xl border border-border p-2 text-xs">
                  <summary className="cursor-pointer font-semibold">Tablas de este módulo ({moduloActual.tablas.length})</summary>
                  <ul className="mt-2 divide-y divide-border">
                    {moduloActual.tablas.map((t) => (
                      <li key={t.tabla} className="flex items-center justify-between gap-2 py-1.5" title={t.sirve}>
                        <span className="min-w-0 truncate">{t.tabla}</span>
                        {t.filas === null ? <span className="inline-flex shrink-0 items-center gap-1 text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3" />sin crear</span> : <span className="tabular-nums">{num(t.filas)}</span>}
                      </li>
                    ))}
                  </ul>
                </details>

                {moduloActual.sql && (
                  <button type="button" onClick={() => copiar(moduloActual.id, moduloActual.sql ?? "")} className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-500/10 dark:text-amber-200">
                    {copiado === moduloActual.id ? <Check className="size-3" /> : <Copy className="size-3" />}{copiado === moduloActual.id ? "Copiado" : "Copiar el SQL de este módulo"}
                  </button>
                )}
              </aside>
            )}
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground"><Database className="mt-0.5 size-3 shrink-0" aria-hidden="true" /><span>Los trozos de un documento son cómo se parte para poder buscar dentro de él: se cuentan dentro del documento. Las cifras de tablas muy grandes son estimadas por Supabase.</span></p>
        </>
      )}
    </div>
  );
}
