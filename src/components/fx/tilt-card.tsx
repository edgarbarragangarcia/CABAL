"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

import { cn } from "@/lib/utils";

const MotionLink = motion.create(Link);

/**
 * Tarjeta con profundidad real: se inclina hacia el puntero en 3D y una luz sigue al cursor. Lo que va dentro puede
 * «despegarse» del fondo con `translateZ` (p. ej. `[transform:translateZ(60px)]`), así el ícono y el título flotan
 * sobre la placa. El contenedor NO lleva `overflow-hidden` ni filtros (aplanarían el 3D): el recorte y el vidrio
 * van en la placa (`plate`), una capa aparte detrás.
 */
export function TiltCard({
  children,
  className,
  plate,
  href,
  label,
  intensidad = 9,
  luz = "rgba(255,255,255,0.55)",
}: {
  children: React.ReactNode;
  className?: string;
  /** Clases de la placa de fondo: color, borde, vidrio y sombra. */
  plate?: string;
  href?: string;
  /** Texto accesible del enlace cuando la tarjeta es un `href`. */
  label?: string;
  intensidad?: number;
  luz?: string;
}) {
  const quieto = useReducedMotion();
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 22 });
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const brillo = useMotionTemplate`radial-gradient(380px circle at ${mx}% ${my}%, ${luz}, transparent 62%)`;

  function mover(e: React.PointerEvent<HTMLElement>) {
    if (quieto || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 2 * intensidad);
    rx.set(-(py - 0.5) * 2 * intensidad);
    mx.set(px * 100);
    my.set(py * 100);
  }
  function soltar() {
    rx.set(0);
    ry.set(0);
    mx.set(50);
    my.set(50);
  }

  const comun = {
    onPointerMove: mover,
    onPointerLeave: soltar,
    style: { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" as const },
    className: cn("group/tilt relative block [transform-style:preserve-3d]", className),
  };
  const cuerpo = (
    <>
      <span aria-hidden className={cn("absolute inset-0 overflow-hidden rounded-[inherit]", plate)}>
        <motion.span style={{ background: brillo }} className="absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover/tilt:opacity-100" />
      </span>
      {children}
    </>
  );

  return (
    <div className="[perspective:1100px]">
      {href ? (
        <MotionLink href={href} aria-label={label} {...comun}>
          {cuerpo}
        </MotionLink>
      ) : (
        <motion.div {...comun}>{cuerpo}</motion.div>
      )}
    </div>
  );
}
