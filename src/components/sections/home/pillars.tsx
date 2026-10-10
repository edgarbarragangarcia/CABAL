"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChartLineUp, GraduationCap, MapTrifold, type Icon } from "@phosphor-icons/react";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { Eyebrow } from "@/components/fx/eyebrow";
import { cn } from "@/lib/utils";

const PILLARS: { n: string; title: string; href: string; lead: string; body: string; icono: Icon }[] = [
  {
    n: "01",
    title: "Formación",
    href: "/cursos",
    lead: "Academia abierta",
    body: "Cursos y diplomados en libertad económica, instituciones y liderazgo público, con profesores que ejercen lo que enseñan.",
    icono: GraduationCap,
  },
  {
    n: "02",
    title: "Investigación",
    href: "/academia",
    lead: "Observatorios",
    body: "Seguimiento legislativo, análisis económico y publicaciones que sostienen el debate con datos verificables, no con consignas.",
    icono: ChartLineUp,
  },
  {
    n: "03",
    title: "Territorio",
    href: "/proyectos",
    lead: "Programas activos",
    body: "Escuelas rurales, empleabilidad juvenil y liderazgo local en las comunidades donde la oportunidad todavía no llega sola.",
    icono: MapTrifold,
  },
];

/** Círculos concéntricos muy finos: textura institucional para el panel activo, sin ilustrar nada. */
function Trazado({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 400" className={className}>
      {[60, 105, 150, 195].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeWidth="1" />
      ))}
      <circle cx="200" cy="200" r="4" fill="currentColor" />
    </svg>
  );
}

/**
 * Tres frentes en un solo bloque. En pantallas anchas es un tríptico: el panel bajo el cursor (o con el foco) se
 * expande y se vuelve verde bosque; los demás se recogen a un título. En el resto, tres columnas o una pila con todo
 * visible. Sin tarjetas sueltas ni sombras de colores: marfil, un filo dorado y el verde de la Fundación.
 */
export function Pillars() {
  const [activo, setActivo] = React.useState(0);

  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(50%_40%_at_10%_20%,rgba(10,79,55,0.06),transparent_70%),radial-gradient(40%_36%_at_92%_80%,rgba(179,137,60,0.08),transparent_70%)]" />
      <Container>
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>Qué hacemos</Eyebrow>
            <h2 className="mt-5 max-w-[16ch] text-balance font-display text-4xl font-light leading-[1.08] sm:text-5xl">
              Tres frentes, <span className="font-bold">una misma convicción</span>
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Formamos a quien decide, medimos a quien gobierna y acompañamos a quien empieza.</p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <div className="grid overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[0_44px_90px_-56px_rgba(10,30,22,0.55)] md:grid-cols-3 xl:flex xl:h-[30rem]">
            {PILLARS.map((p, i) => {
              const on = activo === i;
              return (
                <Link
                  key={p.n}
                  href={p.href}
                  onMouseEnter={() => setActivo(i)}
                  onFocus={() => setActivo(i)}
                  className={cn(
                    "group/panel relative flex min-w-0 flex-col justify-between gap-14 overflow-hidden p-8 outline-none transition-[flex-grow,background-color,color] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:basis-0 xl:p-10",
                    i > 0 && "border-t border-border md:border-l md:border-t-0",
                    on ? "xl:grow-[2.4] xl:bg-[#0a4f37] xl:text-[#f1efe9]" : "xl:grow",
                  )}
                >
                  <span aria-hidden className={cn("pointer-events-none absolute inset-x-10 top-0 hidden h-px bg-gradient-to-r from-transparent via-[#e0bd7c]/70 to-transparent transition-opacity duration-700 xl:block", on ? "opacity-100" : "opacity-0")} />
                  <Trazado className={cn("pointer-events-none absolute -bottom-28 -right-24 hidden size-[26rem] text-[#e0bd7c]/20 transition-opacity duration-700 xl:block", on ? "opacity-100" : "opacity-0")} />

                  <div className="relative flex items-start justify-between">
                    <span aria-hidden className={cn("font-display text-6xl leading-none transition-colors duration-700", on ? "text-accent/45 xl:text-[#e0bd7c]" : "text-accent/45")}>
                      {p.n}
                    </span>
                    <p.icono weight="duotone" aria-hidden="true" className={cn("size-9 transition-colors duration-700", on ? "text-brand xl:text-[#e0bd7c]" : "text-brand")} />
                  </div>

                  <div className="relative">
                    <p className={cn("eyebrow mb-3 transition-colors duration-700", on ? "!text-accent-ink xl:!text-[#e0bd7c]" : "!text-accent-ink")}>{p.lead}</p>
                    <h3 className="font-display text-3xl font-normal tracking-tight xl:text-[2rem]">{p.title}</h3>
                    {/* En el tríptico el cuerpo y el enlace se pliegan con la fila de la rejilla (0fr → 1fr): se anima el alto sin medirlo. */}
                    <div className={cn("grid transition-[grid-template-rows,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] xl:w-[24rem]", on ? "xl:grid-rows-[1fr] xl:opacity-100" : "xl:grid-rows-[0fr] xl:opacity-0")}>
                      <div className="overflow-hidden">
                        <p className={cn("pt-4 text-[0.95rem] leading-relaxed text-muted-foreground transition-colors duration-700", on && "xl:text-[#f1efe9]/75")}>{p.body}</p>
                        <span className={cn("mt-7 inline-flex items-center gap-3 text-sm font-semibold text-brand transition-colors duration-700", on && "xl:text-[#e0bd7c]")}>
                          Explorar
                          <span className={cn("grid size-9 place-items-center rounded-full border border-border bg-surface transition-all duration-300 group-hover/panel:border-brand group-hover/panel:bg-brand group-hover/panel:text-brand-foreground", on && "xl:border-[#e0bd7c]/40 xl:bg-transparent xl:group-hover/panel:border-[#e0bd7c] xl:group-hover/panel:bg-[#e0bd7c] xl:group-hover/panel:text-[#1c1405]")}>
                            <ArrowUpRight weight="bold" className="size-4" />
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
