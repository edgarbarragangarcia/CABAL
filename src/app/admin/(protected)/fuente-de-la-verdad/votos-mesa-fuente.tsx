"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

const n = (v: number) => Math.round(v).toLocaleString("es-CO");

type Fila = { anio: number; etapa: string; candidato: string; departamento: string; municipios: number; mesas: number; votos: number };
type Respuesta = { filas: Fila[]; mesas: number; votos: number };

/** Los votos por mesa de María Fernanda Cabal (Senado 2022, después de escrutinio) guardados en Supabase, resumidos por departamento. */
export function VotosMesaFuente() {
  const [datos, setDatos] = React.useState<Respuesta | null>(null);
  const [error, setError] = React.useState("");
  const [sql, setSql] = React.useState("");
  const [copiado, setCopiado] = React.useState(false);
  const leer = React.useCallback(() => {
    fetch("/api/admin/votos-mesa", { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) { setSql(j.sql ?? ""); throw new Error(j.error ?? "No se pudo leer."); } setError(""); setSql(""); setDatos(j as Respuesta); })
      .catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(() => { leer(); }, [leer]);

  if (error) {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>
        {sql && (
          <>
            <button type="button" onClick={() => navigator.clipboard.writeText(sql).then(() => setCopiado(true))} className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white">{copiado ? "SQL copiado" : "Copiar el SQL"}</button>
            <p className="text-xs text-muted-foreground">Después, en la terminal: <code>node scripts/cargar-votos-mesa.mjs votos-mesa-maria-fernanda-cabal.csv 2022 escrutinio</code></p>
          </>
        )}
      </div>
    );
  }
  if (!datos) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Leyendo…</p>;
  const tarjeta = "rounded-2xl border border-border bg-surface p-4 shadow-sm";
  const max = Math.max(1, ...datos.filas.map((f) => Number(f.votos)));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Los votos de <b>María Fernanda Cabal</b> al Senado en 2022, <b>después de escrutinio</b>, mesa por mesa (tabla <b>votos_mesa</b> de Supabase). Viene del Excel «VOTACIÓN MARIA_FERNANDA_CABAL».
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Votos</p><p className="mt-1 text-xl font-bold tabular-nums">{n(datos.votos)}</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Mesas</p><p className="mt-1 text-xl font-bold tabular-nums">{n(datos.mesas)}</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Departamentos</p><p className="mt-1 text-xl font-bold tabular-nums">{n(datos.filas.length)}</p></div>
      </div>
      <ul className="space-y-1.5">
        {datos.filas.map((f) => (
          <li key={f.departamento} className="grid grid-cols-[10rem_1fr_6rem] items-center gap-3 text-sm">
            <span className="truncate">{f.departamento}</span>
            <span className="h-2 rounded-full bg-surface-muted"><span className="block h-2 rounded-full bg-brand" style={{ width: `${(Number(f.votos) / max) * 100}%` }} /></span>
            <span className="text-right tabular-nums">{n(Number(f.votos))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
