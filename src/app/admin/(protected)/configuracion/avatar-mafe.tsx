"use client";

import { MessageCircle } from "lucide-react";

import { fijarOculto, useMafeOculto } from "@/components/mafe/visibilidad";

/** Mostrar u ocultar el avatar de MaFe que flota en la esquina. Se recuerda en este navegador. */
export function AvatarMafe() {
  const oculto = useMafeOculto();
  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-brand" aria-hidden="true" />Avatar de MaFe</h2>
      <p className="mt-1 text-sm text-muted-foreground">El asistente que flota en la esquina inferior derecha. Si lo quitas, deja de aparecer en este navegador; el chat sigue disponible desde la barra del celular.</p>
      <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={!oculto} onChange={(e) => fijarOculto(!e.target.checked)} />
        Mostrar el avatar de MaFe
      </label>
    </section>
  );
}
