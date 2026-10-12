"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";

import type { FilaMunicipio, Relacion } from "@/lib/territorio/relacion";

/**
 * La relación, municipio por municipio, entre cómo votó la gente y cuánto conflicto hay: tres grupos según las víctimas por habitante,
 * las correlaciones y la tabla completa, que se ordena por la columna que se elija.
 */

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const dec = (n: number, d = 1) => n.toLocaleString("es-CO", { maximumFractionDigits: d, minimumFractionDigits: d });

type Columna = {
  clave: keyof FilaMunicipio;
  titulo: string;
  ayuda: string;
  formato: (f: FilaMunicipio) => string;
  /** Color de la barra de fondo: el conflicto en ámbar, el voto en verde o violeta. */
  color: string;
};

const COLUMNAS: Columna[] = [
  { clave: "poblacion", titulo: "Población", ayuda: "Habitantes (proyección DANE 2026)", formato: (f) => (f.poblacion === null ? "—" : fmt(f.poblacion)), color: "148 163 184" },
  { clave: "victimasPorMil", titulo: "Víctimas por 1.000 hab.", ayuda: "Víctimas del conflicto registradas por hechos ocurridos en el municipio, por cada 1.000 habitantes", formato: (f) => (f.victimasPorMil === null ? "—" : fmt(f.victimasPorMil)), color: "245 158 11" },
  { clave: "homicidios100k", titulo: "Homicidios por 100 mil", ayuda: "Tasa anual de homicidios (promedio de los últimos cinco años completos)", formato: (f) => (f.homicidios100k === null ? "—" : dec(f.homicidios100k)), color: "239 68 68" },
  { clave: "cocaHa", titulo: "Coca (ha)", ayuda: "Hectáreas de coca en el último año publicado", formato: (f) => (f.cocaHa === null ? "—" : fmt(f.cocaHa)), color: "132 204 22" },
  { clave: "cabalPct2022", titulo: "Cabal 2022", ayuda: "María Fernanda Cabal, % de los votos válidos al Senado 2022", formato: (f) => (f.cabalPct2022 === null ? "—" : `${dec(f.cabalPct2022, 2)} %`), color: "14 165 233" },
  { clave: "cdPct2026", titulo: "C. Democrático 2026", ayuda: "Centro Democrático (lista cerrada), % de los votos válidos al Senado 2026", formato: (f) => (f.cdPct2026 === null ? "—" : `${dec(f.cdPct2026)} %`), color: "56 189 248" },
  { clave: "oposPct2026", titulo: "Oposición Senado 2026", ayuda: "Pacto Histórico, % de los votos válidos al Senado 2026", formato: (f) => (f.oposPct2026 === null ? "—" : `${dec(f.oposPct2026)} %`), color: "168 85 247" },
  { clave: "oposPresidencia2026", titulo: "Oposición 2ª vuelta 2026", ayuda: "Candidato del Pacto Histórico, % de los votos válidos en la segunda vuelta presidencial de 2026", formato: (f) => (f.oposPresidencia2026 === null ? "—" : `${dec(f.oposPresidencia2026)} %`), color: "192 38 211" },
];

