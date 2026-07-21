"use client";

import { motion } from "framer-motion";
import { ImageOff, Landmark, Quote, UserRound } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { fadeUp, staggerContainer } from "@/lib/motion";

type Voice = {
  eyebrow: string;
  name: string;
  role: string;
  quote: string;
  highlightLabel: string;
  highlightText: string;
};

const VOICE: Voice = {
  eyebrow: "Voz destacada",
  name: "Nombre por confirmar",
  role: "Rol o cargo por confirmar",
  quote:
    "Este espacio está reservado para presentar a una voz destacada de la fundación, con su fotografía oficial y una cita representativa de su labor.",
  highlightLabel: "Espacio reservado",
  highlightText: "Contenido y fotografía pendientes de autorización",
};

/**
 * Bloque destacado tipo "hero secundario": panel de foto grande a la
 * derecha con una tarjeta superpuesta (al estilo de referencias como
 * promoverporcolombia.vercel.app), y texto a la izquierda. Usa un
 * placeholder de imagen mientras no exista una fotografía con derechos
 * de uso confirmados — no se debe reemplazar por una foto de un tercero
 * real sin autorización verificada.
 */
export function Voices() {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
        >
          <motion.div variants={fadeUp}>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
              <Landmark className="size-3.5" aria-hidden="true" />
              {VOICE.eyebrow}
            </span>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Personas detrás de la {""}
              <span className="text-brand">causa</span>
            </h2>
            <p className="mt-5 max-w-md text-muted-foreground">
              Presentamos a quienes lideran y sostienen el trabajo de la fundación. Esta
              tarjeta se actualizará con una fotografía y cita oficiales en cuanto estén
              autorizadas.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="relative mx-auto mb-10 w-full max-w-sm sm:mb-12"
          >
            {/* Panel de foto: placeholder a la espera de una imagen con derechos confirmados */}
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
              delay={0.15}
              className="absolute inset-x-4 -bottom-8 rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:-bottom-10 sm:p-6"
            >
              <Quote className="size-5 text-brand" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium leading-snug text-foreground">
                “{VOICE.quote}”
              </p>
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-sm font-semibold">{VOICE.name}</p>
                <p className="text-xs text-muted-foreground">{VOICE.role}</p>
              </div>
            </Reveal>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
