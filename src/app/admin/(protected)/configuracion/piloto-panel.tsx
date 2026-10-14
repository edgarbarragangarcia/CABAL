"use client";

import * as React from "react";
import { Gauge } from "lucide-react";

import type { RegistroPiloto, ResumenPiloto } from "@/lib/piloto";

import { usePeticion } from "../analisis-publicaciones/peticion";

type Resp = { disponible: boolean; sql?: string; registros: RegistroPiloto[]; resumen: ResumenPiloto };
const AREAS: Record<string, string> = { investigacion: "Investigación", contenidos: "Contenidos", formacion: "Formación", juridico: "Jurídico", territorial: "Territorial", otra: "Otra" };
const campo = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm";
const horas = (min: number) => `${(min / 60).toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`;

/** Bitácora del piloto de IA: cada tarea con su tiempo, costo y precisión, y los totales para decidir qué ampliar. */
export function PilotoPanel() {
  const [v, setV] = React.useState(0);
  const r = usePeticion<Resp>(`/api/admin/piloto?v=${v}`);
  const [f, setF] = React.useState({ tarea: "", area: "otra", sin: "", con: "", costo: "", precision: "", errores: "0", nota: "" });
  const [error, setError] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOcupado(true);
    try {
      const res = await fetch("/api/admin/piloto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarea: f.tarea, area: f.area, minutos_sin_ia: Number(f.sin), minutos_con_ia: Number(f.con), costo_cop: Number(f.costo || 0), precision: f.precision ? Number(f.precision) : null, errores: Number(f.errores || 0), nota: f.nota || null }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "No se pudo guardar.");
      setF({ ...f, tarea: "", sin: "", con: "", costo: "", precision: "", errores: "0", nota: "" });
      setV((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Gauge className="size-4 text-brand" aria-hidden="true" />Piloto de IA: precisión, tiempo y costo</h2>
      <p className="mt-1 text-sm text-muted-foreground">Anota cada tarea que se hizo con apoyo de la IA. Con los totales se decide qué aplicaciones ampliar y cuáles no.</p>
      {r.estado === "cargando" && <p className="mt-3 text-sm text-muted-foreground">Leyendo…</p>}
      {r.estado === "error" && <p className="mt-3 text-sm text-red-700">{r.error}</p>}
      {r.estado === "listo" && !r.data.disponible && (
        <div className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold">Falta crear la tabla de la bitácora en Supabase.</p>
          {r.data.sql && <textarea readOnly value={r.data.sql} rows={7} className={`${campo} mt-2 font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />}
        </div>
      )}
      {r.estado === "listo" && r.data.disponible && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Tareas", String(r.data.resumen.registros)],
              ["Tiempo ahorrado", horas(r.data.resumen.minutosAhorrados)],
              ["Costo", `$${r.data.resumen.costoCop.toLocaleString("es-CO")}`],
              ["Precisión", r.data.resumen.precisionPromedio === null ? "—" : `${r.data.resumen.precisionPromedio.toFixed(1)} / 5`],
            ].map(([t, valor]) => (
              <div key={t} className="rounded-xl bg-surface-muted p-3"><p className="text-xs text-muted-foreground">{t}</p><p className="text-xl font-semibold tabular-nums">{valor}</p></div>
            ))}
          </div>
          {r.data.resumen.porArea.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Por área: {r.data.resumen.porArea.map((a) => `${AREAS[a.area] ?? a.area} ${horas(a.minutosAhorrados)} (${a.registros})`).join(" · ")} · {r.data.resumen.errores} errores detectados.</p>}

          <form onSubmit={enviar} className="mt-4 grid gap-2 sm:grid-cols-6">
            <input required className={`${campo} sm:col-span-3`} placeholder="Tarea (p. ej. resumen de acta)" value={f.tarea} onChange={(e) => setF({ ...f, tarea: e.target.value })} maxLength={200} />
            <select className={`${campo} sm:col-span-1`} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>{Object.entries(AREAS).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
            <input required type="number" min={0} className={campo} placeholder="Min sin IA" value={f.sin} onChange={(e) => setF({ ...f, sin: e.target.value })} />
            <input required type="number" min={0} className={campo} placeholder="Min con IA" value={f.con} onChange={(e) => setF({ ...f, con: e.target.value })} />
            <input type="number" min={0} className={campo} placeholder="Costo (COP)" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} />
            <select className={campo} value={f.precision} onChange={(e) => setF({ ...f, precision: e.target.value })}><option value="">Precisión…</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select>
            <input type="number" min={0} className={campo} placeholder="Errores" value={f.errores} onChange={(e) => setF({ ...f, errores: e.target.value })} />
            <input className={`${campo} sm:col-span-2`} placeholder="Nota (opcional)" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} maxLength={500} />
            <button type="submit" disabled={ocupado} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60">Anotar</button>
          </form>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

          <ul className="mt-4 max-h-72 divide-y divide-border overflow-y-auto text-sm">
            {r.data.registros.length === 0 && <li className="py-3 text-muted-foreground">Todavía no hay tareas anotadas.</li>}
            {r.data.registros.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1"><strong>{x.tarea}</strong><span className="block text-xs text-muted-foreground">{x.fecha} · {AREAS[x.area] ?? x.area} · {x.minutos_sin_ia} → {x.minutos_con_ia} min · ${Number(x.costo_cop).toLocaleString("es-CO")}{x.precision ? ` · precisión ${x.precision}/5` : ""}{x.errores ? ` · ${x.errores} errores` : ""}{x.usuario ? ` · ${x.usuario}` : ""}</span></span>
                <button type="button" onClick={() => void fetch(`/api/admin/piloto?id=${x.id}`, { method: "DELETE" }).then(() => setV((n) => n + 1))} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">Quitar</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
