"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ImageOff, PlayCircle, Sparkles, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { LiveRadioWidget } from "@/components/sections/live-radio-widget";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { cabalStats, cabalQuote } from "@/config/maria-fernanda-cabal";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-40 pb-24 sm:pt-48 sm:pb-32">
      {/* Fondo: malla de gradientes animada, sin cuadrícula */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          aria-hidden="true"
          className="absolute left-1/2 top-[-12rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "conic-gradient(from 90deg at 50% 50%, var(--brand), var(--accent), var(--brand))",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
      </div>

      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left"
          >
            <motion.h1
              variants={fadeUp}
              className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl"
            >
              Construimos{" "}
              <span className="animate-gradient-x bg-[linear-gradient(90deg,var(--brand),var(--accent),var(--brand))] bg-[length:200%_auto] bg-clip-text text-transparent">
                libertad a través de la educación
              </span>
            </motion.h1>

            <motion.blockquote
              variants={fadeUp}
              className="mt-6 max-w-xl border-l-2 border-brand pl-4 text-balance text-lg italic text-muted-foreground sm:text-xl lg:text-left"
            >
              “{cabalQuote.text}”
              <footer className="mt-2 text-sm not-italic text-muted-foreground/80">
                — María Fernanda Cabal ·{" "}
                <a
                  href={cabalQuote.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                >
                  {cabalQuote.sourceLabel}
                </a>
              </footer>
            </motion.blockquote>

            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
            >
              <Button asChild size="lg" variant="accent">
                <Link href="/donar">
                  Donar / Apoyar
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/proyectos">
                  <PlayCircle className="size-4" aria-hidden="true" />
                  Conoce nuestro impacto
                </Link>
              </Button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              id="radio-en-vivo"
              className="mt-12 w-full scroll-mt-32"
            >
              <LiveRadioWidget />
            </motion.div>
          </motion.div>

          {/* Panel de foto: placeholder a la espera de una imagen con derechos confirmados */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="relative mx-auto -mt-6 mb-10 w-full max-w-sm lg:-mt-10 lg:mb-12"
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-surface-muted to-border/40 shadow-xl">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="flex size-20 items-center justify-center rounded-full bg-surface/80 shadow-sm">
                  <UserRound className="size-10" aria-hidden="true" strokeWidth={1.5} />
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-surface/80 px-3 py-1 text-[11px] font-medium shadow-sm">
                  <ImageOff className="size-3.5" aria-hidden="true" />
                  Foto pendiente de autorización
                </span>
              </div>
            </div>

            {/* Tarjeta superpuesta, estilo "hito" */}
            <Reveal
              delay={0.2}
              className="absolute inset-x-4 -bottom-8 rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:-bottom-10 sm:p-6"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Trayectoria legislativa
              </span>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {cabalStats[0].value}
              </p>
              <p className="text-xs text-muted-foreground">{cabalStats[0].label}</p>
            </Reveal>
          </motion.div>
        </div>

        <Reveal className="mx-auto mt-16 max-w-2xl border-t border-border pt-10 text-center">
          <dl className="grid grid-cols-3 gap-6">
            {cabalStats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {stat.value}
                </dd>
                <span className="text-xs text-muted-foreground sm:text-sm">{stat.label}</span>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs text-muted-foreground">
            Fuente:{" "}
            <a
              href={cabalStats[0].sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              {cabalStats[0].sourceLabel}
            </a>{" "}
            y{" "}
            <a
              href={cabalStats[2].sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              {cabalStats[2].sourceLabel}
            </a>
            .
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
