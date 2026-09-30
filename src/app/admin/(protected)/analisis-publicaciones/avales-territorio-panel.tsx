"use client";

import * as React from "react";
import { Loader2, MapPin, Search } from "lucide-react";

import { ELECCIONES } from "@/lib/gov-data/elecciones/catalogo";
import type { CoincidenciaElectoral } from "@/lib/gov-data/elecciones/historial-electoral";
import { titulo } from "./nombres";

/** Solo las corporaciones que el chequeo automático no cubre: por departamento o municipio. */
const OPCIONES = ELECCIONES.flatMap((e) =>
  e.corporaciones
    .filter((c) => c.nivelEleccion !== 1)
    .map((c) => ({ eleccionId: e.id, eleccionNombre: e.nombre, sigla: c.sigla, corporacionNombre: c.nombre }))
);

type Resultado = { ok: true; ambitoNombre: string; coincidencias: CoincidenciaElectoral[] } | { ok: false; error: string };

export function AvalesTerritorioPanel({ cedula, nombre }: { cedula: string; nombre: string }) {
  const [opcion, setOpcion] = React.useState(`${OPCIONES[0].eleccionId}|${OPCIONES[0].sigla}`);
  const [territorio, setTerritorio] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [resultado, setResultado] = React.useState<Resultado | null>(null);

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    const t = territorio.trim();
    if (t.length < 2 || cargando) return;
    const [eleccion, corporacion] = opcion.split("|");
    setCargando(true);
    setResultado(null);
    fetch(`/api/admin/avales/territorio?${new URLSearchParams({ cedula, nombre, eleccion, corporacion, territorio: t })}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        return body as { ambitoNombre: string; coincidencias: CoincidenciaElectoral[] };
      })
      .then((body) => setResultado({ ok: true, ...body }))
      .catch((err: Error) => setResultado({ ok: false, error: err.message }))
      .finally(() => setCargando(false));
  };

  return (
    <div className="mt-3 rounded-xl bg-surface-muted/60 p-3">
      <p className="text-xs font-semibold text-muted-foreground">Buscar en Cámara, Gobernación, Alcaldía, Asamblea, Concejo o JAL</p>
      <form onSubmit={buscar} className="mt-2 flex flex-wrap gap-2">
        <select
          value={opcion}
          onChange={(e) => setOpcion(e.target.value)}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs outline-none"
        >
          {ELECCIONES.filter((e) => OPCIONES.some((o) => o.eleccionId === e.id)).map((e) => (
            <optgroup key={e.id} label={e.nombre}>
              {OPCIONES.filter((o) => o.eleccionId === e.id).map((o) => (
                <option key={`${o.eleccionId}|${o.sigla}`} value={`${o.eleccionId}|${o.sigla}`}>
                  {o.corporacionNombre}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          value={territorio}
          onChange={(e) => setTerritorio(e.target.value)}
          placeholder="Departamento o municipio"
          aria-label="Departamento o municipio"
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs outline-none"
        />
        <button
          type="submit"
          disabled={territorio.trim().length < 2 || cargando}
          className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold ring-1 ring-border transition hover:ring-emerald-500/50 disabled:opacity-50"
        >
          {cargando ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Search className="size-3.5" aria-hidden="true" />}
          Buscar
        </button>
      </form>

      {resultado && (
        <div className="mt-2 text-xs">
          {!resultado.ok ? (
            <p className="text-red-700 dark:text-red-300">{resultado.error}</p>
          ) : resultado.coincidencias.length === 0 ? (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" /> Sin coincidencias en {titulo(resultado.ambitoNombre)}.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {resultado.coincidencias.map((c, i) => (
                <li key={i} className="rounded-lg bg-surface px-2.5 py-1.5 ring-1 ring-border">
                  <span className="font-medium">{titulo(c.candidato.nombre)}</span>{" "}
                  <span
                    className={
                      c.coincidePor === "cedula"
                        ? "rounded-full bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                        : "rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300"
                    }
                  >
                    {c.coincidePor === "cedula" ? "por cédula" : "por nombre"}
                  </span>
                  <span className="block text-muted-foreground">
                    {c.corporacionNombre} · {resultado.ambitoNombre} · {c.partido ?? "Sin partido"} · {c.candidato.votos.toLocaleString("es-CO")} votos
                    {c.candidato.electo && " · Electo"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
