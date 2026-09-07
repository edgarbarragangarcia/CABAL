"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { ArrowRight, ChevronDown, ImageOff, PlayCircle, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { AnimatedCounter } from "@/components/animations/animated-counter";
import { HeroAurora } from "@/components/sections/hero-aurora";
import { LiveRadioWidget } from "@/components/sections/live-radio-widget";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { cabalStats, cabalQuote, cabalBills } from "@/config/maria-fernanda-cabal";

function splitStat(value: string) {
  const m = value.match(/^(\D*)(\d+)(.*)$/);
  if (!m) return { prefix: "", number: null as number | null, suffix: value };
  return { prefix: m[1], number: Number(m[2]), suffix: m[3] };
}

/** Retrato a sangre con leve paralaje 3D siguiendo el cursor. */
function PortraitBleed() {
  const reduce = useReducedMotion();
  const [failed, setFailed] = React.useState(false);
  const rx = useSpring(useMotionValue(0), { stiffness: 90, damping: 16 });
  const ry = useSpring(useMotionValue(0), { stiffness: 90, damping: 16 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={reset}
      initial={{ opacity: 0, scale: 1.06 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      style={{ rotateX: rx, rotateY: ry }}
      className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/10 [transform-style:preserve-3d] lg:mx-0 lg:aspect-auto lg:h-full lg:max-w-none lg:rounded-none lg:border-0"
    >
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/[0.03] text-zinc-400">
          <div className="flex size-20 items-center justify-center rounded-full bg-white/5">
            <UserRound className="size-10" aria-hidden="true" strokeWidth={1.5} />
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium">
            <ImageOff className="size-3.5" aria-hidden="true" />
            Foto pendiente de autorización
          </span>
        </div>
      ) : (
        <Image
          src="/cabal-hero.jpg"
          alt="María Fernanda Cabal"
          fill
          priority
          sizes="(min-width: 1024px) 48vw, 100vw"
          className="object-cover object-top"
          onError={() => setFailed(true)}
        />
      )}

      {/* mezcla del retrato con el fondo aurora */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block lg:[background:linear-gradient(90deg,#07080a_0%,rgba(7,8,10,0.35)_28%,transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 lg:[background:linear-gradient(0deg,#07080a_2%,transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 lg:[background:linear-gradient(180deg,#07080a,transparent)]" />
    </motion.div>
  );
}

export function Hero() {
  const marquee = [...cabalBills, ...cabalBills];

  return (
    <section className="relative isolate flex min-h-screen flex-col overflow-hidden pt-32 text-white sm:pt-36">
      <HeroAurora />

      {/* Retrato a sangre en el borde derecho (desktop) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] lg:block xl:w-[46%]">
        <div className="pointer-events-auto h-full">
          <PortraitBleed />
        </div>

        {/* fichas flotantes sobre el retrato */}
        <Reveal
          delay={0.35}
          className="glass-panel animate-float-y pointer-events-auto absolute left-0 top-[28%] -translate-x-1/2 rounded-2xl px-4 py-3 shadow-2xl"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#22c58a]">
            Trayectoria
          </p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight">
            {cabalStats[0].value}
          </p>
          <p className="text-[10px] text-zinc-400">en el Congreso</p>
        </Reveal>

        <Reveal
          delay={0.5}
          className="glass-panel pointer-events-auto absolute bottom-[22%] left-4 rounded-2xl px-4 py-3 shadow-2xl"
        >
          <p className="text-2xl font-semibold tracking-tight">{cabalStats[2].value}</p>
          <p className="text-[10px] text-zinc-400">proyectos de ley 2024–25</p>
        </Reveal>
      </div>

      <Container className="relative flex flex-1 flex-col justify-center py-16">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="flex max-w-2xl flex-col items-center text-center lg:items-start lg:text-left"
        >
          <motion.h1
            variants={fadeUp}
            className="text-balance text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-7xl lg:text-8xl"
          >
            Construimos{" "}
            <span className="animate-shimmer bg-[linear-gradient(110deg,#22c58a_20%,#ffc94a_45%,#22c58a_70%)] bg-[length:200%_auto] bg-clip-text text-transparent">
              libertad
            </span>{" "}
            a través de la educación
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-md border-l-2 border-[#22c58a]/60 pl-4 text-left text-sm italic text-zinc-400 sm:text-base"
          >
            “{cabalQuote.text}”
            <span className="mt-1 block text-xs not-italic text-zinc-600">
              — María Fernanda Cabal ·{" "}
              <a
                href={cabalQuote.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline decoration-dotted underline-offset-2 hover:text-zinc-400"
              >
                {cabalQuote.sourceLabel}
              </a>
            </span>
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Button
              asChild
              size="lg"
              className="bg-[#22c58a] text-[#04140d] shadow-[0_0_40px_-8px_rgba(34,197,138,0.7)] hover:bg-[#2ee59c] hover:shadow-[0_0_55px_-6px_rgba(34,197,138,0.9)]"
            >
              <Link href="/donar">
                Donar / Apoyar
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border border-white/15 bg-white/5 text-white backdrop-blur-md hover:bg-white/10"
            >
              <Link href="/proyectos">
                <PlayCircle className="size-4" aria-hidden="true" />
                Conoce nuestro impacto
              </Link>
            </Button>
          </motion.div>

          {/* Retrato en el flujo para móvil / tablet */}
          <motion.div
            variants={fadeUp}
            className="mt-10 w-full max-w-sm lg:hidden"
          >
            <PortraitBleed />
          </motion.div>

          <motion.div
            variants={fadeUp}
            id="radio-en-vivo"
            className="mt-10 w-full max-w-md scroll-mt-32 [&_*]:!border-white/10"
          >
            <LiveRadioWidget />
          </motion.div>
        </motion.div>

        {/* Cifras grandes, integradas al pie del hero */}
        <Reveal className="mt-16 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 lg:max-w-3xl">
          {cabalStats.map((stat) => {
            const { prefix, number, suffix } = splitStat(stat.value);
            return (
              <div key={stat.label} className="bg-[#07080a]/60 p-4 backdrop-blur-sm sm:p-5">
                <p className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                  {number === null ? (
                    stat.value
                  ) : (
                    <>
                      {prefix}
                      <AnimatedCounter value={number} />
                      {suffix}
                    </>
                  )}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">{stat.label}</p>
              </div>
            );
          })}
        </Reveal>
      </Container>

      {/* Ticker de iniciativas al pie del hero */}
      <div className="relative mt-auto flex items-center gap-4 border-t border-white/10 bg-[#07080a]/70 py-3 backdrop-blur-sm">
        <span className="ml-6 hidden shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#22c58a] sm:flex">
          <ChevronDown className="size-3.5 animate-bounce" aria-hidden="true" />
          Iniciativas
        </span>
        <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <div className="animate-marquee flex shrink-0 items-center gap-8 pr-8">
            {marquee.map((bill, i) => (
              <span
                key={`${bill.title}-${i}`}
                className="flex items-center gap-2 whitespace-nowrap text-sm"
              >
                <span className="size-1 rounded-full bg-[#22c58a]" />
                <span className="font-medium text-zinc-300">{bill.title}</span>
                <span className="text-zinc-600">· {bill.topic}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
