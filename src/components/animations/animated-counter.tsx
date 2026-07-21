"use client";

import * as React from "react";
import { animate, useInView, useMotionValue, useTransform } from "framer-motion";

/** Contador numérico que anima de 0 al valor final cuando entra en el viewport. */
export function AnimatedCounter({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest).toLocaleString("es-CO"));
  const [display, setDisplay] = React.useState("0");

  React.useEffect(() => {
    const unsubscribe = rounded.on("change", setDisplay);
    return unsubscribe;
  }, [rounded]);

  React.useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionValue, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [isInView, motionValue, value]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}
