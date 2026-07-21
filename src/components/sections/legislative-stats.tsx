import { CalendarClock } from "lucide-react";

import { Container } from "@/components/ui/container";
import { RevealGroup, Reveal } from "@/components/animations/reveal";
import { AnimatedCounter } from "@/components/animations/animated-counter";
import {
  legislativeStats,
  legislativeStatsUpdatedAt,
} from "@/config/legislative-observatory";

export function LegislativeStats() {
  const formattedDate = new Date(`${legislativeStatsUpdatedAt}T00:00:00`).toLocaleDateString(
    "es-CO",
    { day: "numeric", month: "long", year: "numeric" }
  );

  return (
    <Container as="section" className="pb-8">
      <RevealGroup as="div" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {legislativeStats.map((stat) => (
          <Reveal
            key={stat.id}
            className="rounded-2xl border border-border bg-surface p-6"
          >
            <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
              <AnimatedCounter value={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{stat.label}</p>
          </Reveal>
        ))}
      </RevealGroup>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5" aria-hidden="true" />
        Cifras actualizadas al {formattedDate}
      </p>
    </Container>
  );
}
