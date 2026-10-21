"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Download, Loader2, Search, TriangleAlert } from "lucide-react";

type Fila = {
  dane: string; municipio: string; departamento: string;
  censo2022: number | null; censo2026: number; votantes2026: number; participacion2026: number; participacion2026Segunda: number;
  razon: number; electores2030: number; crecimiento: number; nuevos2030: number; pesoNuevos: number; nuevosEn2026: number;
  edades2030: number[]; edades2026: number[]; hombres2030: number; mujeres2030: number; votantesEsperados2030: number; errorPrueba: number | null;
};
type Respuesta = {
  nacional: { censo2022: number; censo2026: number; exterior: number; electores2030: number; nuevos2030: number; nuevosEn2026: number; edades2030: number[]; edades2026: number[]; hombres2030: number; mujeres2030: number; votantes2026: number; votantesEsperados2030: number };
  prueba: { errorNacional: number | null; errorMediano: number | null; errorP90: number | null; municipios: number };
  municipios: Fila[];
  bandas: string[];
};

const n = (v: number) => Math.round(v).toLocaleString("es-CO");
const m = (v: number) => `${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 2 })} millones`;
const pct = (v: number, d = 1) => `${(v * 100).toLocaleString("es-CO", { maximumFractionDigits: d, minimumFractionDigits: d })} %`;
const signo = (v: number) => `${v >= 0 ? "+" : "−"}${pct(Math.abs(v))}`;

type Orden = "electores2030" | "nuevos2030" | "pesoNuevos" | "crecimiento" | "municipio";
type Vista = "municipios" | "departamentos";

function Barras({ a, b, etiquetas }: { a: number[]; b: number[]; etiquetas: string[] }) {
  const max = Math.max(...a, ...b, 1);
  return (
    <div className="space-y-1.5">
      {etiquetas.map((e, i) => (
        <div key={e} className="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-2 text-xs">
          <span className="text-muted-foreground">{e}</span>
          <span className="space-y-0.5">
            <span className="block h-2 rounded-full bg-border" style={{ width: `${(a[i] / max) * 100}%` }} title={`2026: ${n(a[i])}`} />
            <span className="block h-2 rounded-full bg-brand" style={{ width: `${(b[i] / max) * 100}%` }} title={`2030: ${n(b[i])}`} />
          </span>
          <span className="text-right tabular-nums">{n(b[i])}</span>
        </div>
      ))}
      <p className="flex gap-3 pt-1 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><i className="inline-block h-2 w-4 rounded-full bg-border" />2026</span><span className="flex items-center gap-1"><i className="inline-block h-2 w-4 rounded-full bg-brand" />2030 (proyectado)</span></p>
    </div>
  );
}

