"use client";

import * as React from "react";
import { Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Eye, EyeOff, Loader2, LogIn, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroAurora } from "@/components/sections/hero-aurora";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }
      router.replace(from);
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onSubmit={onSubmit}
      className="glass-panel w-full max-w-sm rounded-3xl p-8 text-white shadow-2xl"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-[#22c58a] text-[#04140d]">
          <BookOpen className="size-4.5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">Escuela Libertad</p>
          <p className="text-xs text-zinc-400">Panel administrativo</p>
        </div>
      </div>

      <h1 className="mt-6 text-xl font-semibold tracking-tight">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Acceso restringido al equipo de la fundación.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-xs font-medium text-zinc-400">
            Correo
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@escuela.com"
            className="mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-[#22c58a]"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-xs font-medium text-zinc-400">
            Clave
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="h-11 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 pr-10 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-[#22c58a]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar clave" : "Mostrar clave"}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-400 hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className={cn(
            "mt-4 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300"
          )}
        >
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="mt-6 w-full bg-[#22c58a] text-[#04140d] shadow-[0_0_40px_-8px_rgba(34,197,138,0.7)] hover:bg-[#2ee59c]"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogIn className="size-4" aria-hidden="true" />
        )}
        Entrar
      </Button>

      <p className="mt-6 text-center text-[11px] text-zinc-500">
        Sistema de acceso provisional — un solo usuario, sin base de datos.
      </p>
    </motion.form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="relative flex min-h-screen overflow-hidden text-white">
      <HeroAurora />

      {/* Panel del formulario */}
      <div className="relative z-10 flex w-full items-center justify-center px-4 py-16 lg:w-[46%] lg:px-12">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>

      {/* Panel de foto (solo escritorio) */}
      <div className="relative hidden w-[54%] lg:block">
        <Image
          src="/cabal-hero.jpg"
          alt="María Fernanda Cabal"
          fill
          priority
          sizes="54vw"
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#07080a_0%,rgba(7,8,10,0.55)_25%,transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#07080a_0%,transparent_35%)]" />
        <div className="bg-grain absolute inset-0 opacity-[0.1] mix-blend-overlay" />

        <div className="absolute bottom-10 left-10 right-10">
          <p className="text-2xl font-semibold leading-snug tracking-tight">
            Construimos libertad
            <br />a través de la educación.
          </p>
          <p className="mt-2 text-sm text-zinc-400">Fundación Escuela Libertad</p>
        </div>
      </div>
    </main>
  );
}
