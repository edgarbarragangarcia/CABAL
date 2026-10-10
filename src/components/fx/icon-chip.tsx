import * as React from "react";
import type { Icon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/**
 * Ícono duotono dentro de una pieza sobria: marfil con filo dorado y una sombra suave. El color vive solo en el trazo
 * del ícono (verde bosque, oro viejo…), no en el fondo: lo elegante aquí es la contención.
 */
const TONOS = {
  esmeralda: "text-emerald-800 dark:text-emerald-300",
  oro: "text-amber-700 dark:text-amber-300",
  turquesa: "text-teal-800 dark:text-teal-300",
  bosque: "text-emerald-950 dark:text-emerald-200",
} as const;

export type TonoChip = keyof typeof TONOS;

export function IconChip({ icono: Ico, tono = "esmeralda", className, iconClass }: { icono: Icon; tono?: TonoChip; className?: string; iconClass?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-14 shrink-0 place-items-center rounded-2xl border border-accent/30 bg-gradient-to-b from-white to-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_12px_26px_-16px_rgba(10,30,22,0.55)] dark:border-white/12 dark:from-white/10 dark:to-white/[0.03] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_26px_-16px_rgba(0,0,0,0.8)]",
        TONOS[tono],
        className,
      )}
    >
      <Ico weight="duotone" className={cn("size-7", iconClass)} />
    </span>
  );
}
