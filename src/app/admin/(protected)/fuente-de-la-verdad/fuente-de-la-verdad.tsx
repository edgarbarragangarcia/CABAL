"use client";

import * as React from "react";
import { Database, Library } from "lucide-react";

import { DatosTab } from "../analisis-publicaciones/datos-tab";
import { DocumentosTab } from "../analisis-publicaciones/documentos-tab";

const OPCIONES = [
  { id: "datos", label: "Datos electorales", icon: Database },
  { id: "documentos", label: "Documentos", icon: Library },
] as const;

/** Ambas quedan montadas una vez abiertas: tienen cargas en curso que no deben cortarse al cambiar de pestaña. */
export function FuenteDeLaVerdad() {
  const [tab, setTab] = React.useState<(typeof OPCIONES)[number]["id"]>("datos");
  const [abiertas, setAbiertas] = React.useState<ReadonlySet<string>>(new Set(["datos"]));
  const ir = (id: typeof tab) => {
    setTab(id);
    setAbiertas((a) => new Set(a).add(id));
  };
  return (
    <div className="mt-6">
      <div className="flex gap-1 border-b border-border">
        {OPCIONES.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => ir(o.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${tab === o.id ? "border-brand font-semibold text-brand" : "border-transparent font-medium text-muted-foreground hover:text-foreground"}`}
          >
            <o.icon className="size-4" aria-hidden="true" />
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {abiertas.has("datos") && <div hidden={tab !== "datos"}><DatosTab /></div>}
        {abiertas.has("documentos") && <div hidden={tab !== "documentos"}><DocumentosTab /></div>}
      </div>
    </div>
  );
}
