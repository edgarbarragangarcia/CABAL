"use client";

import * as React from "react";
import { ArrowUpRight, ChartLineUp, GraduationCap, MapTrifold, type Icon } from "@phosphor-icons/react";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { Eyebrow } from "@/components/fx/eyebrow";
import { IconChip, type TonoChip } from "@/components/fx/icon-chip";
import { TiltCard } from "@/components/fx/tilt-card";

const PILLARS: { n: string; title: string; href: string; lead: string; body: string; icono: Icon; tono: TonoChip }[] = [
  {
    n: "01",
    title: "Formación",
    href: "/cursos",
    lead: "Academia abierta",
    body: "Cursos y diplomados en libertad económica, instituciones y liderazgo público, con profesores que ejercen lo que enseñan.",
    icono: GraduationCap,
    tono: "esmeralda",
  },
  {
    n: "02",
    title: "Investigación",
    href: "/academia",
    lead: "Observatorios",
    body: "Seguimiento legislativo, análisis económico y publicaciones que sostienen el debate con datos verificables, no con consignas.",
    icono: ChartLineUp,
    tono: "bosque",
  },
  {
    n: "03",
    title: "Territorio",
    href: "/proyectos",
    lead: "Programas activos",
    body: "Escuelas rurales, empleabilidad juvenil y liderazgo local en las comunidades donde la oportunidad todavía no llega sola.",
    icono: MapTrifold,
    tono: "oro",
  },
];

/**
 * Tres frentes como tarjetas con profundidad contenida: se inclinan unos pocos grados hacia el cursor y el ícono y el
 * título se despegan apenas de la placa. Nada de color estridente: marfil, filo dorado y verde bosque.
 */
export function Pillars() {
  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(50%_40%_at_10%_20%,rgba(10,79,55,0.06),transparent_70%),radial-gradient(40%_36%_at_92%_80%,rgba(179,137,60,0.08),transparent_70%)]" />
      <Container>
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Qué hacemos</Eyebrow>
            <h2 className="mt-5 max-w-[16ch] text-balance font-display text-4xl font-normal leading-[1.08] sm:text-5xl">Tres frentes, una misma convicción</h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Formamos a quien decide, medimos a quien gobierna y acompañamos a quien empieza.</p>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.n} delay={i * 0.1}>
              <TiltCard
                href={p.href}
                label={`${p.title}: ${p.lead}`}
                intensidad={5}
                luz="rgba(255,255,255,0.65)"
                plate="rounded-[1.75rem] border border-border bg-gradient-to-b from-white to-stone-50/90 shadow-[0_34px_64px_-38px_rgba(10,30,22,0.45),0_2px_6px_-2px_rgba(10,30,22,0.08)] transition-shadow duration-500 group-hover/tilt:shadow-[0_44px_80px_-36px_rgba(10,30,22,0.55)] dark:from-white/[0.07] dark:to-white/[0.02] dark:shadow-[0_34px_64px_-38px_rgba(0,0,0,0.9)]"
                className="flex min-h-[24rem] flex-col rounded-[1.75rem] p-8"
              >
                <span aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
                <div className="flex items-start justify-between">
                  <IconChip icono={p.icono} tono={p.tono} className="size-16 rounded-[1.25rem] [transform:translateZ(46px)]" iconClass="size-8" />
                  <span aria-hidden className="font-display text-6xl leading-none text-accent/35 [transform:translateZ(14px)]">{p.n}</span>
                </div>
                <div className="mt-auto pt-14 [transform:translateZ(26px)]">
                  <p className="eyebrow mb-2 !text-accent-ink">{p.lead}</p>
                  <h3 className="font-display text-4xl font-normal tracking-tight">{p.title}</h3>
                  <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
                <span className="mt-7 inline-flex items-center gap-3 text-sm font-semibold text-brand [transform:translateZ(18px)]">
                  Explorar
                  <span className="grid size-9 place-items-center rounded-full border border-border bg-surface transition-all duration-300 group-hover/tilt:border-brand group-hover/tilt:bg-brand group-hover/tilt:text-brand-foreground">
                    <ArrowUpRight weight="bold" className="size-4" />
                  </span>
                </span>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
