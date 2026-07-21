import * as React from "react";
import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
  as: Comp = "div",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { as?: React.ElementType }) {
  return (
    <Comp className={cn("mx-auto w-full max-w-7xl px-6 lg:px-8", className)} {...props}>
      {children}
    </Comp>
  );
}
