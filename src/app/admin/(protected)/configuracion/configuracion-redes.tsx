"use client";

import * as React from "react";
import { Check, Loader2, Radio } from "lucide-react";

type Resumen = { youtube: string | null; x: string | null };

const CAMPOS: { id: "youtube" | "x"; nombre: string; ayuda: React.ReactNode }[] = [
  {
    id: "youtube",
    nombre: "YouTube — clave API (gratis)",
    ayuda: (
      <>
        En Google Cloud Console crea un proyecto, activa <b>YouTube Data API v3</b> y crea una <b>clave de API</b>. Da suscriptores, vistas,
        espectadores en vivo, comentarios y los últimos 50 videos del canal SoyCabalTV.
      </>
    ),
  },
  {
    id: "x",
    nombre: "X (Twitter) — Bearer token (de pago)",
    ayuda: (
      <>
        En developer.x.com crea una app y copia su <b>Bearer Token</b>. Requiere un plan con búsqueda reciente (Basic, desde unos 100 USD al mes).
        Muestra las menciones de María Fernanda Cabal en los últimos 7 días; el historial más largo exige el plan Pro.
      </>
    ),
  },
];

/** Credenciales de redes sociales: se guardan cifradas y nunca vuelven al navegador. */
export function ConfiguracionRedes() {
  const [resumen, setResumen] = React.useState<Resumen | null>(null);
  const [valores, setValores] = React.useState({ youtube: "", x: "" });
  const [estado, setEstado] = React.useState<{ guardando?: boolean; ok?: boolean; error?: string }>({});

  React.useEffect(() => {
    fetch("/api/admin/configuracion/redes", { cache: "no-store" })
      .then((r) => r.json())
      .then(setResumen)
      .catch(() => setResumen(null));
  }, []);

  const enviar = (cuerpo: Partial<Record<"youtube" | "x", string>>) => {
    setEstado({ guardando: true });
    fetch("/api/admin/configuracion/redes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "No se pudo guardar.");
        setResumen(body);
        setValores({ youtube: "", x: "" });
        setEstado({ ok: true });
      })
      .catch((err: Error) => setEstado({ error: err.message }));
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    const cuerpo: Partial<Record<"youtube" | "x", string>> = {};
    if (valores.youtube.trim()) cuerpo.youtube = valores.youtube;
    if (valores.x.trim()) cuerpo.x = valores.x;
    if (Object.keys(cuerpo).length) enviar(cuerpo);
  };

  return (
    <form onSubmit={guardar} className="mt-6 space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Radio className="size-4 text-brand" aria-hidden="true" /> Redes sociales
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecta las cuentas para ver en el tablero datos reales al minuto y de semanas atrás. Sin credencial no se muestra ni se simula nada.
        </p>
      </div>
      {CAMPOS.map((c) => (
        <div key={c.id}>
          <label className="text-sm font-semibold" htmlFor={`red-${c.id}`}>
            {c.nombre}
          </label>
          {resumen?.[c.id] && (
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <Check className="size-3" aria-hidden="true" /> Conectada {resumen[c.id]}
              <button type="button" onClick={() => enviar({ [c.id]: "" })} className="ml-2 underline">
                Quitar
              </button>
            </span>
          )}
          <input
            id={`red-${c.id}`}
            type="password"
            autoComplete="off"
            value={valores[c.id]}
            onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
            placeholder={resumen?.[c.id] ? "Pega una nueva para reemplazarla" : "Pega la credencial"}
            className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-brand"
          />
          <p className="mt-1 text-xs text-muted-foreground">{c.ayuda}</p>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Facebook e Instagram: Meta solo entrega datos de páginas y cuentas profesionales que administras, con un token aprobado por ellos; aún no están conectadas.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={estado.guardando || (!valores.youtube.trim() && !valores.x.trim())}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {estado.guardando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Guardar
        </button>
        {estado.ok && <span className="text-sm text-emerald-700 dark:text-emerald-300">Guardado.</span>}
        {estado.error && <span className="text-sm text-red-700 dark:text-red-300">{estado.error}</span>}
      </div>
    </form>
  );
}
