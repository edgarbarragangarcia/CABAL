"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Bank,
  BookOpenText,
  Flag,
  Gavel,
  GraduationCap,
  Lightbulb,
  Quotes,
  Scales,
  Student,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { AnimatedCounter } from "@/components/animations/animated-counter";
import { MafeAvatar } from "@/components/mafe/mafe-avatar";
import { TrajectoryDialog } from "@/components/sections/trajectory-dialog";
import { LiveRadioWidget } from "@/components/sections/live-radio-widget";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { cabalStats, cabalQuote, cabalBills } from "@/config/maria-fernanda-cabal";

const EASE = [0.16, 1, 0.3, 1] as const;

function splitStat(value: string) {
  const m = value.match(/^(\D*)(\d+)(.*)$/);
  if (!m) return { prefix: "", number: null as number | null, suffix: value };
  return { prefix: m[1], number: Number(m[2]), suffix: m[3] };
}

/* ───────────────────────── Panel oscuro en diagonal ───────────────────────── */

/**
 * Silueta del panel: el borde izquierdo se inclina 0,51 px por cada px de alto (27°) y la punta de abajo se redondea
 * con un arco. `clip-path` no tiene curvas, así que el arco va aproximado con puntos; cada uno se mide desde la punta
 * (`X0`, abajo) en px, de modo que el redondeo no se deforma al cambiar el ancho de la pantalla.
 */
const INCLINACION = 0.5095;
const RADIO = 96;
const X0 = "50% - 120px";
const ALTO_HERO = "max(100svh, 44rem)";

function poligonoPanel() {
  const alfa = Math.atan(1 / INCLINACION); // ángulo interior de la punta
  const t = RADIO / Math.tan(alfa / 2); // distancia de la punta a los puntos de tangencia
  const s = Math.hypot(1, INCLINACION);
  const centro = { x: t, y: -RADIO };
  const tangente = { x: (t * INCLINACION) / s, y: -t / s };
  let a0 = Math.atan2(tangente.y - centro.y, tangente.x - centro.x);
  if (a0 < 0) a0 += Math.PI * 2;
  const a1 = Math.PI / 2;
  const pasos = 8;
  const puntos = [`100% 0`, `calc(${X0} + ${INCLINACION} * ${ALTO_HERO}) 0`];
  for (let i = 0; i <= pasos; i++) {
    const a = a0 + ((a1 - a0) * i) / pasos;
    const x = centro.x + RADIO * Math.cos(a);
    const arriba = -(centro.y + RADIO * Math.sin(a)); // px sobre el borde de abajo
    puntos.push(`calc(${X0} + ${x.toFixed(1)}px) ${arriba < 0.05 ? "100%" : `calc(100% - ${arriba.toFixed(1)}px)`}`);
  }
  puntos.push(`100% 100%`);
  return `polygon(${puntos.join(", ")})`;
}

const PANEL = poligonoPanel();

/** Íconos de línea finísima sobre el panel (instituciones, justicia, educación): textura, no ilustración. */
const ICONOS_PANEL: { Icono: Icon; clase: string }[] = [
  { Icono: Lightbulb, clase: "left-[80%] top-[3%] size-20 rotate-12" },
  { Icono: Bank, clase: "left-[88%] top-[6%] size-28 rotate-6" },
  { Icono: Scales, clase: "left-[63%] top-[22%] size-24 -rotate-12" },
  { Icono: GraduationCap, clase: "left-[92%] top-[34%] size-24 -rotate-12" },
  { Icono: BookOpenText, clase: "left-[60%] top-[52%] size-24 rotate-12" },
  { Icono: Flag, clase: "left-[92%] top-[60%] size-28 rotate-6" },
  { Icono: Gavel, clase: "left-[50%] top-[78%] size-24 -rotate-[20deg]" },
  { Icono: Student, clase: "left-[86%] top-[80%] size-24 -rotate-6" },
];

