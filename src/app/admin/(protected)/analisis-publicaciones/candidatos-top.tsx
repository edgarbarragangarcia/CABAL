"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";

import { titulo } from "./nombres";

type Fila = { ambito: string; ambito_nombre: string; partido: string; candidato: string; cedula: string | null; votos: number; pct: string };

/**
 * Los candidatos más votados del cargo (concejales, ediles…) en el país o en el departamento elegido. Se ve cuando el mapa está en un
 * nivel donde todavía no se eligen (el candidato vive en el municipio): así no hay que abrir los 1.102 concejos uno por uno.
 */
export function CandidatosTop({ eleccion, corporacion, nombreCargo, nivel, prefijo, lugar }: { eleccion: string; corporacion: string; nombreCargo: string; nivel: number; prefijo: string; lugar: string }) {
  const [q, setQ] = React.useState("");
  const [qFiltro, setQFiltro] = React.useState("");
  const [limite, setLimite] = React.useState(50);
  const [res, setRes] = React.useState<{ clave: string; filas?: Fila[]; error?: string } | null>(null);
  const clave = `${eleccion}|${corporacion}|${nivel}|${prefijo}|${qFiltro}|${limite}`;

  React.useEffect(() => {
    const t = window.setTimeout(() => setQFiltro(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    let vivo = true;
    const url = `/api/admin/elecciones/candidatos?${new URLSearchParams({ eleccion, corporacion, nivel: String(nivel), prefijo, q: qFiltro, limite: String(limite) })}`;
    fetch(url)
      .then(async (r) => ({ ok: r.ok, j: (await r.json().catch(() => ({}))) as { candidatos?: Fila[]; error?: string } }))
      .then(({ ok, j }) => vivo && setRes({ clave, ...(ok ? { filas: j.candidatos ?? [] } : { error: j.error ?? "No se pudo leer." }) }))
      .catch(() => vivo && setRes({ clave, error: "Sin conexión con el servidor." }));
    return () => { vivo = false; };
  }, [clave, eleccion, corporacion, nivel, prefijo, qFiltro, limite]);

  const listo = res?.clave === clave ? res : null;
  const fmt = (n: number) => n.toLocaleString("es-CO");

  return (
    <section className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold">{nombreCargo} más votados <span className="font-normal text-muted-foreground">· {lugar}</span></h3>
        <span className="text-xs text-muted-foreground">Votos del preconteo, por candidato</span>
      </div>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un candidato por nombre" className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30" />
      </div>
      {!listo && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Buscando candidatos…</p>}
      {listo?.error && <p className="mt-3 text-sm text-red-700">{listo.error}</p>}
      {listo?.filas && listo.filas.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No hay candidatos con ese nombre.</p>}
      {listo?.filas && listo.filas.length > 0 && (
        <>
          <ol className="mt-3 max-h-[28rem] divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {listo.filas.map((f, i) => (
              <li key={`${f.ambito}-${f.cedula ?? f.candidato}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{titulo(f.candidato)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{titulo(f.partido)} · {titulo(f.ambito_nombre)}</span>
                </span>
                <span className="shrink-0 text-right"><span className="block font-bold tabular-nums">{fmt(f.votos)}</span><span className="block text-[11px] text-muted-foreground">{f.pct}</span></span>
              </li>
            ))}
          </ol>
          {listo.filas.length >= limite && limite < 500 && <button type="button" onClick={() => setLimite((l) => Math.min(500, l + 100))} className="mt-3 rounded-full border border-border px-4 py-1.5 text-xs font-semibold hover:bg-surface-muted">Ver más</button>}
        </>
      )}
    </section>
  );
}
