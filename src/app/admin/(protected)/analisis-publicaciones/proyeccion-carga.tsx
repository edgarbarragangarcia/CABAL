"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

const n = (v: number) => Math.round(v).toLocaleString("es-CO");

type Estado = { filas: number; esperadas: number; porAnio: Record<string, number>; partes: number };

/** Cuando la población del DANE aún no está en Supabase: se carga con un botón o con los archivos SQL. */
export function PanelCarga({ alCargar, mensaje }: { alCargar: () => void; mensaje: string }) {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [error, setError] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const leer = React.useCallback(() => {
    fetch("/api/admin/proyeccion/cargar", { cache: "no-store" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "No se pudo leer el estado."); setEstado(j as Estado); }).catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(() => { leer(); }, [leer]);
  const cargar = async () => {
    setError(""); setCargando(true);
    try {
      const r = await fetch("/api/admin/proyeccion/cargar", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "No se pudo cargar.");
      alCargar();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar."); leer(); } finally { setCargando(false); }
  };
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-base font-semibold">Falta cargar la población del DANE en Supabase</h3>
      <p className="text-sm text-muted-foreground">{mensaje}</p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Si no lo has hecho, corre <b>supabase/proyeccion.sql</b> en el SQL Editor de Supabase (crea la tabla y la función).</li>
        <li>Carga los datos con el botón, o pega los archivos SQL de abajo en el SQL Editor, uno por uno.</li>
      </ol>
      {estado && <p className="text-sm">Cargadas en Supabase: <b>{n(estado.filas)}</b> de {n(estado.esperadas)} filas (municipio × año, con las 101 edades de hombres y de mujeres).</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void cargar()} disabled={cargando} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60">{cargando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Cargar los datos del DANE a Supabase</button>
      </div>
      {estado && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Descargar el SQL ({estado.partes} partes)</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">{Array.from({ length: estado.partes }, (_, i) => <a key={i} href={`/api/admin/proyeccion/cargar?sql=${i + 1}`} download className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted">Parte {i + 1}</a>)}</div>
        </details>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}

