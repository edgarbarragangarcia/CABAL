"use client";

import * as React from "react";
import { useTheme } from "@/components/animations/theme-provider";

import { HeroAurora } from "@/components/sections/hero-aurora";

// Igual patrón que ThemeToggle: evita parpadeo de hidratación al leer el
// tema resuelto (el server no sabe cuál es hasta que el cliente monta).
function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/**
 * Fondo aurora fijo, detrás de TODAS las páginas públicas, activo en modo
 * oscuro (el tema por defecto del sitio). En modo claro no se renderiza:
 * las páginas usan su fondo claro habitual.
 */
export function SiteAuroraBackground() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted || resolvedTheme !== "dark") return null;

  return (
    <div className="fixed inset-0 -z-10" aria-hidden="true">
      <HeroAurora />
    </div>
  );
}
