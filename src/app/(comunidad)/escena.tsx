"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

/**
 * Escena 3D de fondo para la afiliación y el ingreso: suelo en perspectiva, esferas con volumen que flotan y luces
 * que siguen suavemente al puntero (paralaje). Todo en CSS/Framer Motion: sin librerías 3D pesadas, y quieto si la
 * persona pidió menos movimiento.
 */
const ORBES: { x: string; y: string; t: number; c: string; d: number; retraso: number }[] = [];

export function Escena() {
  const quieto = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  React.useEffect(() => {
    const mover = (e: PointerEvent) => {
      px.set(e.clientX / window.innerWidth - 0.5);
      py.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", mover);
    return () => window.removeEventListener("pointermove", mover);
  }, [px, py]);
  const sx = useSpring(px, { stiffness: 50, damping: 18 });
  const sy = useSpring(py, { stiffness: 50, damping: 18 });
  const lejos = { x: useTransform(sx, (v) => v * 24), y: useTransform(sy, (v) => v * 24) };
  const cerca = { x: useTransform(sx, (v) => v * -64), y: useTransform(sy, (v) => v * -64) };

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[#03110b]">
      <style>{`@keyframes escena-rejilla{to{background-position:0 56px}}`}</style>

      {/* Luces de fondo */}
      <motion.div style={lejos} className="absolute inset-0">
        <div className="absolute -top-40 left-1/2 size-[46rem] -translate-x-1/2 rounded-full bg-emerald-500/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 size-[30rem] rounded-full bg-amber-400/15 blur-[110px]" />
        <div className="absolute -bottom-32 -left-24 size-[28rem] rounded-full bg-teal-400/20 blur-[110px]" />
      </motion.div>

      {/* Suelo en perspectiva */}
      <div className="absolute inset-x-[-60%] bottom-[-8%] h-[58%] [perspective:520px]">
        <div
          className="size-full origin-bottom [transform:rotateX(64deg)] [background-image:linear-gradient(rgba(110,231,183,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(110,231,183,0.28)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_top,black_10%,transparent)]"
          style={quieto ? undefined : { animation: "escena-rejilla 2.4s linear infinite" }}
        />
      </div>

      {/* Esferas con volumen */}
      <motion.div style={cerca} className="absolute inset-0">
        {ORBES.map((o, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              left: o.x,
              top: o.y,
              width: o.t,
              height: o.t,
              background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), ${o.c} 38%, rgba(0,0,0,0.65) 100%)`,
              boxShadow: `0 28px 60px -10px ${o.c}66, inset -10px -14px 30px rgba(0,0,0,0.45)`,
            }}
            animate={quieto ? undefined : { y: [0, -26, 0], rotate: [0, 6, 0] }}
            transition={{ duration: o.d, delay: o.retraso, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </motion.div>

      {/* Viñeta para dar profundidad */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

/** Una cédula estilizada que gira en 3D (no es un documento real: es solo ilustración). */
export function Cedula3D({ className = "" }: { className?: string }) {
  const quieto = useReducedMotion();
  return (
    <div className={`[perspective:900px] ${className}`} aria-hidden>
      <motion.div
        className="relative mx-auto h-40 w-64 [transform-style:preserve-3d]"
        animate={quieto ? { rotateY: -14, rotateX: 8 } : { rotateY: [-24, 24, -24], rotateX: [10, -4, 10] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-[#14825c] via-[#0a4f37] to-[#06281c] p-4 shadow-[0_40px_80px_-20px_rgba(16,185,129,0.55)]">
          <div className="absolute -top-10 -right-10 size-36 rounded-full bg-amber-300/25 blur-2xl" />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.18)_48%,transparent_62%)]" />
          <div className="relative flex items-start justify-between">
            <p className="text-[9px] font-semibold tracking-[0.2em] text-white/80 uppercase">Afiliado · Escuela Libertad</p>
            <Image src="/logo-mark.png" alt="" width={28} height={28} className="rounded-full bg-white/90 p-0.5" />
          </div>
          <div className="relative mt-5 flex gap-3">
            <div className="grid size-16 place-items-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur"><span className="size-7 rounded-full bg-white/70" /></div>
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-2.5 w-4/5 rounded-full bg-white/70" />
              <div className="h-2 w-3/5 rounded-full bg-white/40" />
              <div className="h-2 w-2/5 rounded-full bg-amber-300/80" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