/** Censo electoral proyectado a 2030 por municipio y por edad, con el peso de quienes votan por primera vez. */
export function ProyeccionTab() {
  const [datos, setDatos] = React.useState<Respuesta | null>(null);
  const [error, setError] = React.useState("");
  const [texto, setTexto] = React.useState("");
  const [depto, setDepto] = React.useState("");
  const [orden, setOrden] = React.useState<Orden>("electores2030");
  const [vista, setVista] = React.useState<Vista>("municipios");
  const [abierta, setAbierta] = React.useState<string | null>(null);
  const [limite, setLimite] = React.useState(40);

  React.useEffect(() => {
    fetch("/api/admin/proyeccion")
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "No se pudo calcular."); setDatos(j as Respuesta); })
      .catch((e: Error) => setError(e.message));
  }, []);

  const filas = React.useMemo(() => {
    if (!datos) return [];
    const q = texto.trim().toLowerCase();
    let base: Fila[] = datos.municipios;
    if (vista === "departamentos") {
      const g = new Map<string, Fila>();
      for (const f of datos.municipios) {
        const a = g.get(f.departamento) ?? { dane: f.departamento, municipio: f.departamento, departamento: f.departamento, censo2022: 0, censo2026: 0, votantes2026: 0, participacion2026: 0, participacion2026Segunda: 0, razon: 0, electores2030: 0, crecimiento: 0, nuevos2030: 0, pesoNuevos: 0, nuevosEn2026: 0, edades2030: [0, 0, 0, 0, 0, 0], edades2026: [0, 0, 0, 0, 0, 0], hombres2030: 0, mujeres2030: 0, votantesEsperados2030: 0, errorPrueba: null };
        a.censo2026 += f.censo2026; a.votantes2026 += f.votantes2026; a.electores2030 += f.electores2030; a.nuevos2030 += f.nuevos2030; a.nuevosEn2026 += f.nuevosEn2026;
        a.hombres2030 += f.hombres2030; a.mujeres2030 += f.mujeres2030; a.votantesEsperados2030 += f.votantesEsperados2030;
        a.edades2030 = a.edades2030.map((x, i) => x + f.edades2030[i]); a.edades2026 = a.edades2026.map((x, i) => x + f.edades2026[i]);
        g.set(f.departamento, a);
      }
      base = [...g.values()].map((a) => ({ ...a, participacion2026: a.votantes2026 / a.censo2026, crecimiento: a.electores2030 / a.censo2026 - 1, pesoNuevos: a.nuevos2030 / a.electores2030 }));
    }
    return base
      .filter((f) => (!depto || f.departamento === depto) && (!q || f.municipio.toLowerCase().includes(q) || f.departamento.toLowerCase().includes(q)))
      .sort((a, b) => (orden === "municipio" ? a.municipio.localeCompare(b.municipio, "es") : (b[orden] as number) - (a[orden] as number)));
  }, [datos, texto, depto, orden, vista]);

  if (error) return <p role="alert" className="flex items-center gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-800"><TriangleAlert className="size-4" aria-hidden="true" />{error}</p>;
  if (!datos) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Calculando la proyección…</p>;

  const { nacional: N, prueba } = datos;
  const departamentos = [...new Set(datos.municipios.map((f) => f.departamento))].sort((a, b) => a.localeCompare(b, "es"));
  const tarjeta = "rounded-2xl border border-border bg-surface p-4 shadow-sm";

  const csv = () => {
    const cab = ["DANE", "Municipio", "Departamento", "Censo 2026", "Electores 2030", "Crecimiento", "Votantes nuevos 2030", "Peso votantes nuevos", ...datos.bandas.map((b) => `Electores 2030 ${b}`), "Votantes esperados 2030", "Razón censo/población adulta", "Error de la prueba hacia atrás"];
    const filasCsv = datos.municipios.map((f) => [f.dane, f.municipio, f.departamento, f.censo2026, f.electores2030, f.crecimiento.toFixed(4), f.nuevos2030, f.pesoNuevos.toFixed(4), ...f.edades2030, f.votantesEsperados2030, f.razon.toFixed(3), f.errorPrueba === null ? "" : f.errorPrueba.toFixed(4)]);
    const texto = [cab, ...filasCsv].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿", texto], { type: "text/csv;charset=utf-8" }));
    a.download = "censo-electoral-proyectado-2030.csv";
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Censo electoral 2026</p><p className="mt-1 text-2xl font-bold tabular-nums">{m(N.censo2026)}</p><p className="text-xs text-muted-foreground">Registraduría, presidencial 2026 ({m(N.exterior)} en el exterior)</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Electores en 2030</p><p className="mt-1 text-2xl font-bold tabular-nums">{m(N.electores2030)}</p><p className="text-xs text-muted-foreground">{signo(N.electores2030 / N.censo2026 - 1)} frente a 2026 · +{n(N.electores2030 - N.censo2026)} personas</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Votan por primera vez en 2030</p><p className="mt-1 text-2xl font-bold tabular-nums">{m(N.nuevos2030)}</p><p className="text-xs text-muted-foreground">{pct(N.nuevos2030 / N.electores2030)} del censo · cumplen 18 años entre 2026 y 2030</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Votantes esperados 2030</p><p className="mt-1 text-2xl font-bold tabular-nums">{m(N.votantesEsperados2030)}</p><p className="text-xs text-muted-foreground">con la participación de cada municipio en la 1.ª vuelta de 2026 ({pct(N.votantes2026 / (N.censo2026 - N.exterior))})</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={tarjeta}>
          <h3 className="text-sm font-semibold">Electores por edad, 2026 y 2030 (país)</h3>
          <div className="mt-3"><Barras a={N.edades2026} b={N.edades2030} etiquetas={datos.bandas} /></div>
          <p className="mt-3 text-xs text-muted-foreground">Mujeres {pct(N.mujeres2030 / (N.mujeres2030 + N.hombres2030))} · hombres {pct(N.hombres2030 / (N.mujeres2030 + N.hombres2030))} del censo proyectado a 2030 (excluye el exterior).</p>
        </div>
        <div className={tarjeta}>
          <h3 className="text-sm font-semibold">Qué tan confiable es</h3>
          <p className="mt-2 text-sm text-muted-foreground">Prueba hacia atrás: con este mismo método, proyectar el censo de 2026 desde el de 2022 habría errado en el total del país por <b className="text-foreground">{prueba.errorNacional === null ? "—" : signo(prueba.errorNacional)}</b>. Por municipio, el error típico fue de <b className="text-foreground">{prueba.errorMediano === null ? "—" : pct(prueba.errorMediano)}</b> y en 9 de cada 10 municipios no pasó de <b className="text-foreground">{prueba.errorP90 === null ? "—" : pct(prueba.errorP90)}</b> ({prueba.municipios} municipios).</p>
          <p className="mt-2 text-sm text-muted-foreground">El país suma bien; en un municipio pequeño, el censo puede saltar por inscripciones o depuraciones que el DANE no ve.</p>
        </div>
      </div>

      <details className={tarjeta}>
        <summary className="cursor-pointer text-sm font-semibold">Cómo se calcula y qué NO dice</summary>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">
          <p><b className="text-foreground">Método.</b> Se toma el censo electoral de cada municipio en 2026 (Registraduría) y se hace crecer con la población de 18 años o más que proyecta el DANE para 2030 (<a className="underline" href="https://www.dane.gov.co/index.php/estadisticas-por-tema/demografia-y-poblacion/proyecciones-de-poblacion" target="_blank" rel="noreferrer">serie municipal 2018-2042 por sexo y edad simple</a>). Se conserva la razón censo / población adulta de cada municipio.</p>
          <p><b className="text-foreground">Votantes nuevos.</b> Personas de 18 a 21 años en 2030: nacieron después de la elección de 2026 y son mayores de edad en 2030. Es una aproximación: el DANE cuenta las edades a mitad de año.</p>
          <p><b className="text-foreground">Límites.</b> No hay una fuente oficial de la edad de quienes votan o están inscritos por mesa (la Registraduría solo publica el censo por sexo), así que la edad sale de la población, no del censo. No es una predicción de votos, solo de cuántos podrían votar. Migración, depuraciones del censo y cambios de reglas pueden mover las cifras. El exterior se deja igual que en 2026.</p>
        </div>
      </details>

      <div className={tarjeta}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-border p-0.5 text-xs font-semibold">
            {(["municipios", "departamentos"] as Vista[]).map((v) => <button key={v} type="button" onClick={() => { setVista(v); setAbierta(null); setLimite(40); }} className={`rounded-full px-3 py-1.5 capitalize ${vista === v ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}>{v}</button>)}
          </div>
          <label className="flex min-w-[10rem] flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5"><Search className="size-4 text-muted-foreground" aria-hidden="true" /><input value={texto} onChange={(e) => { setTexto(e.target.value); setLimite(40); }} placeholder="Buscar municipio o departamento" aria-label="Buscar" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          {vista === "municipios" && <select aria-label="Departamento" value={depto} onChange={(e) => { setDepto(e.target.value); setLimite(40); }} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold"><option value="">Todos los departamentos</option>{departamentos.map((d) => <option key={d}>{d}</option>)}</select>}
          <select aria-label="Ordenar" value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold">
            <option value="electores2030">Más electores en 2030</option><option value="nuevos2030">Más votantes nuevos</option><option value="pesoNuevos">Mayor peso de jóvenes nuevos</option><option value="crecimiento">Mayor crecimiento</option><option value="municipio">Por nombre</option>
          </select>
          <button type="button" onClick={csv} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"><Download className="size-3.5" aria-hidden="true" />Descargar CSV</button>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr><th className="w-8 px-2 py-2.5" /><th className="px-3 py-2.5 font-semibold">{vista === "departamentos" ? "Departamento" : "Municipio"}</th><th className="px-3 py-2.5 text-right font-semibold">Censo 2026</th><th className="px-3 py-2.5 text-right font-semibold">Electores 2030</th><th className="px-3 py-2.5 text-right font-semibold">Cambio</th><th className="px-3 py-2.5 text-right font-semibold">Votan por 1.ª vez</th><th className="px-3 py-2.5 text-right font-semibold">% del censo</th></tr>
            </thead>
            <tbody>
              {filas.slice(0, limite).map((f) => {
                const open = abierta === f.dane;
                return (
                  <React.Fragment key={f.dane}>
                    <tr onClick={() => setAbierta(open ? null : f.dane)} className="cursor-pointer border-b border-border/60 hover:bg-surface-muted/60">
                      <td className="px-2 py-2.5 text-muted-foreground">{open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}</td>
                      <td className="px-3 py-2.5"><b>{f.municipio}</b>{vista === "municipios" && <span className="ml-2 text-xs text-muted-foreground">{f.departamento}</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{n(f.censo2026)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n(f.electores2030)}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${f.crecimiento < 0 ? "text-red-700" : "text-emerald-700"}`}>{signo(f.crecimiento)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{n(f.nuevos2030)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{pct(f.pesoNuevos)}</td>
                    </tr>
                    {open && (
                      <tr className="border-b border-border/60 bg-surface-muted/40"><td colSpan={7} className="px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div><p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Electores por edad en {f.municipio}</p><Barras a={f.edades2026} b={f.edades2030} etiquetas={datos.bandas} /></div>
                          <ul className="space-y-1 text-sm">
                            <li>Votantes esperados en 2030: <b>{n(f.votantesEsperados2030)}</b></li>
                            <li>Participación en 2026: <b>{pct(f.participacion2026)}</b> (1.ª vuelta){vista === "municipios" && <> · <b>{pct(f.participacion2026Segunda)}</b> (2.ª)</>}</li>
                            <li>Mujeres {n(f.mujeres2030)} · hombres {n(f.hombres2030)} (2030)</li>
                            {vista === "municipios" && <li className="text-xs text-muted-foreground">Censo / población adulta (DANE): {f.razon.toLocaleString("es-CO", { maximumFractionDigits: 2 })}{f.errorPrueba !== null ? ` · la prueba hacia atrás erró ${signo(f.errorPrueba)} en este municipio` : ""}</li>}
                          </ul>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filas.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Ningún resultado.</td></tr>}
            </tbody>
          </table>
        </div>
        {filas.length > limite && <button type="button" onClick={() => setLimite((l) => l + 60)} className="mt-3 rounded-full border border-border px-4 py-1.5 text-xs font-semibold hover:bg-surface-muted">Ver más ({filas.length - limite} restantes)</button>}
      </div>
    </div>
  );
}
