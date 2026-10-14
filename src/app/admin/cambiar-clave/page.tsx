"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";

const campo = "mt-1.5 h-11 w-full rounded-xl border border-border bg-foreground/[0.04] px-3.5 text-sm outline-none focus:border-brand";

/** Quien entra con una clave temporal la cambia aquí antes de usar el panel. */
export default function CambiarClavePage() {
  const router = useRouter();
  const [f, setF] = React.useState({ actual: "", nueva: "", repetir: "" });
  const [error, setError] = React.useState("");
  const [cargando, setCargando] = React.useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (f.nueva !== f.repetir) return setError("Las dos claves nuevas no coinciden.");
    setCargando(true);
    try {
      const res = await fetch("/api/admin/cambiar-clave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actual: f.actual, nueva: f.nueva }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "No se pudo cambiar la clave.");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la clave.");
      setCargando(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface-muted p-4">
      <form onSubmit={enviar} className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl sm:p-8">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><KeyRound className="size-5" aria-hidden="true" /></span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Cambia tu clave</h1>
        <p className="mt-1 text-sm text-muted-foreground">Entraste con una clave temporal. Elige una propia para continuar (mínimo 8 caracteres).</p>
        <label className="mt-5 block text-xs font-medium text-muted-foreground">Clave temporal<input type="password" required autoComplete="current-password" value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} className={campo} /></label>
        <label className="mt-4 block text-xs font-medium text-muted-foreground">Clave nueva<input type="password" required minLength={8} autoComplete="new-password" value={f.nueva} onChange={(e) => setF({ ...f, nueva: e.target.value })} className={campo} /></label>
        <label className="mt-4 block text-xs font-medium text-muted-foreground">Repite la clave nueva<input type="password" required minLength={8} autoComplete="new-password" value={f.repetir} onChange={(e) => setF({ ...f, repetir: e.target.value })} className={campo} /></label>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={cargando} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-60">{cargando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Guardar clave nueva</button>
      </form>
    </main>
  );
}
