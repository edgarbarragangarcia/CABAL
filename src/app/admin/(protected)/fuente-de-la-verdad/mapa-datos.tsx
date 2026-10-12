"use client";

import * as React from "react";
import { AlertTriangle, Check, Copy, Database, ExternalLink, RefreshCw } from "lucide-react";

import type { ModuloMapa, RespuestaMapa, TablaMapa } from "@/lib/gestor/mapa";

import { usePeticion } from "../analisis-publicaciones/peticion";

/**
 * El mapa de Supabase como una red: al centro la base, alrededor cada módulo del panel y de ellos salen sus tablas. El tamaño
 * de cada nodo crece con sus filas; los huecos punteados son tablas que aún no existen (falta ejecutar su SQL).
 */

const COLOR: Record<string, string> = { electoral: "#10b981", documentos: "#0ea5e9", monitoreo: "#f43f5e", territorio: "#f59e0b", comunidad: "#a855f7", portales: "#14b8a6" };
// Ángulo (grados, 0 = derecha) de cada módulo alrededor del centro: Portales, con 14 tablas, queda a un lado con espacio.
const ANGULO: Record<string, number> = { portales: 160, monitoreo: 88, territorio: 52, comunidad: 5, electoral: 322, documentos: 250 };
const W = 1000;
const H = 720;
const CX = W / 2;
const CY = H / 2;
const R_HUB = 175;

const num = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-CO"));
const radio = (filas: number | null) => (filas === null ? 7 : 7 + Math.min(11, Math.log10(filas + 1) * 2.2));
const polar = (grados: number, r: number) => ({ x: CX + r * Math.cos((grados * Math.PI) / 180), y: CY + r * Math.sin((grados * Math.PI) / 180) });

type Nodo = { modulo: ModuloMapa; tabla: TablaMapa; x: number; y: number; r: number; ancla: boolean };

function distribuir(modulos: ModuloMapa[]) {
  const hubs = modulos.map((m) => ({ modulo: m, ...polar(ANGULO[m.id] ?? 0, R_HUB), ang: ANGULO[m.id] ?? 0 }));
  const nodos: Nodo[] = [];
  for (const h of hubs) {
    const n = h.modulo.tablas.length;
    const span = Math.min(110, 16 + n * 10);
    h.modulo.tablas.forEach((t, i) => {
      const a = n === 1 ? h.ang : h.ang - span / 2 + (span * i) / (n - 1);
      const p = polar(a, R_HUB + (n > 6 ? (i % 2 ? 150 : 95) : 100)); // dos anillos cuando hay muchas tablas
      // Las tablas salen desde el centro hacia afuera pero se anclan al hub: se reubican alrededor de él.
      const d = Math.hypot(p.x - CX, p.y - CY) - R_HUB;
      const q = { x: h.x + d * Math.cos((a * Math.PI) / 180), y: h.y + d * Math.sin((a * Math.PI) / 180) };
      nodos.push({ modulo: h.modulo, tabla: t, x: q.x, y: q.y, r: radio(t.filas), ancla: t.tabla === h.modulo.ancla });
    });
  }
  return { hubs, nodos };
}

