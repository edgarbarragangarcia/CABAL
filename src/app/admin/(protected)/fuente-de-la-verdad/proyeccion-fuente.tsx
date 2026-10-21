"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { PanelCarga } from "../analisis-publicaciones/proyeccion-carga";

type Resumen = { nacional: { censo2026: number; electores2030: number; nuevos2030: number; votantesEsperados2030: number }; municipios: { dane: string }[] };
const n = (v: number) => Math.round(v).toLocaleString("es-CO");

/** La población del DANE (municipio × sexo × edad) guardada en Supabase para la Proyección 2030, y lo que sale de ella. */
export function ProyeccionFuente({ alCargar }: { alCargar: () => void }) {
  const [resumen, setResumen] = React.useState<Resumen | null>(null);
  const [sinDatos, setSinDatos] = React.useState(false);
  const [error, setError] = React.useState("");
  const leer = React.useCallback(() => {
    fetch("/api/admin/proyeccion")
      .then(async (r) => { const j = await r.json(); if (!r.ok) { setSinDatos(!!j.sinDatos); throw new Error(j.error ?? "No se pudo calcular."); } setSinDatos(false); setError(""); setResumen(j as Resumen); })
      .catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(() => { leer(); }, [leer]);

  if (sinDatos) return <PanelCarga mensaje={error} alCargar={() => { leer(); alCargar(); }} />;
  if (error) return <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>;
  if (!resumen) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Leyendo…</p>;
  const N = resumen.nacional;
  const tarjeta = "rounded-2xl border border-border bg-surface p-4 shadow-sm";
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Población proyectada por el DANE (serie municipal 2018-2042, base Censo 2018) guardada en la tabla <b>proyeccion_poblacion</b> de Supabase: {n(resumen.municipios.length)} municipios, años 2022, 2026, 2030 y 2034, con las 101 edades simples de hombres y mujeres. Se cruza con el censo electoral de la Registraduría para proyectar los electores de 2030.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Censo electoral 2026</p><p className="mt-1 text-xl font-bold tabular-nums">{n(N.censo2026)}</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Electores 2030</p><p className="mt-1 text-xl font-bold tabular-nums">{n(N.electores2030)}</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Votan por primera vez</p><p className="mt-1 text-xl font-bold tabular-nums">{n(N.nuevos2030)}</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Votantes esperados</p><p className="mt-1 text-xl font-bold tabular-nums">{n(N.votantesEsperados2030)}</p></div>
      </div>
      <p className="text-sm text-muted-foreground">El detalle por municipio, departamento y edad está en <b>Análisis → Proyección 2030</b>, y el asistente de voz también lo usa.</p>
    </div>
  );
}
