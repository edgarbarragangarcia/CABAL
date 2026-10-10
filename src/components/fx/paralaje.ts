"use client";

import * as React from "react";
import { useMotionValue, useReducedMotion, useSpring } from "framer-motion";

/**
 * Paralaje con el puntero: cada elemento se desplaza en proporción a su «profundidad» (los más cercanos, más).
 * Un único oyente global se comparte entre todos para no multiplicar eventos, y se ignora el táctil y el movimiento reducido.
 */
type Oyente = (x: number, y: number) => void;
const oyentes = new Set<Oyente>();
let escuchando = false;

function escuchar() {
  if (escuchando || typeof window === "undefined") return;
  escuchando = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      oyentes.forEach((f) => f(x, y));
    },
    { passive: true },
  );
}

export function useParalaje(profundidad: number) {
  const quieto = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  React.useEffect(() => {
    if (quieto) return;
    escuchar();
    const f: Oyente = (px, py) => {
      x.set(px * profundidad);
      y.set(py * profundidad);
    };
    oyentes.add(f);
    return () => void oyentes.delete(f);
  }, [quieto, profundidad, x, y]);
  return { x: useSpring(x, { stiffness: 60, damping: 18 }), y: useSpring(y, { stiffness: 60, damping: 18 }) };
}
