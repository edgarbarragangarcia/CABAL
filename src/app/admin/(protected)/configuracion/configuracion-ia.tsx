"use client";

import * as React from "react";
import { Check, KeyRound, Loader2, TriangleAlert } from "lucide-react";

type Proveedor = "anthropic" | "gemini" | "openai";
type Resumen = {
  almacen: "redis" | "cookie";
  proveedor: Proveedor;
  modelo: string;
  claves: Partial<Record<Proveedor, string>>;
  anthropicEnv: boolean;
};

const OPCIONES: { id: Proveedor; nombre: string; modelo: string; ayuda: string }[] = [
  { id: "anthropic", nombre: "Claude (Anthropic)", modelo: "claude-opus-5-5", ayuda: "console.anthropic.com → API keys" },
  { id: "gemini", nombre: "Gemini (Google)", modelo: "gemini-2.5-pro", ayuda: "aistudio.google.com → Get API key" },
  { id: "openai", nombre: "OpenAI", modelo: "gpt-5", ayuda: "platform.openai.com → API keys" },
];

export function ConfiguracionIA() {
  const [resumen, setResumen] = React.useState<Resumen | null>(null);
  const [proveedor, setProveedor] = React.useState<Proveedor>("anthropic");
  const [modelo, setModelo] = React.useState("");
  const [clave, setClave] = React.useState("");
  const [estado, setEstado] = React.useState<{ guardando?: boolean; ok?: boolean; error?: string }>({});

  React.useEffect(() => {
    fetch("/api/admin/configuracion")
      .then((r) => r.json())
      .then((r: Resumen) => {
        setResumen(r);
        setProveedor(r.proveedor);
        setModelo(r.modelo);
      })
      .catch(() => setEstado({ error: "No se pudo leer la configuración." }));
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado({ guardando: true });
    const res = await fetch("/api/admin/configuracion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proveedor, modelo, clave }),
    });
    const body = await res.json();
    if (!res.ok) return setEstado({ error: body.error ?? "No se pudo guardar." });
    setResumen(body);
    setClave("");
    setEstado({ ok: true });
  };

  if (!resumen && !estado.error) {
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  }
  const opcion = OPCIONES.find((o) => o.id === proveedor)!;
  const guardada = resumen?.claves[proveedor];

  return (
    <form onSubmit={guardar} className="mt-6 space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      {resumen?.almacen === "cookie" && (
        <p className="flex items-start gap-2 rounded-xl border border-sky-400/40 bg-sky-500/5 p-3 text-xs text-sky-800 dark:text-sky-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          La clave se guarda cifrada solo en este navegador. Para compartirla con otros equipos, configura Upstash Redis en
          Vercel.
        </p>
      )}

      <fieldset>
        <legend className="text-sm font-semibold">Proveedor</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {OPCIONES.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setProveedor(o.id);
                setModelo(o.id === resumen?.proveedor ? resumen.modelo : o.modelo);
                setEstado({});
              }}
              aria-pressed={proveedor === o.id}
              className={`rounded-xl border p-3 text-left text-sm transition ${
                proveedor === o.id ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border hover:bg-surface-muted"
              }`}
            >
              {o.nombre}
              {resumen?.claves[o.id] && <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Clave guardada</span>}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="font-semibold">Modelo</span>
        <input
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          placeholder={opcion.modelo}
          className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </label>

      <label className="block text-sm">
        <span className="flex items-center gap-1.5 font-semibold">
          <KeyRound className="size-4" aria-hidden="true" /> Clave API
        </span>
        <input
          type="password"
          autoComplete="off"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder={guardada ? `Guardada (${guardada}). Escribe otra para reemplazarla.` : "Pega la clave aquí"}
          className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-brand"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Se obtiene en {opcion.ayuda}. Se guarda cifrada y no vuelve a mostrarse.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={estado.guardando || (!clave.trim() && !guardada)}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
        >
          {estado.guardando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Guardar y usar {opcion.nombre}
        </button>
        {estado.ok && (
          <span className="flex items-center gap-1 text-sm text-brand">
            <Check className="size-4" aria-hidden="true" /> Guardado. Los análisis usarán {opcion.nombre}.
          </span>
        )}
        {estado.error && <span className="text-sm text-red-700 dark:text-red-300">{estado.error}</span>}
      </div>
    </form>
  );
}
