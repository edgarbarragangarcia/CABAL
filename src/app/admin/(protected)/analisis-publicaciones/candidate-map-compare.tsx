"use client";

import * as React from "react";
import { Loader2, Map } from "lucide-react";

import { ColombiaHeatmap } from "@/components/admin/colombia-heatmap";
import type { CandidateVotes } from "@/lib/gov-data/queries";

function CandidateMap({
  candidates,
  values,
  loading,
  value,
  onChange,
}: {
  candidates: CandidateVotes[];
  values: Record<string, number> | undefined;
  loading: boolean;
  value: string;
  onChange: (name: string) => void;
}) {
  const total = Object.values(values ?? {}).reduce((a, b) => a + b, 0);
  const topDept = Object.entries(values ?? {}).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-brand"
      >
        {candidates.map((c) => (
          <option key={c.candidato} value={c.candidato}>
            {c.candidato}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Cargando datos.gov.co...
        </div>
      ) : total > 0 ? (
        <>
          <ColombiaHeatmap values={values ?? {}} />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {total.toLocaleString("es-CO")} votos en los departamentos con dato · mejor resultado en{" "}
            <span className="font-medium text-foreground">{topDept?.[0]}</span>
          </p>
        </>
      ) : (
        <p className="mt-4 py-8 text-center text-xs text-muted-foreground">
          No hay desglose por departamento para este candidato.
        </p>
      )}
    </div>
  );
}

export function CandidateMapCompare({
  candidates,
  deptMaps: initialDeptMaps,
}: {
  candidates: CandidateVotes[];
  /** Ya viene precargado solo para 1-2 candidatos; el resto se pide bajo
   * demanda (evita bloquear la página con una llamada a Socrata por
   * candidato). */
  deptMaps: Record<string, Record<string, number>>;
}) {
  const [deptMaps, setDeptMaps] = React.useState(initialDeptMaps);
  const [loadingFor, setLoadingFor] = React.useState<Set<string>>(new Set());
  const [candidateA, setCandidateA] = React.useState(candidates[0]?.candidato ?? "");
  const [candidateB, setCandidateB] = React.useState(candidates[1]?.candidato ?? "");

  const ensureLoaded = React.useCallback(
    (candidato: string) => {
      if (!candidato || deptMaps[candidato] || loadingFor.has(candidato)) return;
      setLoadingFor((prev) => new Set(prev).add(candidato));
      fetch(`/api/admin/candidate-departments?candidato=${encodeURIComponent(candidato)}`)
        .then((res) => res.json())
        .then((data: { values?: Record<string, number> }) => {
          setDeptMaps((prev) => ({ ...prev, [candidato]: data.values ?? {} }));
        })
        .catch(() => {
          setDeptMaps((prev) => ({ ...prev, [candidato]: {} }));
        })
        .finally(() => {
          setLoadingFor((prev) => {
            const next = new Set(prev);
            next.delete(candidato);
            return next;
          });
        });
    },
    [deptMaps, loadingFor]
  );

  React.useEffect(() => {
    ensureLoaded(candidateA);
    ensureLoaded(candidateB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateA, candidateB]);

  if (candidates.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Map className="size-4 text-brand" aria-hidden="true" />
        Dónde le fue bien a cada candidato
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Elige dos candidatos para comparar su votación por departamento, uno junto al otro. Mientras
        más oscuro, más votos obtuvo ahí.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <CandidateMap
          candidates={candidates}
          values={deptMaps[candidateA]}
          loading={loadingFor.has(candidateA)}
          value={candidateA}
          onChange={setCandidateA}
        />
        <CandidateMap
          candidates={candidates}
          values={deptMaps[candidateB]}
          loading={loadingFor.has(candidateB)}
          value={candidateB}
          onChange={setCandidateB}
        />
      </div>
    </div>
  );
}
