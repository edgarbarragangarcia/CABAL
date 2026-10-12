"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Network, ShieldCheck, Vote } from "lucide-react";

import { CentroDeControl } from "@/components/admin/centro-control";

import { AvalesTab } from "./avales-tab";
import { ExploradorElectoral } from "./explorador-electoral";
import { PrediccionesTab } from "./predicciones-tab";

type TabId = "centro" | "votaciones" | "predicciones" | "avales";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "centro", label: "Monitoreo", icon: LayoutDashboard },
  { id: "votaciones", label: "Votaciones", icon: Vote },
  { id: "predicciones", label: "Red Cabal", icon: Network },
  { id: "avales", label: "Avales", icon: ShieldCheck },
];

export function AnalisisTabs({ header }: { header: React.ReactNode }) {
  const [tab, setTab] = React.useState<TabId>("centro");
  const irA = (id: TabId) => setTab(id);

  return (
    <div>
      {/* Título y pestañas quedan fijos arriba al hacer scroll. Los márgenes
          negativos cubren el padding de <main> (y el fondo tapa el
          contenido que pasa por debajo), así que en reposo se ve igual. */}
      <div className="sticky top-0 z-30 -mx-4 -mt-4 bg-surface-muted px-4 pt-4 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8">
        {header}

        {/* En pantallas angostas las pestañas se desplazan de lado en vez de ensanchar la
            página (contain: su ancho mínimo no depende de las pestañas). */}
        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border [contain:inline-size] [scrollbar-width:none]">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => irA(t.id)}
                className={
                  active
                    ? "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-brand px-4 py-2.5 text-sm font-semibold text-brand"
                    : "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        {tab === "centro" && <CentroDeControl />}
        {tab === "votaciones" && <ExploradorElectoral />}
        {tab === "predicciones" && <PrediccionesTab />}
        {tab === "avales" && <AvalesTab />}
      </div>
    </div>
  );
}
