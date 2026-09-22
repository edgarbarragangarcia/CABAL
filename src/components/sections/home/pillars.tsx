"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

const PILLARS = [
  {
    n: "01",
    title: "Formación",
    href: "/cursos",
    lead: "Academia abierta",
    body: "Cursos y diplomados en libertad económica, instituciones y liderazgo público, con profesores que ejercen lo que enseñan.",
  },
  {
    n: "02",
    title: "Investigación",
    href: "/academia",
    lead: "Observatorios",
    body: "Seguimiento legislativo, análisis económico y publicaciones que sostienen el debate con datos verificables, no con consignas.",
  },
  {
    n: "03",
    title: "Territorio",
    href: "/proyectos",
    lead: "Programas activos",
    body: "Escuelas rurales, empleabilidad juvenil y liderazgo local en las comunidades donde la oportunidad todavía no llega sola.",
  },
];

/**
 * Pilares como lista editorial: filas separadas por filete, numeral
 * grande en serif y un fondo que se enciende al pasar. Una rejilla de
 * tarjetas aquí diría lo mismo con la mitad de la intención.
 */
export function Pillars() {
  return (
    <section className="relative py-24 sm:py-32">
      <Container>
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow inline-flex items-center gap-2.5 text-accent-ink">
              <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
              Qué hacemos
            </span>
            <h2 className="mt-5 max-w-[16ch] text-balance font-display text-4xl font-normal leading-[1.08] sm:text-5xl">
              Tres frentes, una misma convicción
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Formamos a quien decide, medimos a quien gobierna y acompañamos a quien
            empieza.
          </p>
        </Reveal>

        <div className="mt-16 border-t border-border">
          {PILLARS.map((p, i) => (
            <Reveal key={p.n} delay={i * 0.08}>
              <Link
                href={p.href}
                className="group relative block border-b border-border py-10 transition-colors sm:py-12"
              >
                {/* Lavado de color que entra desde la izquierda en hover */}
                <span
                  className="pointer-events-none absolute inset-y-0 -inset-x-6 -z-10 origin-left scale-x-0 rounded-2xl bg-surface-muted/70 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
                  aria-hidden="true"
                />

                <div className="grid items-baseline gap-4 md:grid-cols-12 md:gap-8">
                  <span className="font-display text-sm text-accent-ink md:col-span-1">
                    {p.n}
                  </span>

                  <div className="md:col-span-4">
                    <p className="eyebrow mb-2">{p.lead}</p>
                    <h3 className="font-display text-3xl font-normal tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1 sm:text-4xl">
                      {p.title}
                    </h3>
                  </div>

                  <p className="max-w-prose text-base leading-relaxed text-muted-foreground md:col-span-6">
                    {p.body}
                  </p>

                  <span className="flex md:col-span-1 md:justify-end">
                    <motion.span
                      className="flex size-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-300 group-hover:border-brand group-hover:bg-brand group-hover:text-brand-foreground"
                      aria-hidden="true"
                    >
                      <ArrowUpRight className="size-5" />
                    </motion.span>
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
