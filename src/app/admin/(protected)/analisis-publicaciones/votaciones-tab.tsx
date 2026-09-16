import { Landmark } from "lucide-react";

import { BarList } from "@/components/admin/charts";
import { TopCandidates } from "@/components/sections/colombia-dashboard/top-candidates";
import type { CandidateVotes, DepartmentDatum } from "@/lib/gov-data/queries";
import { CandidateMapCompare } from "./candidate-map-compare";

export function VotacionesTab({
  candidates,
  departments,
  candidatesYear,
  departmentsYear,
  source,
  sourceUrl,
  candidateDeptMaps,
}: {
  candidates: CandidateVotes[] | null;
  departments: DepartmentDatum[] | null;
  candidatesYear: number;
  departmentsYear: number;
  source: string;
  sourceUrl: string;
  candidateDeptMaps: Record<string, Record<string, number>>;
}) {
  if (!candidates || !departments) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No fue posible cargar las cifras electorales de datos.gov.co en este momento.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <TopCandidates
          candidates={candidates}
          year={candidatesYear}
          source={source}
          sourceUrl={sourceUrl}
        />

        <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Landmark className="size-4 text-brand" aria-hidden="true" />
            Votos por departamento, Senado {departmentsYear}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Fuente: {source} — datos.gov.co.</p>
          <div className="mt-4">
            <BarList
              items={departments
                .slice()
                .sort((a, b) => b.value - a.value)
                .slice(0, 10)
                .map((d) => ({ label: d.name, value: d.value, hint: d.value.toLocaleString("es-CO") }))}
            />
          </div>
        </div>
      </div>

      <CandidateMapCompare candidates={candidates} deptMaps={candidateDeptMaps} />
    </div>
  );
}
