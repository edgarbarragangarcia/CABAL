import * as React from "react";

import { cn } from "@/lib/utils";

/** Etiqueta de sección: filete dorado y versalitas. Sobria a propósito. */
export function Eyebrow({ children, className, oscuro }: { children: React.ReactNode; className?: string; oscuro?: boolean }) {
  return (
    <span className={cn("eyebrow inline-flex items-center gap-2.5", oscuro ? "!text-[#e0bd7c]" : "!text-accent-ink", className)}>
      <span className={cn("h-px w-8", oscuro ? "bg-[#e0bd7c]/60" : "bg-accent/60")} aria-hidden="true" />
      {children}
    </span>
  );
}
