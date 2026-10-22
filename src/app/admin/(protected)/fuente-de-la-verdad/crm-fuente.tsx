"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { GuardarLeads } from "../analisis-publicaciones/red-crm-todos";

const n = (v: number) => Math.round(v).toLocaleString("es-CO");

/** Los leads del CRM (Bitrix24) guardados en Supabase: de ahí sale la Red Cabal. Aquí se ve cuántos hay y se traen o actualizan. */
export function CrmFuente({ alCargar }: { alCargar: () => void }) {
  const [estado, setEstado] = React.useState<{ guardados: number; webhook: boolean } | null>(null);
  const [error, setError] = React.useState("");
  const leer = React.useCallback(() => {
    fetch("/api/admin/red-crm/leads", { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "No se pudo leer."); setError(""); setEstado(j as { guardados: number; webhook: boolean }); })
      .catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(() => { leer(); }, [leer]);

  if (error) return <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>;
  if (!estado) return <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Leyendo…</p>;
  const tarjeta = "rounded-2xl border border-border bg-surface p-4 shadow-sm";
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Los leads de tu CRM de Bitrix24 (nombre, ciudad, departamento y los campos para segmentar; <b>sin teléfonos ni correos</b>) guardados en la tabla <b>crm_leads</b> de Supabase. Con ellos se arma la <b>Red Cabal</b> sin depender de que Bitrix24 responda.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Leads en Supabase</p><p className="mt-1 text-xl font-bold tabular-nums">{n(estado.guardados)}</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Conexión con Bitrix24</p><p className="mt-1 text-xl font-bold">{estado.webhook ? "Configurada" : "Falta el webhook"}</p></div>
        <div className={tarjeta}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Se usa en</p><p className="mt-1 text-xl font-bold">Red Cabal</p></div>
      </div>
      <GuardarLeads webhook={estado.webhook} />
      <button type="button" onClick={() => { leer(); alCargar(); }} className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold hover:bg-surface-muted">Actualizar el número</button>
    </div>
  );
}
