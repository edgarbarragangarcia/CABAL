import { Vote } from "lucide-react";

import { getSenateVotesByDepartment, getTopSenateCandidates, GOV_DATASETS } from "@/lib/gov-data/queries";
import { AnalisisTabs } from "./analisis-tabs";

/**
 * Página de análisis del admin: combina datos ELECTORALES reales
 * (Registraduría, vía Socrata — los mismos que en el Observatorio público)
 * con el análisis de publicaciones en redes (MVP, datos simulados) y un
 * simulador de escenarios. Vive aquí porque este es el espacio de trabajo
 * para hacer análisis y tomar decisiones, no solo para mostrar cifras al
 * público.
 */
export default async function AnalisisPublicacionesPage() {
  let candidates, departments;
  try {
    [candidates, departments] = await Promise.all([
      getTopSenateCandidates(10),
      getSenateVotesByDepartment(),
    ]);
  } catch {
    candidates = null;
    departments = null;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Vote className="size-5 text-brand" aria-hidden="true" />
        Análisis
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tendencias en redes, datos electorales oficiales y simulación de escenarios, en un solo
        lugar para cruzar información y decidir.
      </p>

      <div className="mt-6">
        <AnalisisTabs
          candidates={candidates?.data ?? null}
          departments={departments?.data ?? null}
          candidatesYear={candidates?.year ?? 0}
          departmentsYear={departments?.year ?? 0}
          source={GOV_DATASETS.senado2018.source}
          sourceUrl={GOV_DATASETS.senado2018.url}
        />
      </div>
    </div>
  );
}