function PanelOscuro() {
  return (
    <motion.div
      aria-hidden
      initial={{ x: 120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 1.2, ease: EASE }}
      style={{ clipPath: PANEL }}
      className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(155deg,#0c5a3f_0%,#06281c_55%,#031610_100%)] lg:block"
    >
      {/* Luz tras el retrato: separa el pelo y el saco oscuros del fondo */}
      <div className="absolute left-[calc(50%+304px-300px)] top-[3%] size-[600px] rounded-full bg-[radial-gradient(closest-side,rgba(48,170,120,0.55),transparent)]" />
      <div className="absolute -bottom-40 right-[-10%] size-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(224,189,124,0.16),transparent)]" />
      {ICONOS_PANEL.map(({ Icono, clase }, i) => (
        <Icono key={i} weight="thin" className={`absolute text-white/[0.09] ${clase}`} />
      ))}
      <div className="bg-grain absolute inset-0 opacity-[0.14] mix-blend-overlay" />
    </motion.div>
  );
}

/* ───────────────────────────── Retrato y declaración ───────────────────────────── */

/** El retrato recortado (sin fondo) asoma del panel: parte del pelo y del hombro cae sobre el blanco. */
function Retrato() {
  const ref = React.useRef<HTMLDivElement>(null);
  const quieto = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-2%", "6%"]);

  // El recorte completo mide `--h` de alto, pero solo se ve de la cabeza al pecho (76 %): la caja corta ahí y la foto se desvanece antes.
  // Así la figura sale grande (los hombros cruzan la diagonal) sin ocupar el alto que necesita la declaración de abajo.
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 56 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 1.1, ease: EASE }} className="relative z-10 [--h:min(clamp(24rem,66svh,46rem),calc((100vw_-_3rem)/0.6374))] lg:-translate-x-14">
      {/* La sombra va en el contenedor y el desvanecido en la foto: así la sombra sigue la silueta ya recortada y no se corta en el borde de la imagen. */}
      <motion.div style={quieto ? undefined : { y }} className="relative h-[calc(var(--h)*0.76)] w-[calc(var(--h)*0.6374)] drop-shadow-[0_22px_28px_rgba(2,18,12,0.4)]">
        <Image
          src="/cabal-recorte.webp"
          alt="María Fernanda Cabal"
          width={928}
          height={1456}
          priority
          sizes="(min-width: 1024px) 420px, 72vw"
          className="absolute left-0 top-0 h-[var(--h)] w-full max-w-none [mask-image:linear-gradient(to_bottom,#000_54%,transparent_76%)]"
        />
      </motion.div>
    </motion.div>
  );
}

/** Declaración en dos cajas de borde punteado, como un cupón: la cabecera con la fuente y el texto debajo. */
function Declaracion() {
  return (
    <motion.figure initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.9, ease: EASE }} className="relative z-10 w-full max-w-[27rem] space-y-2.5 text-[#f1efe9]">
      <div className="flex items-center justify-between rounded-xl border border-dashed border-white/30 px-4 py-2.5 text-[0.65rem] font-semibold tracking-[0.18em] uppercase">
        <span className="text-[#f1efe9]/70">Declaración</span>
        <a href={cabalQuote.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[#e0bd7c] hover:text-[#f6e2b0]">
          {cabalQuote.sourceLabel} <ArrowUpRight weight="bold" className="size-3" aria-hidden="true" />
        </a>
      </div>
      <div className="rounded-2xl border border-dashed border-white/30 bg-white/[0.04] p-5 backdrop-blur-sm">
        <Quotes weight="fill" aria-hidden="true" className="size-6 text-[#e0bd7c]" />
        <blockquote className="mt-2 font-display text-[1.1rem] italic leading-snug">“{cabalQuote.text}”</blockquote>
        <figcaption className="mt-3 text-xs text-[#f1efe9]/65">— María Fernanda Cabal</figcaption>
      </div>
    </motion.figure>
  );
}

/* ───────────────────────────────── Detalles ───────────────────────────────── */

const PUNTOS: { clase: string; retraso: number }[] = [
  { clase: "left-[calc(50%+250px)] top-[17%] size-2 bg-[#e0bd7c]", retraso: 0 },
  { clase: "left-[calc(50%+335px)] top-[12%] size-1.5 bg-[#e0bd7c]/70", retraso: 1.3 },
  { clase: "left-[calc(50%+30px)] top-[35%] size-2.5 bg-foreground", retraso: 2.2 },
  { clase: "left-[calc(50%-40px)] top-[60%] size-1.5 bg-[#b3893c]", retraso: 0.7 },
  { clase: "left-[calc(50%+120px)] top-[80%] size-2 bg-[#e0bd7c]", retraso: 1.9 },
];

