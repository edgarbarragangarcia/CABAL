"use client";

import * as React from "react";
import Lenis from "lenis";

/**
 * Inicializa Lenis (smooth scroll de alto rendimiento) en el cliente y
 * conduce el loop de animación con requestAnimationFrame. Respeta
 * `prefers-reduced-motion` desactivándose para usuarios que lo soliciten.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let frameId: number;
    function raf(time: number) {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    }
    frameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frameId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
