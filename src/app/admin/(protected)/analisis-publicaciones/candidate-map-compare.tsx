"use client";

import * as React from "react";
import { Map } from "lucide-react";

import { ColombiaHeatmap } from "@/components/admin/colombia-heatmap";
import type { CandidateVotes } from "@/lib/gov-data/queries";

function CandidateMap({
  candidates,
  deptMaps,
  value,
  onChange,
}: {
  candidates: CandidateVotes[];
  deptMaps: Record<string, Record<string, number>>;
  value: string;
  onChange: (name: string) => void;
}) {
  const values = deptMaps[value] ?? {};
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  const topDept = Object.entries(values).sort((a, b) => b[1] - a[1])[0];

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

      {total > 0 ? (
        <>
          <ColombiaHeatmap values={values} />
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
  deptMaps,
}: {
  candidates: CandidateVotes[];
  deptMaps: Record<string, Record<string, number>>;
}) {
  const [candidateA, setCandidateA] = React.useState(candidates[0]?.candidato ?? "");
  const [candidateB, setCandidateB] = React.useState(candidates[1]?.candidato ?? "");

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
          deptMaps={deptMaps}
          value={candidateA}
          onChange={setCandidateA}
        />
        <CandidateMap
          candidates={candidates}
          deptMaps={deptMaps}
          value={candidateB}
          onChange={setCandidateB}
        />
      </div>
    </div>
  );
}
