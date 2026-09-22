"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { AnimatedCounter } from "@/components/animations/animated-counter";

/**
 * Cifras de impacto de la fundación.
 *
 * `value: null` = dato aún no verificado: la celda muestra un guion y una
 * marca de "pendiente" en vez de un número. Mismo criterio que
 * `config/maria-fernanda-cabal.ts` — aquí no se publican estimaciones ni
 * cifras de relleno. Para activar una, pon el número y su fuente en
 * `note`; el contador y el formato se encargan solos.
 */
type Figure = {
  value: number | null;
  suffix: string;
  label: string;
  note: string;
};

const FIGURES: Figure[] = [
  { value: null, suffix: "+", label: "Estudiantes formados", note: "Academia y talleres presenciales" },
  { value: null, suffix: "", label: "Proyectos de ley analizados", note: "Observatorio legislativo, 2024–2025" },
  { value: null, suffix: "", label: "Departamentos con cobertura", note: "Programas y aliados en territorio" },
  { value: null, suffix: "%", label: "Satisfacción de egresados", note: "Encuesta de cierre de cohorte" },
];

/**
 * Franja de cifras a sangre en oscuro. El corte de luminosidad contra las
 * secciones claras es lo que le da ritmo a la página: sin él, todo se lee
 * como un solo bloque largo.
 */
export function ImpactBand() {
  const ref = React.useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Paralaje suave del resplandor de fondo, no del contenido: mover el
  // texto con el scroll cansa la vista y rompe la línea de lectura.
  const glowY = useTransform(scrollYProgress, [0, 1], ["-18%", "18%"]);

  return (
    <section ref={ref} className="relative isolate overflow-hidden bg-[#0a0c0b] py-24 text-[#f1efe9] sm:py-32">
      <motion.div
        style={{ y: reduce ? 0 : glowY }}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-1/3 h-[150%] opacity-70 [background:radial-gradient(45%_45%_at_25%_30%,#0a4f37_0%,transparent_65%),radial-gradient(40%_40%_at_80%_60%,#b3893c_0%,transparent_60%)]"
      />
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-overlay" aria-hidden="true" />

      <Container className="relative">
        <Reveal className="max-w-2xl">
          <span className="eyebrow inline-flex items-center gap-2.5 text-[#e0bd7c]">
            <span className="h-px w-8 bg-[#e0bd7c]/60" aria-hidden="true" />
            Impacto
          </span>
          <h2 className="mt-5 text-balance font-display text-4xl font-normal leading-[1.08] text-[#f1efe9] sm:text-5xl">
            Lo que se mide, se sostiene
          </h2>
        </Reveal>

        <dl className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {FIGURES.map((f, i) => (
            <Reveal key={f.label} delay={i * 0.08}>
              <div className="group h-full bg-[#0a0c0b]/80 p-7 backdrop-blur-sm transition-colors duration-500 hover:bg-[#0a0c0b]/40">
                <dd className="tabular font-display text-5xl font-normal tracking-tight text-[#f1efe9] sm:text-6xl">
                  {f.value === null ? (
                    <span className="text-[#f1efe9]/35" aria-label="Dato pendiente">
                      —
                    </span>
                  ) : (
                    <AnimatedCounter value={f.value} suffix={f.suffix} />
                  )}
                </dd>
                <dt className="mt-4 text-sm font-medium text-[#f1efe9]">{f.label}</dt>
                <p className="mt-1.5 text-xs leading-relaxed text-[#f1efe9]/55">
                  {f.value === null ? "Cifra pendiente de verificación" : f.note}
                </p>
              </div>
            </Reveal>
          ))}
        </dl>
      </Container>
    </section>
  );
}
