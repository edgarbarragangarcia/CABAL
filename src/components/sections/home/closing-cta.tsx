import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

/** Cierre a sangre: una sola idea, una sola acción. */
export function ClosingCta() {
  return (
    <section className="relative isolate overflow-hidden border-t border-border py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(60%_80%_at_50%_100%,color-mix(in_oklab,var(--brand)_12%,transparent)_0%,transparent_70%)]"
      />

      <Container className="flex flex-col items-center text-center">
        <Reveal>
          <span className="eyebrow inline-flex items-center gap-2.5 text-accent-ink">
            <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
            Súmate
            <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
          </span>
        </Reveal>

        <Reveal delay={0.08}>
          <h2 className="mt-6 max-w-[15ch] text-balance font-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.025em] sm:text-6xl lg:text-7xl">
            Cada aporte se vuelve <span className="italic text-accent-ink">una clase</span>
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Financiamos becas, materiales y presencia en territorio. El informe de
            ejecución es público, y siempre lo será.
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-elev-2">
              <Link href="/donar">
                <Heart className="size-4" aria-hidden="true" />
                Donar ahora
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contacto">
                Ser aliado
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.32}>
          <p className="eyebrow mt-10 text-[0.625rem]">
            Donación deducible · Pago seguro · Sin permanencia
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
