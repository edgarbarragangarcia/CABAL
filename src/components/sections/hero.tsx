"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { AnimatedCounter } from "@/components/animations/animated-counter";
import { HeroBackdrop } from "@/components/sections/hero-backdrop";
import { TrajectoryDialog } from "@/components/sections/trajectory-dialog";
import { LiveRadioWidget } from "@/components/sections/live-radio-widget";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { cabalStats, cabalQuote, cabalBills } from "@/config/maria-fernanda-cabal";

function splitStat(value: string) {
  const m = value.match(/^(\D*)(\d+)(.*)$/);
  if (!m) return { prefix: "", number: null as number | null, suffix: value };
  return { prefix: m[1], number: Number(m[2]), suffix: m[3] };
}

export function Hero() {
  const marquee = [...cabalBills, ...cabalBills];

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden text-foreground">
      <HeroBackdrop />

      <Container className="relative flex flex-1 flex-col justify-center pb-16 pt-[46svh] lg:pt-44">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-3xl"
        >
          <motion.span
            variants={fadeUp}
            className="eyebrow inline-flex items-center gap-2.5 text-accent-ink"
          >
            <span className="h-px w-10 bg-accent/60" aria-hidden="true" />
            Fundación Escuela Libertad
          </motion.span>

          {/* `clamp` en vez de saltos por breakpoint: el titular escala de
              forma continua y nunca se queda ni enano ni desbordado. */}
          <motion.h1
            variants={fadeUp}
            className="mt-7 max-w-[13ch] text-balance font-display text-[clamp(2.75rem,7.5vw,6.5rem)] font-normal leading-[0.98] tracking-[-0.03em]"
          >
            Construimos{" "}
            <span className="italic text-accent-ink">libertad</span> a través de la
            educación
          </motion.h1>

          <motion.figure variants={fadeUp} className="mt-9 max-w-lg">
            <blockquote className="border-l border-accent/70 pl-5 font-display text-lg italic leading-relaxed text-foreground/80 sm:text-xl">
              “{cabalQuote.text}”
            </blockquote>
            <figcaption className="mt-2.5 pl-5 text-xs text-muted-foreground">
              — María Fernanda Cabal ·{" "}
              <a
                href={cabalQuote.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                {cabalQuote.sourceLabel}
              </a>
            </figcaption>
          </motion.figure>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="shadow-elev-2">
              <Link href="/donar">
                Donar / Apoyar
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <Link href="/proyectos">
                <PlayCircle className="size-4" aria-hidden="true" />
                Conoce nuestro impacto
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </Container>

      {/* Barra de pie: cifras y radio en una sola línea de cristal. Reúne
          en un solo plano lo que antes flotaba suelto sobre la imagen. */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <Container className="pb-6">
          <div className="glass-panel grid overflow-hidden rounded-2xl lg:grid-cols-[1fr_auto]">
            <TrajectoryDialog
              trigger={
                <button
                  type="button"
                  className="group grid grid-cols-3 gap-px bg-border/60 text-left"
                >
                  {cabalStats.map((stat) => {
                    const { prefix, number, suffix } = splitStat(stat.value);
                    return (
                      <span
                        key={stat.label}
                        className="block bg-surface/40 px-5 py-5 transition-colors duration-500 group-hover:bg-surface/10 sm:px-7"
                      >
                        <span className="tabular block font-display text-2xl leading-none tracking-tight sm:text-3xl">
                          {number === null ? (
                            stat.value
                          ) : (
                            <>
                              {prefix}
                              <AnimatedCounter value={number} />
                              {suffix}
                            </>
                          )}
                        </span>
                        <span className="eyebrow mt-2.5 block text-[0.625rem] leading-snug">
                          {stat.label}
                        </span>
                      </span>
                    );
                  })}
                </button>
              }
            />

            {/* Dentro de la barra de cristal el widget no debe traer su
                propio fondo invertido: ahí leería como un recuadro negro
                pegado encima en vez de una celda más de la barra. */}
            <div className="border-t border-border/60 lg:border-l lg:border-t-0">
              <LiveRadioWidget className="rounded-none bg-transparent text-foreground shadow-none" />
            </div>
          </div>
        </Container>
      </motion.div>

      {/* Ticker de iniciativas */}
      <div className="relative flex items-center gap-4 border-t border-border bg-background/60 py-3 backdrop-blur-md">
        <span className="eyebrow ml-6 hidden shrink-0 items-center gap-2 text-brand sm:flex">
          <ArrowDown className="size-3.5 animate-bounce" aria-hidden="true" />
          Iniciativas
        </span>
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <div className="animate-marquee flex shrink-0 items-center gap-8 pr-8">
            {marquee.map((bill, i) => (
              <span
                key={`${bill.title}-${i}`}
                className="flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <span className="size-1 rounded-full bg-accent" />
                <span className="font-medium text-foreground/80">{bill.title}</span>
                <span className="text-muted-foreground">· {bill.topic}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