export function RelacionTerritorio({ relacion, departamento }: { relacion: Relacion; departamento: string }) {
  const [orden, setOrden] = React.useState<{ clave: keyof FilaMunicipio | "nombre"; asc: boolean }>({ clave: "victimasPorMil", asc: false });

  if (!relacion.suficiente) {
    return <p className="flex items-start gap-2 rounded-xl bg-surface-muted/70 px-4 py-3 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{relacion.motivo}</p>;
  }

  const filas = [...relacion.filas].sort((a, b) => {
    const x = a[orden.clave as keyof FilaMunicipio];
    const y = b[orden.clave as keyof FilaMunicipio];
    if (orden.clave === "nombre") return orden.asc ? a.nombre.localeCompare(b.nombre, "es") : b.nombre.localeCompare(a.nombre, "es");
    const nx = typeof x === "number" ? x : null;
    const ny = typeof y === "number" ? y : null;
    if (nx === null && ny === null) return 0;
    if (nx === null) return 1;
    if (ny === null) return -1;
    return orden.asc ? nx - ny : ny - nx;
  });
  const maximos = Object.fromEntries(COLUMNAS.map((c) => [c.clave, Math.max(0, ...relacion.filas.map((f) => (typeof f[c.clave] === "number" ? (f[c.clave] as number) : 0)))]));
  const cambiarOrden = (clave: keyof FilaMunicipio | "nombre") => setOrden((o) => (o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: clave === "nombre" }));
  const flecha = (clave: string) => (orden.clave === clave ? (orden.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />);

  return (
    <div className="space-y-4">
      <ul className="space-y-1.5 text-sm">
        {relacion.lectura.map((t, i) => (
          <li key={i} className={i === relacion.lectura.length - 1 ? "text-xs text-muted-foreground" : ""}>{t}</li>
        ))}
      </ul>

      <div className="grid gap-3 sm:grid-cols-3">
        {relacion.grupos.map((g, i) => (
          <div key={g.etiqueta} className={`rounded-xl border p-3 ${i === 2 ? "border-amber-400/60 bg-amber-500/5" : i === 0 ? "border-emerald-400/50 bg-emerald-500/5" : "border-border"}`}>
            <p className="text-xs font-semibold">{g.etiqueta}</p>
            <p className="text-[11px] text-muted-foreground">{g.municipios} municipios · {fmt(g.poblacion)} habitantes{g.victimasPorMil !== null ? ` · ${fmt(g.victimasPorMil)} víctimas por 1.000 hab.` : ""}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Oposición, 2ª vuelta 2026</dt><dd className="font-semibold tabular-nums">{g.oposPresidencia2026 === null ? "—" : `${dec(g.oposPresidencia2026)} %`}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Pacto Histórico, Senado 2026</dt><dd className="font-semibold tabular-nums">{g.oposPct2026 === null ? "—" : `${dec(g.oposPct2026)} %`}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Centro Democrático, Senado 2026</dt><dd className="font-semibold tabular-nums">{g.cdPct2026 === null ? "—" : `${dec(g.cdPct2026)} %`}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">María Fernanda Cabal, 2022</dt><dd className="font-semibold tabular-nums">{g.cabalPct2022 === null ? "—" : `${dec(g.cabalPct2022, 2)} %`}</dd></div>
            </dl>
          </div>
        ))}
      </div>

      {relacion.correlaciones.length > 0 && (
        <details className="rounded-xl border border-border p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Qué tan juntas suben y bajan las cifras (correlación de Spearman)</summary>
          <ul className="mt-2 space-y-1">
            {relacion.correlaciones.map((c) => (
              <li key={c.etiqueta} className="flex flex-wrap justify-between gap-2"><span className="text-muted-foreground">{c.etiqueta}</span><span className="font-semibold tabular-nums">r = {dec(c.r, 2)} · {c.fuerza} · {c.n} municipios</span></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">r va de −1 a 1: cerca de 0 no hay relación; cerca de 1, donde una cifra es mayor la otra también; cerca de −1, al revés. Mide si dos cifras acompañan, no si una causa la otra.</p>
        </details>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2.5 font-semibold"><button type="button" onClick={() => cambiarOrden("nombre")} className="inline-flex items-center gap-1 uppercase">Municipio de {departamento} {flecha("nombre")}</button></th>
              {COLUMNAS.map((c) => (
                <th key={c.clave} className="px-2 py-2.5 text-right font-semibold" title={c.ayuda}><button type="button" onClick={() => cambiarOrden(c.clave)} className="inline-flex items-center gap-1 uppercase">{c.titulo} {flecha(c.clave)}</button></th>
              ))}
              <th className="px-2 py-2.5 text-center font-semibold" title="Municipio de los Programas de Desarrollo con Enfoque Territorial (afectado por el conflicto)"><button type="button" onClick={() => cambiarOrden("pdet")} className="inline-flex items-center gap-1 uppercase">PDET {flecha("pdet")}</button></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.dane} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-1.5 font-medium">{f.nombre}</td>
                {COLUMNAS.map((c) => {
                  const v = f[c.clave];
                  const ancho = typeof v === "number" && maximos[c.clave] > 0 ? Math.max(2, (v / maximos[c.clave]) * 100) : 0;
                  return (
                    <td key={c.clave} className="px-2 py-1.5 text-right tabular-nums" style={ancho ? { background: `linear-gradient(90deg, rgb(${c.color} / 0.18) ${ancho}%, transparent ${ancho}%)` } : undefined}>{c.formato(f)}</td>
                  );
                })}
                <td className="px-2 py-1.5 text-center">{f.pdet ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">PDET</span> : <span className="text-muted-foreground/50">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
