"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building,
  Building2,
  Check,
  ChevronDown,
  Crown,
  Flag,
  HeartHandshake,
  Home,
  Landmark,
  Users,
  UsersRound,
  Vote,
} from "lucide-react";

import { ANIOS, cargosDelAnio, type OpcionCargo } from "@/lib/gov-data/elecciones/catalogo";

const ICONOS: Record<string, LucideIcon> = {
  PR: Flag,
  SE: Landmark,
  CA: Building2,
  CN: Vote,
  PH: Vote,
  EP: Vote,
  CC: Vote,
  CT: HeartHandshake,
  GO: Crown,
  AL: Building,
  AS: Users,
  CO: UsersRound,
  JA: Home,
};

const fecha = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

/**
 * Filtro de dos pasos: primero el año, luego el cargo (presidencia, senado,
 * cámara, gobernaciones, alcaldías, asambleas, concejos, ediles…) en un
 * desplegable.
 */
export function FiltroEleccion({
  eleccionId,
  sigla,
  onChange,
}: {
  eleccionId: string;
  sigla: string;
  onChange: (opcion: OpcionCargo) => void;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const actual =
    ANIOS.flatMap(cargosDelAnio).find((o) => o.eleccionId === eleccionId && o.sigla === sigla) ??
    cargosDelAnio(ANIOS[0])[0];
  const anio = actual.fecha.slice(0, 4);
  const opciones = cargosDelAnio(anio);
  const Icono = ICONOS[actual.sigla] ?? Vote;

  React.useEffect(() => {
    if (!abierto) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  const cambiarAnio = (a: string) => {
    if (a === anio) return;
    const lista = cargosDelAnio(a);
    // El mismo cargo si existe ese año (Senado 2026 → Senado 2022); si no, el primero.
    onChange(lista.find((o) => o.sigla === actual.sigla && o.nombre === actual.nombre) ??
      lista.find((o) => o.sigla === actual.sigla) ??
      lista[0]);
    setAbierto(true);
  };

  return (
    <div ref={ref} className="relative mt-4 flex flex-wrap items-center gap-2">
      <div className="flex rounded-full bg-white/15 p-1 backdrop-blur" role="tablist" aria-label="Año">
        {ANIOS.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={a === anio}
            onClick={() => cambiarAnio(a)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold tabular-nums transition-all ${
              a === anio ? "bg-white text-emerald-800 shadow-md" : "text-white/85 hover:bg-white/10 hover:text-white"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="inline-flex items-center gap-2 rounded-full bg-amber-300 py-1.5 pl-2 pr-3 text-sm font-semibold text-amber-950 shadow-md transition hover:bg-amber-200"
      >
        <span className="grid size-6 place-items-center rounded-full bg-amber-950/10">
          <Icono className="size-3.5" aria-hidden="true" />
        </span>
        {actual.nombre}
        <ChevronDown className={`size-4 transition-transform ${abierto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {abierto && (
        <div
          role="listbox"
          aria-label={`Cargos ${anio}`}
          className="cabal-rise absolute left-0 top-full z-40 mt-2 w-[min(38rem,calc(100vw-3rem))] rounded-2xl border border-border bg-surface p-2 text-foreground shadow-2xl shadow-emerald-900/20"
        >
          <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Elecciones {anio}
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            {opciones.map((o) => {
              const Icon = ICONOS[o.sigla] ?? Vote;
              const sel = o.eleccionId === actual.eleccionId && o.sigla === actual.sigla;
              return (
                <button
                  key={`${o.eleccionId}-${o.sigla}`}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => {
                    onChange(o);
                    setAbierto(false);
                  }}
                  className={`flex items-start gap-3 rounded-xl p-2.5 text-left transition ${
                    sel ? "bg-emerald-500/10 ring-1 ring-emerald-500/40" : "hover:bg-surface-muted"
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                      sel ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{o.nombre}</span>
                    <span className="block text-xs text-muted-foreground">{o.descripcion}</span>
                    <span className="block text-[11px] text-muted-foreground/80">{fecha(o.fecha)}</span>
                  </span>
                  {sel && <Check className="mt-1 size-4 shrink-0 text-emerald-600" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