export function MapaDatos() {
  const [v, setV] = React.useState(0);
  const r = usePeticion<RespuestaMapa>(`/api/admin/gestor/mapa${v ? `?v=${v}` : ""}`);
  const datos = r.estado === "listo" ? r.data : undefined;
  const [sel, setSel] = React.useState<{ modulo: string; tabla?: string } | null>(null);
  const [copiado, setCopiado] = React.useState<string | null>(null);
  const copiar = (clave: string, texto: string) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(clave);
    setTimeout(() => setCopiado(null), 1600);
  };

  const { hubs, nodos } = React.useMemo(() => (datos ? distribuir(datos.modulos) : { hubs: [], nodos: [] }), [datos]);
  const actual = datos ? datos.modulos.find((m) => m.id === (sel?.modulo ?? datos.modulos[0]?.id)) : undefined;
  const tablaSel = actual?.tablas.find((t) => t.tabla === sel?.tabla);

  const todas = datos?.modulos.flatMap((m) => m.tablas) ?? [];
  const conDatos = todas.filter((t) => (t.filas ?? 0) > 0).length;
  const faltan = todas.filter((t) => t.filas === null).length;
  const filas = todas.reduce((s, t) => s + (t.filas ?? 0), 0);

  return (
    <div className="space-y-4">
      <style>{`@keyframes mapa-pulso{to{stroke-dashoffset:-24}}@keyframes mapa-late{0%,100%{opacity:.55}50%{opacity:1}}.mapa-arista{stroke-dasharray:3 9;animation:mapa-pulso 2.4s linear infinite}.mapa-nodo{animation:mapa-late 3.2s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.mapa-arista,.mapa-nodo{animation:none}}`}</style>
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">Todo lo que guarda el panel en Supabase, por módulo. Toca un módulo o una tabla para ver qué contiene.</p>
        <button type="button" onClick={() => setV((n) => n + 1)} disabled={r.estado === "cargando"} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">
          <RefreshCw className={`size-3 ${r.estado === "cargando" ? "animate-spin" : ""}`} aria-hidden="true" /> Actualizar
        </button>
      </div>
      {r.estado === "error" && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-600">{r.error}</p>}
      {r.estado === "cargando" && !datos && <p className="text-sm text-muted-foreground">Leyendo Supabase…</p>}
      {datos && !datos.conectado && <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">Supabase no está conectado en este entorno (faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).</p>}

      {datos && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            {[
              { l: "Tablas con datos", v: `${conDatos} de ${todas.length}` },
              { l: "Filas guardadas", v: num(filas) },
              { l: "Tablas por crear", v: String(faltan) },
            ].map((k) => (
              <div key={k.l} className="rounded-2xl border border-border bg-surface p-3">
                <p className="text-lg font-bold tabular-nums sm:text-2xl">{k.v}</p>
                <p className="text-[11px] text-muted-foreground">{k.l}</p>
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-border">
              <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Mapa de las tablas guardadas en Supabase">
                {hubs.map((h) => (
                  <line key={`c-${h.modulo.id}`} x1={CX} y1={CY} x2={h.x} y2={h.y} stroke={COLOR[h.modulo.id]} strokeOpacity={0.55} strokeWidth={1.5} className="mapa-arista" />
                ))}
                {nodos.map((n) => {
                  const h = hubs.find((x) => x.modulo.id === n.modulo.id)!;
                  return <line key={`e-${n.tabla.tabla}`} x1={h.x} y1={h.y} x2={n.x} y2={n.y} stroke={COLOR[n.modulo.id]} strokeOpacity={n.tabla.filas === null ? 0.15 : 0.4} strokeWidth={1} className={n.tabla.filas === null ? undefined : "mapa-arista"} />;
                })}
                {nodos.map((n) => {
                  const activo = sel?.tabla === n.tabla.tabla;
                  const falta = n.tabla.filas === null;
                  return (
                    <g key={n.tabla.tabla} onClick={() => setSel({ modulo: n.modulo.id, tabla: n.tabla.tabla })} className="cursor-pointer" role="button" aria-label={`${n.tabla.tabla}: ${num(n.tabla.filas)} filas`}>
                      <circle cx={n.x} cy={n.y} r={n.r + 8} fill="transparent" />
                      <circle cx={n.x} cy={n.y} r={n.r} fill={falta ? "none" : COLOR[n.modulo.id]} fillOpacity={falta ? 0 : n.tabla.filas ? 0.9 : 0.35} stroke={activo ? "#fff" : COLOR[n.modulo.id]} strokeWidth={activo ? 2.5 : 1.5} strokeDasharray={falta ? "3 3" : undefined} className={falta ? undefined : "mapa-nodo"} />
                      {(activo || n.ancla || n.r > 13) && <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" className="fill-white/80 text-[10px]">{n.tabla.tabla.replace(/^portal_|^documento_/, "")}</text>}
                    </g>
                  );
                })}
                {hubs.map((h) => {
                  const activo = (sel?.modulo ?? datos.modulos[0]?.id) === h.modulo.id;
                  return (
                    <g key={h.modulo.id} onClick={() => setSel({ modulo: h.modulo.id })} className="cursor-pointer" role="button" aria-label={h.modulo.nombre}>
                      <circle cx={h.x} cy={h.y} r={24} fill="#0f172a" stroke={COLOR[h.modulo.id]} strokeWidth={activo ? 4 : 2.5} />
                      <text x={h.x} y={h.y + 4} textAnchor="middle" className="fill-white text-[11px] font-bold">{h.modulo.tablas.length}</text>
                      <text x={h.x} y={h.y - 32} textAnchor="middle" className="fill-white text-[13px] font-semibold">{h.modulo.nombre}</text>
                    </g>
                  );
                })}
                <circle cx={CX} cy={CY} r={42} fill="#0f172a" stroke="#34d399" strokeWidth={3} className="mapa-nodo" />
                <text x={CX} y={CY - 2} textAnchor="middle" className="fill-white text-[13px] font-bold">Supabase</text>
                <text x={CX} y={CY + 14} textAnchor="middle" className="fill-emerald-300 text-[10px]">{num(filas)} filas</text>
              </svg>
              <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 px-4 py-2 text-[11px] text-slate-300">
                <span>Nodo grande = más filas</span>
                <span>Línea punteada y hueco = tabla sin crear</span>
                <span>El número en el módulo = cuántas tablas tiene</span>
              </p>
            </div>

            {actual && (
              <aside className="min-w-0 rounded-2xl border border-border bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><span className="size-3 rounded-full" style={{ background: COLOR[actual.id] }} />{actual.nombre}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">SQL: {actual.archivo}</p>
                {actual.sql && (
                  <button type="button" onClick={() => copiar(actual.id, actual.sql ?? "")} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-500/10 dark:text-amber-200">
                    {copiado === actual.id ? <Check className="size-3" /> : <Copy className="size-3" />}{copiado === actual.id ? "Copiado" : "Copiar el SQL de este módulo"}
                  </button>
                )}
                {tablaSel && (
                  <p className="mt-3 rounded-xl bg-surface-muted p-3 text-xs"><strong>{tablaSel.tabla}</strong><br />{tablaSel.sirve}<br /><span className="text-muted-foreground">{tablaSel.filas === null ? "La tabla no existe todavía." : `${num(tablaSel.filas)} filas`}</span></p>
                )}
                <ul className="mt-3 divide-y divide-border text-xs">
                  {actual.tablas.map((t) => (
                    <li key={t.tabla}>
                      <button type="button" onClick={() => setSel({ modulo: actual.id, tabla: t.tabla })} className={`flex w-full items-center justify-between gap-2 py-2 text-left hover:text-brand ${tablaSel?.tabla === t.tabla ? "font-semibold" : ""}`}>
                        <span className="min-w-0 truncate">{t.tabla}</span>
                        {t.filas === null ? <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3" />sin crear</span> : <span className="tabular-nums">{num(t.filas)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>

                {actual.id === "documentos" && (
                  <div className="mt-3 border-t border-border pt-3 text-xs">
                    <p className="font-semibold">Carpetas</p>
                    {datos.detalle.carpetas.length === 0 && datos.detalle.sinCarpeta === 0 ? <p className="text-muted-foreground">Aún no hay documentos.</p> : (
                      <ul className="mt-1 space-y-1">
                        {datos.detalle.carpetas.map((c) => <li key={c.nombre} className="flex justify-between"><span>{c.nombre}</span><span className="tabular-nums">{c.documentos}</span></li>)}
                        <li className="flex justify-between text-muted-foreground"><span>Sin carpeta</span><span className="tabular-nums">{datos.detalle.sinCarpeta}</span></li>
                      </ul>
                    )}
                  </div>
                )}
                {actual.id === "electoral" && datos.detalle.elecciones.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3 text-xs">
                    <p className="font-semibold">Elecciones guardadas</p>
                    <ul className="mt-1 space-y-1">
                      {datos.detalle.elecciones.slice(0, 12).map((e) => <li key={`${e.eleccion}${e.corporacion}`} className="flex justify-between gap-2"><span className="min-w-0 truncate">{e.eleccion} · {e.corporacion}</span><span className="tabular-nums">{num(e.guardados)}</span></li>)}
                    </ul>
                  </div>
                )}
                {actual.id === "monitoreo" && datos.detalle.personajes.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3 text-xs">
                    <p className="font-semibold">Por político</p>
                    <ul className="mt-1 space-y-1">
                      {datos.detalle.personajes.map((p) => <li key={p.personaje} className="flex justify-between"><span>{p.personaje}</span><span className="tabular-nums">{p.items} · la nombran {p.nombran}</span></li>)}
                    </ul>
                  </div>
                )}
              </aside>
            )}
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground"><Database className="mt-0.5 size-3 shrink-0" aria-hidden="true" /><span>Las cifras de tablas muy grandes son estimadas por Supabase. Las tablas sin crear se activan ejecutando su archivo SQL en Supabase › SQL Editor.</span></p>
        </>
      )}
    </div>
  );
}
