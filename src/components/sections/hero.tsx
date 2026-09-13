"use client";

import * as React from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  PlayCircle,
  UserRound,
  VideoOff,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { AnimatedCounter } from "@/components/animations/animated-counter";
import { HeroAurora } from "@/components/sections/hero-aurora";
import { TrajectoryDialog } from "@/components/sections/trajectory-dialog";
import { LiveRadioWidget } from "@/components/sections/live-radio-widget";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { cabalStats, cabalQuote, cabalBills } from "@/config/maria-fernanda-cabal";

function splitStat(value: string) {
  const m = value.match(/^(\D*)(\d+)(.*)$/);
  if (!m) return { prefix: "", number: null as number | null, suffix: value };
  return { prefix: m[1], number: Number(m[2]), suffix: m[3] };
}

/** Retrato/video a sangre con leve paralaje 3D siguiendo el cursor. */
function PortraitBleed() {
  const reduce = useReducedMotion();
  const [failed, setFailed] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
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

  // Respeta prefers-reduced-motion: no autorreproduce, queda en el póster.
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    if (reduce) v.pause();
    else v.play().catch(() => {});
  }, [reduce]);

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
            <VideoOff className="size-3.5" aria-hidden="true" />
            Contenido pendiente de autorización
          </span>
        </div>
      ) : (
        <video
          ref={videoRef}
          poster="/cabal-hero-poster.jpg"
          autoPlay={!reduce}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="María Fernanda Cabal, video generado con inteligencia artificial"
          className="absolute inset-0 size-full object-cover object-top"
          onError={() => setFailed(true)}
        >
          <source src="/cabal-hero.mp4" type="video/mp4" />
        </video>
      )}

      {/* grano sutil: disimula el reescalado de la imagen base */}
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay" />

      {/* mezcla del retrato con el fondo aurora */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block lg:[background:linear-gradient(90deg,#07080a_0%,#07080a_14%,rgba(7,8,10,0.8)_32%,rgba(7,8,10,0.4)_55%,transparent_82%)]" />
      <div className="pointer-events-none absolute inset-0 lg:[background:linear-gradient(0deg,#07080a_2%,transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 lg:[background:linear-gradient(180deg,#07080a,transparent)]" />

      {/* divulgación: contenido generado con IA, siempre visible */}
      {!failed && (
        <span className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-medium text-zinc-200 backdrop-blur-md lg:right-6 lg:top-28">
          <Wand2 className="size-3" aria-hidden="true" />
          Video generado con IA
        </span>
      )}
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
        <PortraitBleed />
      </div>

      {/* Difumina la costura entre el fondo aurora y el retrato: desenfoca
          lo que hay detrás en una franja angosta centrada en el borde,
          con máscara suave para no crear a su vez un borde nuevo. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[52%] hidden w-72 -translate-x-1/2 backdrop-blur-[64px] lg:block"
        style={{
          maskImage: "linear-gradient(90deg, transparent, black, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black, transparent)",
        }}
      />

      {/* Fichas flotantes: capa propia por encima del contenido, para que el
          clic siempre llegue aunque el titular se solape */}
      <div className="pointer-events-none absolute inset-0 z-30 hidden lg:block">
        <Reveal
          delay={0.35}
          className="pointer-events-auto absolute left-[52%] top-[34%] -translate-x-1/2"
        >
          <TrajectoryDialog
            trigger={
              <button
                type="button"
                className="glass-panel animate-float-y group block rounded-2xl px-4 py-3 text-left shadow-2xl transition-transform duration-200 hover:scale-[1.03]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#22c58a]">
                  Trayectoria
                </p>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight text-white">
                  {cabalStats[0].value}
                </p>
                <p className="text-[10px] text-zinc-400">
                  en el Congreso ·{" "}
                  <span className="underline decoration-dotted underline-offset-2 group-hover:text-white">
                    ver detalle
                  </span>
                </p>
              </button>
            }
          />
        </Reveal>

        <Reveal
          delay={0.5}
          className="pointer-events-auto absolute bottom-[24%] left-[calc(52%+1rem)] -translate-x-1/2"
        >
          <TrajectoryDialog
            trigger={
              <button
                type="button"
                className="glass-panel group block rounded-2xl px-4 py-3 text-left shadow-2xl transition-transform duration-200 hover:scale-[1.03]"
              >
                <p className="text-2xl font-semibold tracking-tight text-white">
                  {cabalStats[2].value}
                </p>
                <p className="text-[10px] text-zinc-400">
                  proyectos de ley 2024–25 ·{" "}
                  <span className="underline decoration-dotted underline-offset-2 group-hover:text-white">
                    ver
                  </span>
                </p>
              </button>
            }
          />
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
            className="pointer-events-none text-balance text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-7xl lg:text-8xl"
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

        {/* Cifras grandes, integradas al pie del hero — abren el detalle */}
        <Reveal className="mt-16 lg:max-w-3xl">
          <TrajectoryDialog
            trigger={
              <button
                type="button"
                className="group block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition-colors hover:border-white/25"
              >
                <div className="grid grid-cols-3 gap-px">
                  {cabalStats.map((stat) => {
                    const { prefix, number, suffix } = splitStat(stat.value);
                    return (
                      <div
                        key={stat.label}
                        className="bg-[#07080a]/60 p-4 backdrop-blur-sm sm:p-5"
                      >
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
                        <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                          {stat.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <span className="flex items-center justify-center gap-1.5 border-t border-white/10 bg-white/[0.02] py-2 text-[11px] font-medium text-zinc-400 group-hover:text-white">
                  Ver iniciativas y fuentes
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </button>
            }
          />
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
