"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";

import type { Camara } from "@/lib/camaras/almacen";

import { usePeticion } from "../analisis-publicaciones/peticion";

type Resp = { disponible: boolean; sql?: string; camaras: Camara[]; codigos: string[] };
const n = (v: number) => v.toLocaleString("es-CO");

/** Cámaras de comercio del país (RUES) guardadas en Supabase, con el botón para traerlas de datos.gov.co. */
export function CamarasFuente({ alCargar }: { alCargar: () => void }) {
  const [v, setV] = React.useState(0);
  const r = usePeticion<Resp>(`/api/admin/camaras?v=${v}`);
  const [avance, setAvance] = React.useState<{ hechas: number; total: number; actual: string; error?: string } | null>(null);
  const [corriendo, setCorriendo] = React.useState(false);
  const parar = React.useRef(false);
  const [q, setQ] = React.useState("");

  async function traer(codigos: string[]) {
    parar.current = false;
    setCorriendo(true);
    let hechas = 0;
    for (const codigo of codigos) {
      if (parar.current) break;
      setAvance({ hechas, total: codigos.length, actual: codigo });
      let ok = false;
      let motivo = "";
      for (let intento = 0; intento < 3 && !ok && !parar.current; intento++) {
        try {
          const res = await fetch("/api/admin/camaras", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo }) });
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.ok) ok = true;
          else motivo = j.error ?? `Error ${res.status}`;
        } catch {
          motivo = "Sin conexión con el servidor.";
        }
      }
      if (!ok) {
        setAvance({ hechas, total: codigos.length, actual: codigo, error: `La cámara ${codigo} no se pudo traer: ${motivo}` });
        break;
      }
      hechas++;
      setAvance({ hechas, total: codigos.length, actual: codigo });
    }
    setCorriendo(false);
    setV((x) => x + 1);
    alCargar();
  }

  if (r.estado === "cargando") return <p className="p-4 text-sm text-muted-foreground">Leyendo las cámaras…</p>;
  if (r.estado === "error") return <p className="p-4 text-sm text-red-700">{r.error}</p>;
  const d = r.data;
  const guardadas = new Set(d.camaras.map((c) => c.codigo));
  const faltan = d.codigos.filter((c) => !guardadas.has(c));
  const filtro = q.trim().toLowerCase();
  const lista = d.camaras.filter((c) => !filtro || `${c.nombre} ${c.sede} ${c.departamento}`.toLowerCase().includes(filtro));
  const totalActivas = d.camaras.reduce((s, c) => s + c.activas, 0);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h3 className="font-semibold">Cámaras de comercio</h3>
        <p className="text-sm text-muted-foreground">
          {d.camaras.length} de {d.codigos.length} cámaras guardadas · {n(totalActivas)} matrículas activas. Fuente: RUES (Confecámaras) en datos.gov.co. Las cifras son por cámara: su jurisdicción puede cubrir varios municipios.
        </p>
      </div>
      {!d.disponible && (
        <div className="rounded-xl bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold">Falta crear la tabla de cámaras de comercio en Supabase.</p>
          {d.sql && <textarea readOnly value={d.sql} rows={7} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />}
        </div>
      )}
      {d.disponible && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={corriendo} onClick={() => void traer(faltan.length ? faltan : d.codigos)} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground disabled:opacity-60">
            {corriendo ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
            {corriendo ? `Trayendo… ${avance?.hechas ?? 0}/${avance?.total ?? 0}` : faltan.length ? `Traer las ${faltan.length} cámaras que faltan` : "Actualizar las 58 cámaras"}
          </button>
          {corriendo && <button type="button" onClick={() => { parar.current = true; }} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">Detener</button>}
          {avance?.error && <span className="text-xs text-red-700">{avance.error}</span>}
        </div>
      )}
      {d.camaras.length > 0 && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por cámara, ciudad o departamento…" className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm" />
          <div className="max-h-[32rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-xs text-muted-foreground">
                <tr><th className="py-1.5">Cámara</th><th>Sede</th><th className="text-right">Activas</th><th className="text-right">Personas naturales</th><th className="text-right">Sociedades</th><th className="text-right">Sin ánimo de lucro</th><th className="text-right">Establecimientos</th></tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.codigo} className="border-t border-border/60">
                    <td className="py-1.5 font-medium">{c.nombre}</td>
                    <td className="text-muted-foreground">{c.sede}{c.departamento ? ` · ${c.departamento}` : ""}</td>
                    <td className="text-right tabular-nums">{n(c.activas)}</td>
                    <td className="text-right tabular-nums">{n(c.personas_naturales)}</td>
                    <td className="text-right tabular-nums">{n(c.sociedades)}</td>
                    <td className="text-right tabular-nums">{n(c.esadl)}</td>
                    <td className="text-right tabular-nums">{n(c.establecimientos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
