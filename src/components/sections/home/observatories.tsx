"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, FileText, Gavel, LineChart, Newspaper } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    href: "/academia/observatorio-legislativo",
    icon: Gavel,
    title: "Observatorio Legislativo",
    body: "Trazabilidad de cada proyecto de ley relevante: ponencias, votaciones nominales y quién sostuvo qué.",
    tag: "Actualizado semanalmente",
    featured: true,
  },
  {
    href: "/academia/observatorio-economico",
    icon: LineChart,
    title: "Observatorio Económico",
    body: "Series oficiales sobre gasto, empleo e inflación, leídas sin retórica.",
    tag: "Datos DANE y Socrata",
    featured: false,
  },
  {
    href: "/academia/publicaciones",
    icon: FileText,
    title: "Publicaciones",
    body: "Investigación propia y documentos de posición.",
    tag: "Archivo completo",
    featured: false,
  },
  {
    href: "/academia/boletines",
    icon: Newspaper,
    title: "Boletines",
    body: "El resumen de la semana, en cinco minutos.",
    tag: "Suscripción abierta",
    featured: false,
  },
];

/**
 * Rejilla asimétrica: la pieza destacada ocupa media sección y las otras
 * tres se apilan al lado. La jerarquía la da el tamaño, no un badge de
 * "destacado" pegado encima.
 */
export function Observatories() {
  return (
    <section className="relative py-24 sm:py-32">
      <Container>
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow inline-flex items-center gap-2.5 text-accent-ink">
              <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
              Observatorios
            </span>
            <h2 className="mt-5 max-w-[18ch] text-balance font-display text-4xl font-normal leading-[1.08] sm:text-5xl">
              El debate público merece evidencia
            </h2>
          </div>
          <Link
            href="/academia"
            className="group inline-flex shrink-0 items-center gap-2 text-sm font-medium text-foreground"
          >
            Ver todos
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {/* Destacado */}
          {ITEMS.filter((i) => i.featured).map((item) => (
            <Reveal key={item.href}>
              <Link
                href={item.href}
                className="card-premium sheen group relative flex h-full min-h-[22rem] flex-col justify-between overflow-hidden p-8 sm:p-10"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand/15 opacity-60 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
                />
                <span className="relative flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <div className="relative mt-10">
                  <p className="eyebrow mb-3 text-accent-ink">{item.tag}</p>
                  <h3 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">
                    {item.title}
                  </h3>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                  <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-brand">
                    Explorar
                    <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}

          {/* Secundarios apilados */}
          <div className="grid gap-5">
            {ITEMS.filter((i) => !i.featured).map((item, i) => (
              <Reveal key={item.href} delay={0.08 * (i + 1)}>
                <Link
                  href={item.href}
                  className={cn(
                    "card-premium group flex items-start gap-5 p-6 sm:p-7"
                  )}
                >
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground transition-colors duration-300 group-hover:bg-brand-soft group-hover:text-brand">
                    <item.icon className="size-[1.1rem]" aria-hidden="true" />
                  </span>
                  <div className="relative min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-xl font-normal tracking-tight">
                        {item.title}
                      </h3>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                    <p className="eyebrow mt-3 text-[0.625rem]">{item.tag}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
