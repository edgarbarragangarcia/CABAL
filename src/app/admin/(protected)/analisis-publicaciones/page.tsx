import { Landmark, Vote } from "lucide-react";

import { BarList } from "@/components/admin/charts";
import { TopCandidates } from "@/components/sections/colombia-dashboard/top-candidates";
import { getSenateVotesByDepartment, getTopSenateCandidates, GOV_DATASETS } from "@/lib/gov-data/queries";
import { AnalisisPublicacionesClient } from "./analisis-publicaciones-client";

/**
 * Página de análisis del admin: combina datos ELECTORALES reales
 * (Registraduría, vía Socrata — los mismos que en el Observatorio público)
 * con el análisis de publicaciones en redes (MVP, datos simulados). Vive
 * aquí porque este es el espacio de trabajo para hacer análisis cruzado,
 * no solo para mostrar cifras al público.
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
        Datos electorales oficiales de la Registraduría y análisis de publicaciones en redes, en
        un solo lugar para cruzar información.
      </p>

      {candidates && departments ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <TopCandidates
            candidates={candidates.data}
            year={candidates.year}
            source={GOV_DATASETS.senado2018.source}
            sourceUrl={GOV_DATASETS.senado2018.url}
          />

          <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Landmark className="size-4 text-brand" aria-hidden="true" />
              Votos por departamento, Senado {departments.year}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fuente: {GOV_DATASETS.senado2018.source} — datos.gov.co.
            </p>
            <div className="mt-4">
              <BarList
                items={departments.data
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 10)
                  .map((d) => ({ label: d.name, value: d.value, hint: d.value.toLocaleString("es-CO") }))}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No fue posible cargar las cifras electorales de datos.gov.co en este momento.
        </div>
      )}

      <div className="mt-8 border-t border-border pt-6">
        <AnalisisPublicacionesClient />
      </div>
    </div>
  );
}
