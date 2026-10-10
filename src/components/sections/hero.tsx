"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Bank, CalendarStar, ChartLineUp, GraduationCap, Medal, Quotes, Scales, Storefront, UsersThree, type Icon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { AnimatedCounter } from "@/components/animations/animated-counter";
import { HeroBackdrop } from "@/components/sections/hero-backdrop";
import { TrajectoryDialog } from "@/components/sections/trajectory-dialog";
import { LiveRadioWidget } from "@/components/sections/live-radio-widget";
import { IconChip, type TonoChip } from "@/components/fx/icon-chip";
import { useParalaje } from "@/components/fx/paralaje";
import { TiltCard } from "@/components/fx/tilt-card";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { cabalStats, cabalQuote, cabalBills } from "@/config/maria-fernanda-cabal";

function splitStat(value: string) {
  const m = value.match(/^(\D*)(\d+)(.*)$/);
  if (!m) return { prefix: "", number: null as number | null, suffix: value };
  return { prefix: m[1], number: Number(m[2]), suffix: m[3] };
}

/** Ícono y tono de cada cifra de la trayectoria (mismo orden que `cabalStats`). */
const LOGROS: { icono: Icon; tono: TonoChip }[] = [
  { icono: Bank, tono: "bosque" },
  { icono: Medal, tono: "oro" },
  { icono: Scales, tono: "turquesa" },
];

const ATAJOS: { href: string; texto: string; icono: Icon; tono: TonoChip }[] = [
  { href: "/cursos", texto: "Cursos", icono: GraduationCap, tono: "esmeralda" },
  { href: "/academia", texto: "Observatorios", icono: ChartLineUp, tono: "turquesa" },
  { href: "/eventos", texto: "Eventos", icono: CalendarStar, tono: "oro" },
  { href: "/tienda", texto: "Tienda", icono: Storefront, tono: "bosque" },
];

/** Una cifra de la trayectoria como tarjeta de cristal con volumen; al pulsarla se abre la ficha con fuentes. */
function TarjetaLogro({ i, className }: { i: number; className?: string }) {
  const stat = cabalStats[i];
  const { icono, tono } = LOGROS[i];
  const { prefix, number, suffix } = splitStat(stat.value);
  return (
    <TiltCard
      className={className}
      intensidad={5}
      luz="rgba(255,255,255,0.7)"
      plate="rounded-[1.5rem] border border-white/80 bg-white/78 shadow-[0_34px_70px_-34px_rgba(10,30,22,0.5),0_6px_18px_-8px_rgba(10,30,22,0.12)] backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.06] dark:shadow-[0_34px_70px_-34px_rgba(0,0,0,0.85)]"
    >
      <span aria-hidden className="absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
      <div className="relative flex items-start gap-4 p-5">
        <IconChip icono={icono} tono={tono} className="size-12 [transform:translateZ(40px)]" iconClass="size-6" />
        <div className="min-w-0 [transform:translateZ(22px)]">
          <p className="tabular flex items-baseline gap-1.5 whitespace-nowrap font-display text-[2.3rem] leading-none tracking-tight">
            {number === null ? stat.value : (<><span>{prefix}<AnimatedCounter value={number} /></span>{suffix.trim() && <span className="font-sans text-sm font-medium tracking-normal text-foreground/60">{suffix.trim()}</span>}</>)}
          </p>
          <p className="mt-2 text-[0.8rem] leading-snug text-foreground/70">{stat.label}</p>
        </div>
      </div>
      <p className="relative flex items-center gap-1 px-5 pb-4 text-[0.62rem] font-semibold tracking-[0.16em] text-accent-ink uppercase">
        Ver fuente <ArrowUpRight weight="bold" className="size-3" />
      </p>
      <TrajectoryDialog trigger={<button type="button" aria-label={`${stat.value}: ${stat.label}. Ver la trayectoria completa y sus fuentes`} className="absolute inset-0 z-20 cursor-pointer rounded-[inherit]" />} />
    </TiltCard>
  );
}

/** Tarjeta que flota y se mueve distinto según su profundidad cuando el puntero recorre la página. */
function Flotante({ i, profundidad, posicion, retraso }: { i: number; profundidad: number; posicion: string; retraso: number }) {
  const p = useParalaje(profundidad);
  return (
    <motion.div style={{ x: p.x, y: p.y }} className={`pointer-events-auto absolute w-[16.5rem] ${posicion}`}>
      <div className="motion-safe:animate-float-y [animation-duration:10s]" style={{ animationDelay: `${retraso}s` }}>
        <TarjetaLogro i={i} />
      </div>
    </motion.div>
  );
}

