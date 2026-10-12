"use client";

import * as React from "react";
import { Check, TriangleAlert, X } from "lucide-react";

/** Avisos breves del CMS: aparecen abajo, se van solos y se pueden cerrar. */

export type Aviso = { id: number; ok: boolean; texto: string };

export function useAvisos() {
  const [avisos, setAvisos] = React.useState<Aviso[]>([]);
  const n = React.useRef(0);
  const cerrar = React.useCallback((id: number) => setAvisos((l) => l.filter((a) => a.id !== id)), []);
  const avisar = React.useCallback(
    (texto: string, ok = true) => {
      const id = ++n.current;
      setAvisos((l) => [...l.slice(-3), { id, ok, texto }]);
      setTimeout(() => cerrar(id), ok ? 4000 : 8000);
    },
    [cerrar]
  );
  return { avisos, avisar, cerrar };
}

export function Avisos({ avisos, cerrar }: { avisos: Aviso[]; cerrar: (id: number) => void }) {
  if (avisos.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[95] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} role={a.ok ? "status" : "alert"} className={`pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-xl ring-1 ${a.ok ? "bg-emerald-600 text-white ring-emerald-700" : "bg-rose-600 text-white ring-rose-700"}`}>
          {a.ok ? <Check className="mt-0.5 size-4 shrink-0" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" />}
          <span className="min-w-0 flex-1">{a.texto}</span>
          <button type="button" onClick={() => cerrar(a.id)} aria-label="Cerrar aviso" className="shrink-0 opacity-80 hover:opacity-100"><X className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}
