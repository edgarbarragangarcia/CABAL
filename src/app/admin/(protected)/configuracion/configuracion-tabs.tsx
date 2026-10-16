"use client";

import * as React from "react";
import { BrainCircuit, Gauge, Mail, Mic, Share2, Users } from "lucide-react";

import { ConfiguracionIA } from "./configuracion-ia";
import { ConfiguracionRedes } from "./configuracion-redes";
import { InformeSemanal } from "./informe-semanal";
import { PilotoPanel } from "./piloto-panel";
import { UsuariosPanel } from "./usuarios-panel";
import { VozPanel } from "./voz-panel";

const TABS = [
  { id: "ia", etiqueta: "Inteligencia artificial", ayuda: "Modelo y clave", icono: BrainCircuit },
  { id: "voz", etiqueta: "Voz de la Dra.", ayuda: "Textos y videos", icono: Mic },
  { id: "redes", etiqueta: "Redes sociales", ayuda: "Claves de YouTube y X", icono: Share2 },
  { id: "usuarios", etiqueta: "Usuarios", ayuda: "Quién entra al panel", icono: Users },
  { id: "informe", etiqueta: "Informe semanal", ayuda: "Telegram", icono: Mail },
  { id: "piloto", etiqueta: "Piloto de IA", ayuda: "Tiempo, costo y precisión", icono: Gauge },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** La configuración en pestañas: cada tema aparece solo cuando se abre, y las pestañas quedan montadas para no perder lo escrito. */
export function ConfiguracionTabs() {
  const [tab, setTab] = React.useState<TabId>("ia");
  const [abiertas, setAbiertas] = React.useState<ReadonlySet<TabId>>(new Set(["ia"]));
  const ir = (id: TabId) => {
    setTab(id);
    setAbiertas((a) => new Set(a).add(id));
  };
  return (
    <div>
      <div role="tablist" aria-label="Secciones de configuración" className="flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
        {TABS.map((t) => {
          const I = t.icono;
          const activa = t.id === tab;
          return (
            <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={activa} aria-controls={`panel-${t.id}`} onClick={() => ir(t.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition ${activa ? "border-brand font-semibold text-brand" : "border-transparent font-medium text-muted-foreground hover:text-foreground"}`}>
              <I className="size-4" aria-hidden="true" />
              <span className="text-left leading-tight">{t.etiqueta}<span className="hidden text-[11px] font-normal text-muted-foreground lg:block">{t.ayuda}</span></span>
            </button>
          );
        })}
      </div>
      <div className="mt-6">
        {abiertas.has("ia") && <div role="tabpanel" id="panel-ia" aria-labelledby="tab-ia" hidden={tab !== "ia"} className="mx-auto w-full max-w-3xl"><ConfiguracionIA /></div>}
        {abiertas.has("voz") && <div role="tabpanel" id="panel-voz" aria-labelledby="tab-voz" hidden={tab !== "voz"}><VozPanel /></div>}
        {abiertas.has("redes") && <div role="tabpanel" id="panel-redes" aria-labelledby="tab-redes" hidden={tab !== "redes"} className="mx-auto w-full max-w-3xl"><ConfiguracionRedes /></div>}
        {abiertas.has("usuarios") && <div role="tabpanel" id="panel-usuarios" aria-labelledby="tab-usuarios" hidden={tab !== "usuarios"} className="mx-auto w-full max-w-3xl"><UsuariosPanel /></div>}
        {abiertas.has("informe") && <div role="tabpanel" id="panel-informe" aria-labelledby="tab-informe" hidden={tab !== "informe"} className="mx-auto w-full max-w-3xl"><InformeSemanal /></div>}
        {abiertas.has("piloto") && <div role="tabpanel" id="panel-piloto" aria-labelledby="tab-piloto" hidden={tab !== "piloto"} className="mx-auto w-full max-w-3xl"><PilotoPanel /></div>}
      </div>
    </div>
  );
}
