"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { LineChart, Vote, Wand2 } from "lucide-react";

import type { CandidateVotes, DepartmentDatum } from "@/lib/gov-data/queries";
import { AnalisisPublicacionesClient } from "./analisis-publicaciones-client";
import { PrediccionesTab } from "./predicciones-tab";
import { VotacionesTab } from "./votaciones-tab";

type TabId = "tendencias" | "votaciones" | "predicciones";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "tendencias", label: "Tendencias", icon: LineChart },
  { id: "votaciones", label: "Votaciones", icon: Vote },
  { id: "predicciones", label: "Predicciones", icon: Wand2 },
];

export function AnalisisTabs({
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
  const [tab, setTab] = React.useState<TabId>("tendencias");

  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                active
                  ? "flex items-center gap-2 border-b-2 border-brand px-4 py-2.5 text-sm font-semibold text-brand"
                  : "flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {tab === "tendencias" && <AnalisisPublicacionesClient />}
        {tab === "votaciones" && (
          <VotacionesTab
            candidates={candidates}
            departments={departments}
            candidatesYear={candidatesYear}
            departmentsYear={departmentsYear}
            source={source}
            sourceUrl={sourceUrl}
            candidateDeptMaps={candidateDeptMaps}
          />
        )}
        {tab === "predicciones" && <PrediccionesTab />}
      </div>
    </div>
  );
}