export function Hero() {
  const marquee = [...cabalBills, ...cabalBills];

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden text-foreground">
      <HeroBackdrop />
      {/* Luces de color y esferas: dan escenario y profundidad detrás del texto y del retrato */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(50%_40%_at_10%_20%,rgba(10,79,55,0.07),transparent_70%),radial-gradient(40%_36%_at_90%_90%,rgba(179,137,60,0.1),transparent_70%)]" />

      <Container className="relative flex flex-1 flex-col justify-center pb-16 pt-[46svh] lg:pt-44">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="max-w-3xl">
          <motion.span variants={fadeUp} className="eyebrow inline-flex items-center gap-2.5 !text-accent-ink">
            <span className="h-px w-10 bg-accent/60" aria-hidden="true" />
            Fundación Escuela Libertad
          </motion.span>

          {/* `clamp` en vez de saltos por breakpoint: el titular escala de forma continua y nunca se queda ni enano ni desbordado. */}
          <motion.h1 variants={fadeUp} className="mt-7 max-w-[13ch] text-balance font-display text-[clamp(2.75rem,7.5vw,6.5rem)] font-normal leading-[0.98] tracking-[-0.03em]">
            Construimos{" "}
            <span className="relative inline-block italic">
              <span className="bg-gradient-to-r from-[#6b4a12] via-[#b3893c] to-[#8a6314] bg-clip-text pr-1 text-transparent dark:from-[#e0bd7c] dark:via-[#f6e2b0] dark:to-[#e0bd7c]">libertad</span>
              <svg aria-hidden="true" viewBox="0 0 220 24" preserveAspectRatio="none" className="absolute -bottom-[0.08em] left-0 h-[0.1em] w-full text-accent/80">
                <motion.path d="M2 14 L 218 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 1, ease: [0.16, 1, 0.3, 1] }} />
              </svg>
            </span>{" "}
            a través de la educación
          </motion.h1>

          <motion.div variants={fadeUp} className="mt-9 max-w-lg">
            <TiltCard
              intensidad={4}
              plate="rounded-3xl border border-white/80 bg-white/70 shadow-[0_28px_60px_-32px_rgba(10,30,22,0.45)] backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.06]"
            >
              <figure className="relative p-6 pl-7">
                <Quotes weight="fill" aria-hidden="true" className="absolute -top-3 left-6 size-7 text-accent [transform:translateZ(30px)]" />
                <blockquote className="font-display text-lg italic leading-relaxed text-foreground/85 sm:text-xl">“{cabalQuote.text}”</blockquote>
                <figcaption className="mt-3 text-xs text-muted-foreground">
                  — María Fernanda Cabal ·{" "}
                  <a href={cabalQuote.sourceUrl} target="_blank" rel="noreferrer noopener" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                    {cabalQuote.sourceLabel}
                  </a>
                </figcaption>
              </figure>
            </TiltCard>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="bg-gradient-to-b from-[#0f6b4c] to-[#0a4f37] pl-7 pr-2 shadow-[0_20px_40px_-18px_rgba(10,79,55,0.9)] ring-1 ring-accent/40">
              <Link href="/unete">
                <UsersThree weight="duotone" className="!size-5" aria-hidden="true" />
                Únete a la comunidad
                <span className="ml-2 grid size-9 place-items-center rounded-full bg-white/15 ring-1 ring-white/20"><ArrowRight weight="bold" className="!size-4" /></span>
              </Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <Link href="/donar">Donar / Apoyar</Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <Link href="/proyectos">Conoce nuestro impacto</Link>
            </Button>
          </motion.div>

          {/* En pantallas medianas las cifras van en una fila deslizable; en grandes flotan sobre el retrato */}
          <motion.div variants={fadeUp} className="-mx-6 mt-10 flex snap-x gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] xl:hidden">
            {cabalStats.map((s, i) => (
              <div key={s.label} className="w-[16.5rem] shrink-0 snap-start"><TarjetaLogro i={i} /></div>
            ))}
          </motion.div>
        </motion.div>
      </Container>

      {/* Tarjetas 3D flotantes sobre el retrato (solo pantallas grandes) */}
      <div className="pointer-events-none absolute inset-0 hidden xl:block">
        <Flotante i={0} profundidad={-34} posicion="right-[3%] top-[19%]" retraso={0} />
        <Flotante i={1} profundidad={-60} posicion="right-[23%] top-[61%]" retraso={1.4} />
        <Flotante i={2} profundidad={-26} posicion="right-[3%] top-[44%]" retraso={2.6} />
      </div>

      {/* Dock: radio en vivo y atajos con íconos con volumen */}
      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative">
        <Container className="pb-6">
          <div className="glass-panel grid overflow-hidden rounded-[1.75rem] lg:grid-cols-[1fr_auto]">
            <nav aria-label="Atajos" className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              {ATAJOS.map((a) => (
                <Link key={a.href} href={a.href} className="group flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-foreground/[0.05]">
                  <IconChip icono={a.icono} tono={a.tono} className="size-11 rounded-2xl transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[-6deg]" iconClass="size-6" />
                  <span className="text-sm font-semibold leading-tight">{a.texto}</span>
                </Link>
              ))}
            </nav>
            <div className="border-t border-border/60 lg:border-l lg:border-t-0">
              <LiveRadioWidget className="rounded-none bg-transparent text-foreground shadow-none" />
            </div>
          </div>
        </Container>
      </motion.div>

      {/* Ticker de iniciativas */}
      <div className="relative flex items-center gap-4 border-t border-border bg-background/60 py-3 backdrop-blur-md">
        <span className="eyebrow ml-6 hidden shrink-0 items-center gap-2 text-brand sm:flex">Iniciativas</span>
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <div className="animate-marquee flex shrink-0 items-center gap-8 pr-8">
            {marquee.map((bill, i) => (
              <span key={`${bill.title}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-sm">
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
