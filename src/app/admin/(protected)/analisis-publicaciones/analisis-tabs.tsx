"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Bot, Vote, Wand2 } from "lucide-react";

import { AsistenteTab } from "./asistente-tab";
import { CabalResultados } from "./cabal-resultados";
import { ExploradorElectoral } from "./explorador-electoral";
import { PrediccionesTab } from "./predicciones-tab";

type TabId = "votaciones" | "predicciones" | "asistente";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "votaciones", label: "Votaciones", icon: Vote },
  { id: "predicciones", label: "Predicciones", icon: Wand2 },
  { id: "asistente", label: "Asistente", icon: Bot },
];

/** Votaciones: todas las elecciones y candidatos, o el seguimiento de Cabal. */
function Votaciones() {
  const [vista, setVista] = React.useState<"todas" | "cabal">("todas");
  const opciones = [
    { id: "todas", label: "Todas las elecciones y candidatos" },
    { id: "cabal", label: "María Fernanda Cabal" },
  ] as const;
  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap gap-1 rounded-full bg-surface p-1 text-sm shadow-sm ring-1 ring-border">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setVista(o.id)}
            className={
              vista === o.id
                ? "rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 font-semibold text-white shadow"
                : "rounded-full px-4 py-1.5 text-muted-foreground transition hover:text-foreground"
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      {vista === "todas" ? <ExploradorElectoral /> : <CabalResultados />}
    </div>
  );
}

export function AnalisisTabs({ header }: { header: React.ReactNode }) {
  const [tab, setTab] = React.useState<TabId>("votaciones");

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
                onClick={() => setTab(t.id)}
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
        {tab === "votaciones" && <Votaciones />}
        {tab === "predicciones" && <PrediccionesTab />}
        {tab === "asistente" && <AsistenteTab />}
      </div>
    </div>
  );
}
