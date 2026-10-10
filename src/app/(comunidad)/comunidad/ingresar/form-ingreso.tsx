"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const entrada = "w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15";

export function FormIngreso() {
  const router = useRouter();
  const [acceso, setAcceso] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const res = await fetch("/api/comunidad/ingresar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceso, password }) });
    const b = await res.json().catch(() => ({}));
    if (res.ok) { router.push("/comunidad"); router.refresh(); return; }
    setError(b.error ?? "No fue posible iniciar sesión.");
    setEnviando(false);
  }
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface sm:my-6 sm:min-h-0 sm:overflow-hidden sm:rounded-[2rem] sm:border sm:border-border sm:shadow-2xl">
      <div className="bg-gradient-to-br from-[#0a4f37] via-[#0f6b4c] to-[#14825c] px-5 pt-10 pb-10 text-white">
        <Image src="/logo-mark.png" alt="Fundación Escuela Libertad" width={44} height={44} className="rounded-full bg-white/90 p-1" />
        <h1 className="mt-5 font-display text-3xl font-semibold">Bienvenido de nuevo</h1>
        <p className="mt-1 text-sm text-white/80">Entra a tu comunidad.</p>
      </div>
      <form onSubmit={enviar} className="-mt-4 flex-1 space-y-4 rounded-t-[1.75rem] bg-surface px-5 pt-6 pb-8">
        <label className="block"><span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">Correo o usuario</span><input className={entrada} autoComplete="username" value={acceso} onChange={(e) => setAcceso(e.target.value)} /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contraseña</span><input className={entrada} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={enviando || !acceso || !password} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a4f37] to-[#14825c] px-5 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/25 disabled:opacity-60">{enviando ? <Loader2 className="size-5 animate-spin" /> : "Entrar"}</button>
        <p className="text-center text-sm text-muted-foreground">¿Aún no eres afiliado? <Link href="/unete" className="font-semibold text-brand">Afíliate</Link></p>
      </form>
    </div>
  );
}
