import { Vote } from "lucide-react";

import {
  getCandidateVotesByDepartment,
  getSenateVotesByDepartment,
  getTopSenateCandidates,
  GOV_DATASETS,
  type CandidateVotes,
  type DepartmentDatum,
} from "@/lib/gov-data/queries";
import { AnalisisTabs } from "./analisis-tabs";

export type ElectoralData = {
  candidates: CandidateVotes[] | null;
  departments: DepartmentDatum[] | null;
  candidatesYear: number;
  departmentsYear: number;
  candidateDeptMaps: Record<string, Record<string, number>>;
};

/**
 * Solo precarga el desglose por departamento de los primeros 2 candidatos
 * (los que el comparador muestra por defecto) en vez de los 10 — pedirle
 * a Socrata 10 desgloses antes de poder pintar la página es justo lo que
 * hacía lenta la navegación a esta pantalla. El resto de candidatos se
 * piden bajo demanda desde el cliente (candidate-map-compare.tsx) cuando
 * el usuario realmente los selecciona.
 */
async function loadElectoralData(): Promise<ElectoralData> {
  try {
    const [candidates, departments] = await Promise.all([
      getTopSenateCandidates(10),
      getSenateVotesByDepartment(),
    ]);
    const seedCandidates = candidates.data.slice(0, 2);
    const entries = await Promise.all(
      seedCandidates.map(
        async (c) => [c.candidato, await getCandidateVotesByDepartment(c.candidato)] as const
      )
    );
    return {
      candidates: candidates.data,
      departments: departments.data,
      candidatesYear: candidates.year,
      departmentsYear: departments.year,
      candidateDeptMaps: Object.fromEntries(entries),
    };
  } catch {
    return {
      candidates: null,
      departments: null,
      candidatesYear: 0,
      departmentsYear: 0,
      candidateDeptMaps: {},
    };
  }
}

/**
 * Página de análisis del admin: combina datos ELECTORALES reales
 * (Registraduría, vía Socrata — los mismos que en el Observatorio público)
 * con el análisis de publicaciones en redes (MVP, datos simulados) y un
 * simulador de escenarios.
 *
 * No se espera (`await`) la carga electoral aquí: se pasa como promesa a
 * un límite de Suspense en el cliente, así que el resto de la página
 * (pestañas, "Tendencias") se pinta de inmediato en vez de bloquearse por
 * las llamadas a Socrata.
 */
export default function AnalisisPublicacionesPage() {
  const electoralDataPromise = loadElectoralData();

  return (
    <div className="w-full">
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
          electoralDataPromise={electoralDataPromise}
          source={GOV_DATASETS.senado2018.source}
          sourceUrl={GOV_DATASETS.senado2018.url}
        />
      </div>
    </div>
  );
}