/** Puntitos y un trazo fino que cruza la diagonal: dan profundidad y unen el blanco con el panel. */
function Adornos() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      <svg viewBox="0 0 640 380" className="absolute left-[calc(50%-96px)] top-[20%] w-[560px] text-[#b3893c]/55" fill="none">
        <path d="M630 24 C 520 -14 440 118 340 150 C 236 184 116 150 0 268" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="630" cy="24" r="4" fill="currentColor" />
      </svg>
      {PUNTOS.map((p, i) => (
        <span key={i} className={`absolute rounded-full motion-safe:animate-float-y [animation-duration:9s] ${p.clase}`} style={{ animationDelay: `${p.retraso}s` }} />
      ))}
    </div>
  );
}

function Garabato({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 56 22" className={className} fill="none">
      <path d="M2 14 C 8 4, 14 4, 20 12 S 32 20, 38 10 S 50 4, 54 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* ───────────────────────────── Franja de trayectoria ───────────────────────────── */

/** Las tres cifras de la trayectoria como franja tipográfica con filetes; cada una abre la ficha con sus fuentes. */
function Trayectoria() {
  return (
    <div className="relative border-y border-border bg-surface/70 backdrop-blur-sm">
      <Container className="grid xl:grid-cols-[1fr_1fr_1fr_1.15fr]">
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:col-span-3">
          {cabalStats.map((stat) => {
            const { prefix, number, suffix } = splitStat(stat.value);
            return (
              <TrajectoryDialog
                key={stat.label}
                trigger={
                  <button type="button" aria-label={`${stat.value}: ${stat.label}. Ver la trayectoria completa y sus fuentes`} className="group relative cursor-pointer px-1 py-8 text-left sm:px-8 sm:first:pl-0">
                    <span aria-hidden className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-accent transition-transform duration-700 group-hover:scale-x-100" />
                    <span className="tabular flex items-baseline gap-2 whitespace-nowrap font-display text-5xl font-light leading-none tracking-tight sm:text-6xl">
                      {number === null ? (
                        stat.value
                      ) : (
                        <>
                          <span>
                            {prefix}
                            <AnimatedCounter value={number} />
                          </span>
                          {suffix.trim() && <span className="font-sans text-base font-medium tracking-normal text-muted-foreground">{suffix.trim()}</span>}
                        </>
                      )}
                    </span>
                    <span className="mt-3 block max-w-[17rem] text-sm leading-snug text-muted-foreground">{stat.label}</span>
                    <span className="mt-3 inline-flex items-center gap-1 text-[0.65rem] font-semibold tracking-[0.16em] text-accent-ink uppercase opacity-70 transition-opacity group-hover:opacity-100">
                      Ver fuente <ArrowUpRight weight="bold" className="size-3" />
                    </span>
                  </button>
                }
              />
            );
          })}
        </div>
        <div className="border-t border-border xl:border-l xl:border-t-0">
          <LiveRadioWidget className="h-full rounded-none bg-transparent text-foreground shadow-none [&>div:first-child]:hidden" />
        </div>
      </Container>
    </div>
  );
}

/* ───────────────────────────────────── Hero ───────────────────────────────────── */

export function Hero() {
  const marquee = [...cabalBills, ...cabalBills];

  return (
    <section className="relative isolate overflow-hidden text-foreground">
      {/* Bloque principal: el panel oscuro y los adornos viven solo aquí, no debajo de la franja de cifras */}
      <div className="relative isolate">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(45%_40%_at_6%_12%,rgba(179,137,60,0.1),transparent_70%),radial-gradient(40%_40%_at_30%_100%,rgba(10,79,55,0.07),transparent_70%)]" />
      <PanelOscuro />
      <Adornos />

      <Container className="relative grid items-center gap-10 pt-28 lg:min-h-[max(100svh,44rem)] lg:grid-cols-12 lg:gap-6 lg:pt-32">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="relative z-10 pb-4 lg:col-span-6 lg:pb-24">
          <Garabato className="absolute -left-14 top-9 hidden w-10 text-[#b3893c] min-[1400px]:block" />

          <motion.span variants={fadeUp} className="eyebrow inline-flex items-center gap-2.5 !text-accent-ink">
            <span className="h-px w-10 bg-accent/60" aria-hidden="true" />
            Fundación Escuela Libertad
          </motion.span>

          {/* Pesos mezclados: ligero para el hilo de la frase, negrita para las dos ideas que importan. `clamp` escala continuo. */}
          <motion.h1 variants={fadeUp} className="mt-6 max-w-[15ch] text-balance font-display text-[clamp(2.6rem,4.4vw,4.5rem)] font-light leading-[1.03] tracking-[-0.03em]">
            Construimos{" "}
            <span className="relative inline-block font-bold">
              libertad
              <svg aria-hidden="true" viewBox="0 0 220 24" preserveAspectRatio="none" className="absolute -bottom-[0.1em] left-0 h-[0.12em] w-full text-accent">
                <motion.path d="M2 14 L 218 14" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.9, duration: 1, ease: EASE }} />
              </svg>
            </span>{" "}
            a través de la <span className="font-bold">educación</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mt-7 max-w-md text-lg leading-relaxed text-muted-foreground">
            Formamos, investigamos y acompañamos a quienes construyen el futuro de Colombia.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild size="lg" className="h-14 gap-3 bg-[#06281c] pl-2 pr-7 text-base text-[#f1efe9] shadow-[0_24px_44px_-16px_rgba(6,40,28,0.75)] hover:bg-[#0a3a29] dark:bg-[#0d5e42] dark:hover:bg-[#12714f]">
              <Link href="/unete">
                <span className="grid size-10 place-items-center rounded-full bg-[#e0bd7c] text-[#1c1405]">
                  <UsersThree weight="bold" className="!size-5" aria-hidden="true" />
                </span>
                Únete a la comunidad
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 border-[1.5px] border-foreground/80 bg-transparent px-7 text-base hover:border-foreground hover:bg-foreground hover:text-background">
              <Link href="/donar">Donar / Apoyar</Link>
            </Button>
          </motion.div>

          {/* Atajo a la asistente: en el móvil ya está en la barra de abajo */}
          <motion.button variants={fadeUp} type="button" onClick={() => window.dispatchEvent(new Event("mafe:abrir"))} className="group mt-14 hidden items-center gap-4 text-left lg:inline-flex">
            <span className="grid size-16 place-items-center rounded-full border border-dashed border-foreground/35 p-1.5 transition-transform duration-500 group-hover:rotate-6">
              <span className="grid size-full place-items-center overflow-hidden rounded-full bg-[#f6e2b0] ring-1 ring-black/5">
                <MafeAvatar className="size-14" />
              </span>
            </span>
            <span>
              <span className="block text-sm text-muted-foreground">Asistente MaFe</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[0.95rem] font-semibold">
                Pregúntale lo que necesites
                <ArrowRight weight="bold" className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </span>
          </motion.button>
        </motion.div>

        {/* Derecha: en pantallas anchas el retrato y la declaración van sobre el panel; en las estrechas, sobre un bloque oscuro con el borde de arriba inclinado */}
        <div className="relative lg:col-span-6 lg:self-center lg:pt-10">
          <div aria-hidden className="absolute -inset-x-6 bottom-0 top-[24%] bg-[linear-gradient(170deg,#0c5a3f_0%,#06281c_60%,#031610_100%)] [clip-path:polygon(0_10%,100%_0,100%_100%,0_100%)] lg:hidden" />
          <div className="relative flex flex-col items-center pb-8 lg:pb-12">
            <Retrato />
            <div className="-mt-6 flex w-full justify-center lg:mt-2">
              <Declaracion />
            </div>
          </div>
        </div>
      </Container>
      </div>

      <Trayectoria />

      {/* Ticker de iniciativas */}
      <div className="relative flex items-center gap-4 bg-background/60 py-3.5 backdrop-blur-md">
        <span className="eyebrow ml-6 hidden shrink-0 items-center gap-2 !text-brand sm:flex">Iniciativas</span>
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
