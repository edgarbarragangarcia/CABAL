"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useReducedMotion,
} from "framer-motion";

/**
 * Fondo "aurora" para el hero oscuro: tres manchas de color en movimiento
 * lento, una malla cónica que gira, grano sutil y un foco (spotlight) que
 * sigue el cursor. Puramente decorativo — `aria-hidden`.
 */
export function HeroAurora() {
  const reduce = useReducedMotion();
  const mx = useMotionValue(50);
  const my = useMotionValue(18);
  const sx = useSpring(mx, { stiffness: 55, damping: 20, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 55, damping: 20, mass: 0.6 });
  const spotlight = useMotionTemplate`radial-gradient(560px circle at ${sx}% ${sy}%, rgba(34,197,138,0.18), transparent 60%)`;

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduce) return;
      const r = e.currentTarget.getBoundingClientRect();
      mx.set(((e.clientX - r.left) / r.width) * 100);
      my.set(((e.clientY - r.top) / r.height) * 100);
    },
    [mx, my, reduce],
  );

  return (
    <div
      aria-hidden="true"
      onPointerMove={onPointerMove}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#07080a]" />

      {/* manchas aurora */}
      <div className="absolute -left-[18%] top-[-22%] h-[46rem] w-[46rem] animate-aurora-a rounded-full bg-[radial-gradient(circle_at_center,#12b981_0%,transparent_62%)] opacity-60 blur-[70px]" />
      <div className="absolute right-[-16%] top-[6%] h-[40rem] w-[40rem] animate-aurora-b rounded-full bg-[radial-gradient(circle_at_center,#f5b301_0%,transparent_60%)] opacity-40 blur-[80px]" />
      <div className="absolute bottom-[-30%] left-[24%] h-[44rem] w-[44rem] animate-aurora-c rounded-full bg-[radial-gradient(circle_at_center,#0e7a58_0%,transparent_64%)] opacity-55 blur-[90px]" />

      {/* malla cónica girando */}
      <div className="absolute left-1/2 top-1/2 h-[54rem] w-[54rem] -translate-x-1/2 -translate-y-1/2 animate-spin-slow rounded-full opacity-[0.14] blur-2xl [background:conic-gradient(from_0deg,transparent,#22c58a_18%,transparent_38%,#ffc94a_60%,transparent_78%,#22c58a_96%,transparent)]" />

      {/* spotlight que sigue el cursor */}
      <motion.div className="absolute inset-0" style={{ background: spotlight }} />

      {/* grano + viñeta + desvanecido inferior */}
      <div className="absolute inset-0 bg-grain opacity-[0.09] mix-blend-overlay" />
      <div className="absolute inset-0 [background:radial-gradient(120%_80%_at_50%_0%,transparent_40%,#07080a_92%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#07080a]" />
    </div>
  );
}
