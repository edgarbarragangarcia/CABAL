"use client";

import * as React from "react";
import { Gauge, PenSquare, Users } from "lucide-react";

import { DecisionTab } from "./decision-tab";
import { PublicarTab } from "./publicar-tab";

type Pestana = "decision" | "publicar";

const PESTANAS: { id: Pestana; texto: string; icono: typeof Gauge }[] = [
  { id: "decision", texto: "Panel de decisión", icono: Gauge },
  { id: "publicar", texto: "Publicar", icono: PenSquare },
];

export default function ComunidadAdminPage() {
  const [tab, setTab] = React.useState<Pestana>("decision");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Users className="size-6 text-brand" /> Comunidad</h1>
        <p className="mt-1 text-sm text-muted-foreground">Qué está pasando entre los afiliados de la comunidad del partido y la cuenta oficial de María Fernanda Cabal.</p>
      </div>

      <div role="tablist" aria-label="Comunidad" className="inline-flex flex-wrap gap-1 rounded-full bg-surface p-1 text-sm shadow-sm ring-1 ring-border">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={tab === p.id} onClick={() => setTab(p.id)} className={tab === p.id ? "inline-flex items-center gap-2 rounded-full bg-brand px-4 py-1.5 font-semibold text-brand-foreground shadow" : "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-muted-foreground transition hover:text-foreground"}>
            <p.icono className="size-4" />{p.texto}
          </button>
        ))}
      </div>

      {tab === "decision" && <DecisionTab irAPublicar={() => setTab("publicar")} />}
      {tab === "publicar" && <PublicarTab />}
    </div>
  );
}
