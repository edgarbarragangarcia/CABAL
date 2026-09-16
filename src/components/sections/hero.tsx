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
  Volume2,
  VolumeX,
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
  const [muted, setMuted] = React.useState(true);
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
  // El video empieza siempre muteado (los navegadores bloquean el
  // autoplay con sonido); el botón de audio lo activa a petición.
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduce) v.pause();
    else v.play().catch(() => {});
  }, [reduce]);

  function toggleSound() {
    setMuted((prev) => {
      const next = !prev;
      const v = videoRef.current;
      if (v) {
        v.muted = next;
        if (!next) v.play().catch(() => {});
      }
      return next;
    });
  }

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={reset}
      initial={{ opacity: 0, scale: 1.06 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      style={{ rotateX: rx, rotateY: ry }}
      className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-border [transform-style:preserve-3d] lg:mx-0 lg:aspect-auto lg:h-full lg:max-w-none lg:rounded-none lg:border-0"
    >
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-foreground/[0.03] text-muted-foreground">
          <div className="flex size-20 items-center justify-center rounded-full bg-foreground/5">
            <UserRound className="size-10" aria-hidden="true" strokeWidth={1.5} />
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-medium">
            <VideoOff className="size-3.5" aria-hidden="true" />
            Contenido pendiente de autorización
          </span>
        </div>
      ) : (
        <video
          ref={videoRef}
          poster="/cabal-hero-poster.jpg"
          autoPlay={!reduce}
          muted={muted}
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

      {!failed && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? "Activar sonido" : "Silenciar"}
          className="glass-panel absolute bottom-3 right-3 z-10 flex size-9 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
        >
          {muted ? (
            <VolumeX className="size-4" aria-hidden="true" />
          ) : (
            <Volume2 className="size-4" aria-hidden="true" />
          )}
        </button>
      )}

      {/* grano sutil: disimula el reescalado de la imagen base */}
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay" />

      {/* mezcla vertical con el fondo del hero */}
      <div className="pointer-events-none absolute inset-0 lg:[background:linear-gradient(0deg,var(--background)_2%,transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 lg:[background:linear-gradient(180deg,var(--background),transparent)]" />

      {/* divulgación: contenido generado con IA, siempre visible (sobre foto/video, con su propio scrim oscuro fijo por legibilidad) */}
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
    <section className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background pt-32 text-foreground sm:pt-36">
      {/* Fondo del hero: sigue el tema del sitio (claro por defecto, con
          aurora animada solo en modo oscuro). */}
      <HeroAurora />

      {/* Retrato a sangre en el borde derecho (desktop). El borde izquierdo
          se enmascara a transparente (sin blur, sin overlay de color): deja
          ver el propio fondo aurora que ya está detrás, así que el empalme
          es exacto por construcción, no por intentar igualar el color. */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[48%] lg:block xl:w-[46%]"
        style={{
          maskImage: "linear-gradient(90deg, transparent 0%, black 24%)",
          WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 24%)",
        }}
      >
        <PortraitBleed />
      </div>

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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                  Trayectoria
                </p>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
                  {cabalStats[0].value}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  en el Congreso ·{" "}
                  <span className="underline decoration-dotted underline-offset-2 group-hover:text-foreground">
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
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {cabalStats[2].value}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  proyectos de ley 2024–25 ·{" "}
                  <span className="underline decoration-dotted underline-offset-2 group-hover:text-foreground">
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
            <span className="animate-shimmer bg-[linear-gradient(110deg,var(--brand)_20%,var(--accent)_45%,var(--brand)_70%)] bg-[length:200%_auto] bg-clip-text text-transparent">
              libertad
            </span>{" "}
            a través de la educación
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-md border-l-2 border-brand/60 pl-4 text-left text-sm italic text-muted-foreground sm:text-base"
          >
            “{cabalQuote.text}”
            <span className="mt-1 block text-xs not-italic text-muted-foreground/70">
              — María Fernanda Cabal ·{" "}
              <a
                href={cabalQuote.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
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
              className="ring-glow bg-brand text-brand-foreground hover:brightness-110"
            >
              <Link href="/donar">
                Donar / Apoyar
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border border-border bg-foreground/5 text-foreground backdrop-blur-md hover:bg-foreground/10"
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
            className="mt-10 w-full max-w-md scroll-mt-32 [&_*]:!border-border"
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
                className="group block w-full overflow-hidden rounded-2xl border border-border bg-foreground/5 text-left transition-colors hover:border-foreground/25"
              >
                <div className="grid grid-cols-3 gap-px">
                  {cabalStats.map((stat) => {
                    const { prefix, number, suffix } = splitStat(stat.value);
                    return (
                      <div
                        key={stat.label}
                        className="bg-background/60 p-4 backdrop-blur-sm sm:p-5"
                      >
                        <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
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
                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                          {stat.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <span className="flex items-center justify-center gap-1.5 border-t border-border bg-foreground/[0.02] py-2 text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                  Ver iniciativas y fuentes
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </button>
            }
          />
        </Reveal>
      </Container>

      {/* Ticker de iniciativas al pie del hero */}
      <div className="relative mt-auto flex items-center gap-4 border-t border-border bg-background/70 py-3 backdrop-blur-sm">
        <span className="ml-6 hidden shrink-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand sm:flex">
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
                <span className="size-1 rounded-full bg-brand" />
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
