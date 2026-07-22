import type { Metadata } from "next";
import { Newspaper, ScrollText } from "lucide-react";

import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { FeedEmptyState } from "@/components/sections/feed-empty-state";
import { Reveal } from "@/components/animations/reveal";

export const metadata: Metadata = {
  title: "Boletines",
  description:
    "Boletín de derechos humanos y boletín de prensa de la Fundación Escuela Libertad.",
};

export default function BoletinesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Academia"
        title="Boletines"
        description="Reportes periódicos sobre derechos humanos en Colombia y comunicados oficiales de la fundación."
      />

      <Container as="section" className="pb-16">
        <Reveal className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <ScrollText className="size-4" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold tracking-tight">Boletín de Derechos Humanos</h2>
        </Reveal>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Reportes periódicos sobre la situación de derechos humanos en el país, con especial
          atención a líderes sociales y comunidades afectadas por la violencia.
        </p>
        <div className="mt-6">
          <FeedEmptyState message="El boletín se está migrando a esta plataforma. Vuelve pronto." />
        </div>
      </Container>

      <Container as="section" className="pb-32">
        <Reveal className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Newspaper className="size-4" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold tracking-tight">Boletín de Prensa</h2>
        </Reveal>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Comunicados oficiales y posiciones públicas de la fundación frente a la coyuntura
          nacional.
        </p>
        <div className="mt-6">
          <FeedEmptyState message="Los comunicados se están migrando a esta plataforma. Vuelve pronto." />
        </div>
      </Container>
    </>
  );
}
