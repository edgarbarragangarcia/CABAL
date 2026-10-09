"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Landmark, MessageSquareText, Network, ShieldCheck, Vote } from "lucide-react";

import { AvalesTab } from "./avales-tab";
import { CabalResultados } from "./cabal-resultados";
import { AbrirContratosContext, type Consulta } from "./contratos-comun";
import { ContratosTab } from "./contratos-tab";
import { ExploradorElectoral } from "./explorador-electoral";
import { PrediccionesTab } from "./predicciones-tab";
import { PreguntasTab } from "./preguntas-tab";

type TabId = "votaciones" | "predicciones" | "avales" | "contratos" | "preguntas";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "votaciones", label: "Votaciones", icon: Vote },
  { id: "predicciones", label: "Red Cabal", icon: Network },
  { id: "avales", label: "Avales", icon: ShieldCheck },
  { id: "contratos", label: "Contratos", icon: Landmark },
  { id: "preguntas", label: "Preguntar", icon: MessageSquareText },
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
  // Consulta con la que Avales abre la pestaña de contratos; `clave` reinicia la pestaña aunque se repita la misma.
  const [contratos, setContratos] = React.useState<{ consulta: Consulta; clave: number } | null>(null);

  const abrirContratos = React.useCallback((consulta: Consulta) => {
    setContratos((c) => ({ consulta, clave: (c?.clave ?? 0) + 1 }));
    setTab("contratos");
  }, []);

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
                onClick={() => {
                  setTab(t.id);
                  // Entrar por la barra abre la búsqueda en blanco; solo «ver todo» desde Avales la trae cargada.
                  if (t.id === "contratos") setContratos(null);
                }}
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

      <AbrirContratosContext.Provider value={abrirContratos}>
        <div className="mt-6">
          {tab === "votaciones" && <Votaciones />}
          {tab === "predicciones" && <PrediccionesTab />}
          {tab === "avales" && <AvalesTab />}
          {tab === "contratos" && <ContratosTab key={contratos?.clave ?? 0} inicial={contratos?.consulta ?? null} />}
          {tab === "preguntas" && <PreguntasTab />}
        </div>
      </AbrirContratosContext.Provider>
    </div>
  );
}
