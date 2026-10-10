"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChartLineUp, FileText, Gavel, Newspaper, type Icon } from "@phosphor-icons/react";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { Eyebrow } from "@/components/fx/eyebrow";
import { IconChip } from "@/components/fx/icon-chip";
import { TiltCard } from "@/components/fx/tilt-card";

const ITEMS: { href: string; icono: Icon; title: string; body: string; tag: string; featured: boolean }[] = [
  {
    href: "/academia/observatorio-legislativo",
    icono: Gavel,
    title: "Observatorio Legislativo",
    body: "Trazabilidad de cada proyecto de ley relevante: ponencias, votaciones nominales y quién sostuvo qué.",
    tag: "Actualizado semanalmente",
    featured: true,
  },
  {
    href: "/academia/observatorio-economico",
    icono: ChartLineUp,
    title: "Observatorio Económico",
    body: "Series oficiales sobre gasto, empleo e inflación, leídas sin retórica.",
    tag: "Datos DANE y Socrata",
    featured: false,
  },
  {
    href: "/academia/publicaciones",
    icono: FileText,
    title: "Publicaciones",
    body: "Investigación propia y documentos de posición.",
    tag: "Archivo completo",
    featured: false,
  },
  {
    href: "/academia/boletines",
    icono: Newspaper,
    title: "Boletines",
    body: "El resumen de la semana, en cinco minutos.",
    tag: "Suscripción abierta",
    featured: false,
  },
];

/** Trazado fino de círculos concéntricos y meridianos: da textura institucional a la pieza destacada sin ilustrar nada. */
function Trazado() {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 400" className="pointer-events-none absolute -bottom-24 -right-24 size-[26rem] text-[#e0bd7c]/25">
      {[60, 105, 150, 195].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeWidth="1" />
      ))}
      {[0, 30, 60, 90, 120, 150].map((a) => (
        <line key={a} x1="200" y1="0" x2="200" y2="400" stroke="currentColor" strokeWidth="0.8" transform={`rotate(${a} 200 200)`} />
      ))}
      <circle cx="200" cy="200" r="4" fill="currentColor" />
    </svg>
  );
}

/** Rejilla asimétrica: la pieza destacada va en verde bosque y ocupa media sección; las otras tres, en marfil, se apilan al lado. */
export function Observatories() {
  const [destacado, ...otros] = ITEMS;
  return (
    <section className="relative py-24 sm:py-32">
      <Container>
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Observatorios</Eyebrow>
            <h2 className="mt-5 max-w-[18ch] text-balance font-display text-4xl font-normal leading-[1.08] sm:text-5xl">El debate público merece evidencia</h2>
          </div>
          <Link href="/academia" className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground">
            Ver todos
            <ArrowUpRight weight="bold" className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <TiltCard
              href={destacado.href}
              label={destacado.title}
              intensidad={4}
              luz="rgba(224,189,124,0.5)"
              plate="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#0f6b4c] via-[#0a4f37] to-[#06281c] shadow-[0_44px_80px_-36px_rgba(6,40,28,0.9)]"
              className="flex h-full min-h-[24rem] flex-col justify-between rounded-[1.75rem] p-8 text-[#f1efe9] sm:p-10"
            >
              <span aria-hidden className="absolute inset-0 overflow-hidden rounded-[inherit]"><Trazado /></span>
              <span aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#e0bd7c]/70 to-transparent" />
              <IconChip icono={destacado.icono} tono="oro" className="size-14 border-[#e0bd7c]/30 from-white/12 to-white/[0.03] text-[#e0bd7c] shadow-none [transform:translateZ(44px)]" iconClass="size-7" />
              <div className="relative [transform:translateZ(26px)]">
                <p className="eyebrow mb-3 !text-[#e0bd7c]">{destacado.tag}</p>
                <h3 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">{destacado.title}</h3>
                <p className="mt-4 max-w-md text-base leading-relaxed text-[#f1efe9]/75">{destacado.body}</p>
                <span className="mt-7 inline-flex items-center gap-2.5 text-sm font-semibold text-[#e0bd7c]">
                  Explorar
                  <span className="grid size-9 place-items-center rounded-full border border-[#e0bd7c]/40 transition-all duration-300 group-hover/tilt:bg-[#e0bd7c] group-hover/tilt:text-[#1c1405]"><ArrowUpRight weight="bold" className="size-4" /></span>
                </span>
              </div>
            </TiltCard>
          </Reveal>

          <div className="grid gap-5">
            {otros.map((item, i) => (
              <Reveal key={item.href} delay={0.08 * (i + 1)}>
                <TiltCard
                  href={item.href}
                  label={item.title}
                  intensidad={4}
                  plate="rounded-[1.5rem] border border-border bg-gradient-to-b from-white to-stone-50/90 shadow-[0_26px_50px_-34px_rgba(10,30,22,0.4)] dark:from-white/[0.07] dark:to-white/[0.02]"
                  className="flex items-start gap-5 rounded-[1.5rem] p-6 sm:p-7"
                >
                  <IconChip icono={item.icono} tono="esmeralda" className="size-12 [transform:translateZ(34px)]" iconClass="size-6" />
                  <div className="relative min-w-0 flex-1 [transform:translateZ(18px)]">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-xl font-normal tracking-tight">{item.title}</h3>
                      <ArrowUpRight weight="bold" className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover/tilt:-translate-y-0.5 group-hover/tilt:translate-x-0.5 group-hover/tilt:text-brand" />
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    <p className="eyebrow mt-3 text-[0.625rem]">{item.tag}</p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
