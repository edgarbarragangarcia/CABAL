"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, LayoutDashboard, Network, ShieldCheck, TrendingUp, Vote } from "lucide-react";

import { ChipPortada, Lienzo, Portada } from "@/components/admin/estilo-cabal";
import { MonitoreoSecciones } from "@/components/admin/monitoreo-secciones";

import { AvalesTab } from "./avales-tab";
import { ExploradorElectoral } from "./explorador-electoral";
import { PrediccionesTab } from "./predicciones-tab";
import { ProyeccionTab } from "./proyeccion-tab";

type TabId = "centro" | "votaciones" | "predicciones" | "proyeccion" | "avales";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "centro", label: "Monitoreo", icon: LayoutDashboard },
  { id: "votaciones", label: "Votaciones", icon: Vote },
  { id: "predicciones", label: "Red Cabal", icon: Network },
  { id: "proyeccion", label: "Proyección 2030", icon: TrendingUp },
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
      <div className="sticky top-0 z-30 -mx-3 -mt-3 bg-surface-muted px-3 pt-3 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8">
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
        {tab === "centro" && (
          <Lienzo>
            <Portada icono={LayoutDashboard} etiqueta="Prensa y redes" titulo="Monitoreo" descripcion="Qué se dice de María Fernanda Cabal en la prensa, en los portales y páginas de Facebook de cada región y en redes, de qué ciudad viene cada noticia, y qué hacen otros políticos. La información se trae al abrir y con el botón Actualizar.">
              <ChipPortada icono={Eye}>Todo sobre María Fernanda en un solo lugar, con mapa de regiones, y otros políticos</ChipPortada>
            </Portada>
            <MonitoreoSecciones />
          </Lienzo>
        )}
        {tab === "votaciones" && <ExploradorElectoral />}
        {tab === "predicciones" && (
          <Lienzo>
            <Portada icono={Network} etiqueta="Territorio y comunidad" titulo="Red Cabal" descripcion="Elige un lugar, de lo general a lo particular, y mira cómo le fue a María Fernanda Cabal, qué problemas tiene y quiénes la siguen allí." />
            <PrediccionesTab />
          </Lienzo>
        )}
        {tab === "proyeccion" && (
          <Lienzo>
            <Portada icono={TrendingUp} etiqueta="Escenario electoral" titulo="Proyección 2030" descripcion="El censo electoral proyectado a 2030 por municipio y por edad, con el peso de los jóvenes que votan por primera vez. Sale de la Registraduría y de las proyecciones de población del DANE." />
            <ProyeccionTab />
          </Lienzo>
        )}
        {tab === "avales" && (
          <Lienzo>
            <Portada icono={ShieldCheck} etiqueta="Verificación de aspirantes" titulo="Avales" descripcion="Hojas de vida, contratación pública y relaciones de quienes aspiran a un aval. Los datos salen de fuentes oficiales y no son un certificado de inhabilidades." />
            <AvalesTab />
          </Lienzo>
        )}
      </div>
    </div>
  );
}
