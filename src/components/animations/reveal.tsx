"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { fadeUp, staggerContainer } from "@/lib/motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
  as?: "div" | "section" | "li" | "span";
};

/**
 * Revela su contenido con una animación suave (fade + slide-up) cuando
 * entra en el viewport. Se anima una única vez para no distraer al
 * hacer scroll repetido.
 */
export function Reveal({
  children,
  className,
  variants = fadeUp,
  delay = 0,
  as = "div",
}: RevealProps) {
  const MotionComp = motion[as];

  return (
    <MotionComp
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      transition={{ delay }}
    >
      {children}
    </MotionComp>
  );
}

/** Contenedor que escalona (stagger) la animación de sus hijos directos. */
export function RevealGroup({
  children,
  className,
  as = "div",
}: Omit<RevealProps, "variants" | "delay">) {
  const MotionComp = motion[as];

  return (
    <MotionComp
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={staggerContainer}
    >
      {children}
    </MotionComp>
  );
}
