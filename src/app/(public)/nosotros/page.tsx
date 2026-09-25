import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/animations/reveal";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Conoce la misión, visión y principios de la Fundación Escuela Libertad.",
};

const PURPOSE = [
  {
    label: "Misión",
    body: "Ampliar el acceso a educación de calidad y oportunidades de desarrollo para niños, jóvenes y familias en situación de vulnerabilidad.",
  },
  {
    label: "Visión",
    body: "Ser la fundación de referencia en Colombia por el impacto medible y sostenido de nuestros programas educativos y comunitarios.",
  },
];

const PRINCIPLES = [
  {
    n: "01",
    title: "Evidencia antes que consigna",
    body: "Cada cifra que publicamos tiene fuente verificable. Si no la tiene, no la publicamos.",
  },
  {
    n: "02",
    title: "Cuentas claras",
    body: "El informe de ejecución es público y trimestral. Quien aporta tiene derecho a saber dónde terminó su aporte.",
  },
  {
    n: "03",
    title: "Territorio, no escritorio",
    body: "Los programas se diseñan con las comunidades que los reciben, no para ellas desde Bogotá.",
  },
  {
    n: "04",
    title: "Formar, no adoctrinar",
    body: "Enseñamos a leer datos y a sostener un argumento. Las conclusiones son de cada quien.",
  },
];

export default function NosotrosPage() {
  return (
    <>
      <PageHeader
        eyebrow="Nosotros"
        title="La educación es la herramienta más poderosa para transformar una comunidad"
        description="La Fundación Escuela Libertad trabaja de la mano con familias, líderes locales y aliados estratégicos para construir programas educativos y sociales sostenibles en todo el territorio colombiano."
      />

      {/* Propósito: rejilla con etiqueta fija a la izquierda. El contraste
          de escala entre la versalita y el serif grande es lo que da la
          jerarquía — un recuadro alrededor no aportaría nada. */}
      <section className="border-y border-border bg-surface-muted/40">
        <Container className="divide-y divide-border">
          {PURPOSE.map((item) => (
            <Reveal key={item.label}>
              <div className="grid gap-6 py-14 md:grid-cols-12 md:gap-10">
                <p className="eyebrow md:col-span-3">{item.label}</p>
                <p className="font-display text-2xl font-normal leading-[1.4] tracking-[-0.015em] md:col-span-9 md:text-[2rem]">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </Container>
      </section>

      <Container as="section" className="py-24 sm:py-32">
        <Reveal className="max-w-xl">
          <span className="eyebrow inline-flex items-center gap-2.5 text-accent-ink">
            <span className="h-px w-10 bg-accent/60" aria-hidden="true" />
            Cómo trabajamos
          </span>
          <h2 className="mt-5 text-balance font-display text-4xl font-normal leading-[1.08] sm:text-5xl">
            Cuatro principios que no se negocian
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-px border-t border-border sm:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.n} delay={i * 0.06}>
              <div className="group h-full border-b border-border py-10 pr-8 sm:odd:border-r sm:odd:pr-12 sm:even:pl-12">
                <span className="font-display text-sm text-accent-ink">
                  {p.n}
                </span>
                <h3 className="mt-4 font-display text-2xl font-normal tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>

      <section className="relative isolate overflow-hidden bg-[#0a0c0b] py-24 text-[#f1efe9] sm:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(45%_60%_at_20%_20%,#0a4f37_0%,transparent_65%),radial-gradient(40%_50%_at_85%_80%,#b3893c_0%,transparent_60%)]"
        />
        <div
          className="bg-grain pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-overlay"
          aria-hidden="true"
        />

        <Container className="relative flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
          <Reveal>
            <h2 className="max-w-[18ch] text-balance font-display text-4xl font-normal leading-[1.08] text-[#f1efe9] sm:text-5xl">
              ¿Quieres conocer los programas en marcha?
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <Button asChild size="lg" variant="accent">
              <Link href="/proyectos">
                Ver proyectos
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
