"use client";

import * as React from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

import { Container } from "@/components/ui/container";

const MANIFESTO =
  "La educación es la única forma de libertad que nadie puede quitarte. Por eso formamos, investigamos y acompañamos a quienes construyen el futuro de Colombia.";

/**
 * Una palabra del manifiesto. Se aclara conforme la sección cruza el
 * viewport: el texto se "lee solo" al bajar, que es lo que convierte un
 * párrafo largo en un momento de la página en vez de un bloque más.
 */
function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);

  return (
    <span className="relative mr-[0.28em] inline-block">
      {/* Copia tenue siempre presente: mantiene el ritmo del párrafo
          visible aunque la palabra aún no se haya "encendido". */}
      <span className="absolute inset-0 opacity-10" aria-hidden="true">
        {children}
      </span>
      <motion.span style={{ opacity }}>{children}</motion.span>
    </span>
  );
}

export function Manifesto() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "start 0.25"],
  });

  const words = MANIFESTO.split(" ");

  return (
    <section ref={ref} className="relative py-32 sm:py-44">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <span className="eyebrow inline-flex items-center gap-2.5 text-accent-ink">
              <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
              Manifiesto
            </span>
          </div>

          <p
            aria-label={MANIFESTO}
            className="font-display text-[1.75rem] font-normal leading-[1.35] tracking-[-0.02em] text-foreground sm:text-[2.5rem] lg:col-span-9 lg:text-[3rem]"
          >
            {words.map((word, i) => {
              const start = i / words.length;
              const end = start + 1 / words.length;
              return (
                <Word key={`${word}-${i}`} progress={scrollYProgress} range={[start, end]}>
                  {word}
                </Word>
              );
            })}
          </p>
        </div>
      </Container>
    </section>
  );
}
