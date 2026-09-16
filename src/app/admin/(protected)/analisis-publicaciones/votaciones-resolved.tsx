"use client";

import * as React from "react";

import type { ElectoralData } from "./page";
import { VotacionesTab } from "./votaciones-tab";

/** Resuelve la promesa de datos electorales dentro de un <Suspense> — así
 * la pestaña Tendencias no espera a Socrata para pintarse. */
export function VotacionesResolved({
  electoralDataPromise,
  source,
  sourceUrl,
}: {
  electoralDataPromise: Promise<ElectoralData>;
  source: string;
  sourceUrl: string;
}) {
  const data = React.use(electoralDataPromise);

  return (
    <VotacionesTab
      candidates={data.candidates}
      departments={data.departments}
      candidatesYear={data.candidatesYear}
      departmentsYear={data.departmentsYear}
      source={source}
      sourceUrl={sourceUrl}
      candidateDeptMaps={data.candidateDeptMaps}
    />
  );
}
