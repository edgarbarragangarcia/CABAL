"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pause, Play, Radio, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import { liveRadioName, liveRadioStreamUrl } from "@/config/media";

type PlaybackState = "idle" | "loading" | "playing" | "error";

const BAR_COUNT = 5;

/** Barras de "onda" animadas: solo se mueven mientras el stream reproduce. */
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="hidden h-6 items-end gap-[3px] sm:flex" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          animate={
            active
              ? { height: ["30%", "100%", "45%", "80%", "30%"] }
              : { height: "20%" }
          }
          transition={
            active
              ? {
                  duration: 0.9 + i * 0.12,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
}

/**
 * Reproductor de la radio en vivo de la fundación. Usa un <audio> nativo
 * (el stream es AAC servido por Icecast) en lugar de un iframe embebido,
 * para tener control total del estado de reproducción y evitar cargar
 * scripts de terceros innecesarios. Sin wrapper de sección: se puede
 * incrustar en el Hero o en cualquier otro contenedor.
 */
export function LiveRadioWidget({ className }: { className?: string }) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [state, setState] = React.useState<PlaybackState>("idle");
  const [muted, setMuted] = React.useState(false);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state === "playing") {
      audio.pause();
      setState("idle");
      return;
    }

    setState("loading");
    // Recargar el stream al reanudar evita reproducir un buffer desfasado
    // tras una pausa larga (comportamiento típico de streams en vivo).
    audio.load();
    audio.play().catch(() => setState("error"));
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  };

  const isPlaying = state === "playing";

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-foreground text-background shadow-xl", className)}>
      {/* Resplandor de marca sutil, coherente con el Hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full opacity-30 blur-3xl"
        style={{
          background: "conic-gradient(from 90deg at 50% 50%, var(--brand), var(--accent), var(--brand))",
        }}
      />

      <div className="relative flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
        <motion.button
          type="button"
          onClick={togglePlayback}
          whileTap={{ scale: 0.92 }}
          aria-label={state === "playing" ? "Pausar radio en vivo" : "Reproducir radio en vivo"}
          aria-pressed={isPlaying}
          disabled={state === "loading"}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition-transform hover:scale-105 disabled:cursor-wait disabled:opacity-70",
            isPlaying && "animate-pulse-glow"
          )}
        >
          {state === "loading" ? (
            <Radio className="size-4.5 animate-spin" aria-hidden="true" />
          ) : isPlaying ? (
            <Pause className="size-4.5" aria-hidden="true" />
          ) : (
            <Play className="size-4.5 translate-x-0.5" aria-hidden="true" />
          )}
        </motion.button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="relative flex size-1.5 shrink-0">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75",
                  isPlaying && "animate-ping"
                )}
              />
              <span className="relative inline-flex size-1.5 rounded-full bg-destructive" />
            </span>
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-background/60">
              En vivo · {liveRadioName}
            </p>
          </div>
          <p className="mt-0.5 truncate text-sm text-background/85">
            {state === "error"
              ? "No fue posible conectar. Intenta de nuevo."
              : "Análisis, formación y opinión, 24 horas."}
          </p>
        </div>

        <Waveform active={isPlaying} />

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Activar sonido" : "Silenciar"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-background/20 text-background/70 transition-colors hover:border-accent hover:text-accent"
        >
          {muted ? (
            <VolumeX className="size-4" aria-hidden="true" />
          ) : (
            <Volume2 className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* preload="none": el stream en vivo solo se solicita cuando el usuario decide escuchar. */}
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setState("playing")}
        onWaiting={() => setState("loading")}
        onError={() => setState("error")}
        onPause={() => setState((prev) => (prev === "error" ? prev : "idle"))}
      >
        <source src={liveRadioStreamUrl} type="audio/aac" />
      </audio>
    </div>
  );
}
