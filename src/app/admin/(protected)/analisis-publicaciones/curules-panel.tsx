"use client";

import * as React from "react";
import { Armchair, TriangleAlert } from "lucide-react";

import { analizarCurules, reglaUmbral } from "@/lib/gov-data/elecciones/curules";
import type { Circunscripcion, PartidoResultado } from "@/lib/gov-data/elecciones/resultados";
import { LogoPartido } from "./candidato-ui";
import { titulo } from "./nombres";

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");

/**
 * Curules y cifra repartidora de una corporación de lista: cuántos votos le
 * faltaron a cada lista para el umbral o para una curul más, y qué margen
 * tuvo quien se quedó con la última. Parte de las curules oficiales.
 */
export function CurulesPanel({
  eleccionId,
  sigla,
  circ,
  partidoSel,
  candidatoSel,
}: {
  eleccionId: string;
  sigla: string;
  circ: Circunscripcion;
  /** Partido y candidato elegidos en el lienzo, para resaltarlos y explicar su caso. */
  partidoSel?: PartidoResultado;
  candidatoSel?: string;
}) {
  const regla = reglaUmbral(sigla, circ.codigo);
  const a = React.useMemo(
    () =>
      analizarCurules(
        circ.partidos.filter((p) => p.votos > 0).map((p) => ({ codigo: p.codigo, nombre: p.nombre, votos: p.votos, curules: p.curules })),
        { validos: circ.validos, curules: circ.curules, regla }
      ),
    [circ, regla]
  );
  if (!a || regla === "ninguno") return null;

  const propia = partidoSel ? a.listas.find((l) => l.codigo === partidoSel.codigo) : undefined;
  const cand = partidoSel?.candidatos.find((x) => x.codigo === candidatoSel);
  const ranking = partidoSel ? partidoSel.candidatos.filter((x) => !x.soloLista).sort((x, y) => y.votos - x.votos) : [];
  const puesto = cand ? ranking.findIndex((x) => x.codigo === cand.codigo) + 1 : 0;

  return (
    <div className="rounded-2xl border border-sky-400/40 bg-gradient-to-br from-sky-500/5 via-surface to-emerald-500/5 p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Armchair className="size-4 text-sky-600" aria-hidden="true" />
        Curules y cifra repartidora
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {fmt(a.curules)} curules · cifra repartidora {fmt(a.cifraRepartidora)} votos (el cociente más bajo que ganó una curul)
        {a.umbral && ` · umbral: ${a.umbral.regla} = ${fmt(a.umbral.votos)} votos`}.
      </p>
      {!a.consistente && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Las curules oficiales no se explican del todo con la cifra repartidora (puede haber curules especiales o listas sin
          umbral). Toma estas cifras con cautela.
        </p>
      )}

      {propia && partidoSel && (
        <div className="mt-3 rounded-xl bg-surface p-3 text-sm ring-1 ring-border">
          <p className="font-semibold">
            {titulo(partidoSel.nombre)}: {propia.curules} {propia.curules === 1 ? "curul" : "curules"} con {fmt(propia.votos)} votos
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {!propia.supera && <li>No alcanzó el umbral: le faltaron {fmt(propia.faltaUmbral)} votos.</li>}
            {propia.supera && propia.faltaCurul !== null && (
              <li>Para una curul más necesitaba {fmt(propia.faltaCurul)} votos adicionales.</li>
            )}
            {propia.ultima && propia.margen !== null && (
              <li>Tuvo la última curul repartida: podía perder hasta {fmt(propia.margen)} votos antes de cederla.</li>
            )}
            {cand && (
              <li>
                {titulo(cand.nombre)} {cand.electo ? "obtuvo curul" : `quedó de ${puesto} en su lista (${fmt(cand.votos)} votos), que ganó ${propia.curules}`}
                {!cand.electo && puesto <= propia.curules && (
                  <>: si la lista es cerrada, las curules siguen el orden que fijó el partido y no los votos</>
                )}
                {!cand.electo && puesto === propia.curules + 1 && propia.faltaCurul !== null && (
                  <>: era el siguiente; con {fmt(propia.faltaCurul)} votos más para la lista habría alcanzado curul (si la lista es de voto preferente)</>
                )}
                .
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-border">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="bg-surface-muted/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Lista</th>
              <th className="px-3 py-2 text-right font-medium">Votos</th>
              <th className="px-3 py-2 text-right font-medium">Curules</th>
              <th className="px-3 py-2 text-right font-medium">Para una más</th>
              <th className="px-3 py-2 font-medium">Situación</th>
            </tr>
          </thead>
          <tbody>
            {a.listas.slice(0, 25).map((l) => {
              const p = circ.partidos.find((x) => x.codigo === l.codigo)!;
              return (
                <tr key={l.codigo} className={`border-t border-border ${l.codigo === partidoSel?.codigo ? "bg-sky-500/10" : ""}`}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <LogoPartido eleccionId={eleccionId} logo={p.logo} nombre={p.nombre} color={p.color} className="size-6" />
                      <span className="truncate font-medium">{titulo(l.nombre)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(l.votos)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{l.curules}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.faltaCurul === null ? "—" : fmt(l.faltaCurul)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {!l.supera
                      ? `Sin umbral (faltaron ${fmt(l.faltaUmbral)})`
                      : l.ultima
                        ? `Última curul · margen ${fmt(l.margen ?? 0)}`
                        : l.curules > 0
                          ? "Curul segura"
                          : "Sobre el umbral, sin curul"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Cálculo sobre el preconteo oficial y las curules que publica la Registraduría; no es una proyección.
      </p>
    </div>
  );
}
