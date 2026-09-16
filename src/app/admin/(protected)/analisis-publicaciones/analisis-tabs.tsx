"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Bot, Loader2, LineChart, Vote, Wand2 } from "lucide-react";

import type { ElectoralData } from "./page";
import { AnalisisPublicacionesClient } from "./analisis-publicaciones-client";
import { AsistenteTab } from "./asistente-tab";
import { PrediccionesTab } from "./predicciones-tab";
import { VotacionesResolved } from "./votaciones-resolved";

type TabId = "tendencias" | "votaciones" | "predicciones" | "asistente";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "tendencias", label: "Tendencias", icon: LineChart },
  { id: "votaciones", label: "Votaciones", icon: Vote },
  { id: "predicciones", label: "Predicciones", icon: Wand2 },
  { id: "asistente", label: "Asistente", icon: Bot },
];

function VotacionesSkeleton() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      Cargando cifras electorales de datos.gov.co...
    </div>
  );
}

export function AnalisisTabs({
  electoralDataPromise,
  source,
  sourceUrl,
}: {
  electoralDataPromise: Promise<ElectoralData>;
  source: string;
  sourceUrl: string;
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
          <React.Suspense fallback={<VotacionesSkeleton />}>
            <VotacionesResolved
              electoralDataPromise={electoralDataPromise}
              source={source}
              sourceUrl={sourceUrl}
            />
          </React.Suspense>
        )}
        {tab === "predicciones" && <PrediccionesTab />}
        {tab === "asistente" && <AsistenteTab />}
      </div>
    </div>
  );
}
