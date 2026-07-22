"use client";

import * as React from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

/**
 * Inicializa Lenis (smooth scroll de alto rendimiento) en el cliente y
 * conduce el loop de animación con requestAnimationFrame. Respeta
 * `prefers-reduced-motion` desactivándose para usuarios que lo soliciten.
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lenisRef = React.useRef<Lenis | null>(null);

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
    lenisRef.current = lenis;

    let frameId: number;
    function raf(time: number) {
      lenis.raf(time);
      frameId = requestAnimationFrame(raf);
    }
    frameId = requestAnimationFrame(raf);

    // Recalcula la altura del contenido cuando cambia (mapas, imágenes,
    // gráficas que se cargan de forma asíncrona) — sin esto, Lenis puede
    // quedar "atascado" con el alto de la página anterior tras una
    // navegación entre rutas de distinto tamaño.
    const resizeObserver = new ResizeObserver(() => lenis.resize());
    resizeObserver.observe(document.documentElement);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(frameId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    lenisRef.current?.resize();
    lenisRef.current?.scrollTo(0, { immediate: true });
  }, [pathname]);

  return <>{children}</>;
}
