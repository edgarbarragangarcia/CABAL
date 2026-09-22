"use client";

import * as React from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { UserRound, VideoOff, Volume2, VolumeX, Wand2 } from "lucide-react";

/**
 * Telón de fondo del hero: el video ocupa la sección entera y el texto se
 * apoya sobre un degradado direccional. Encuadrar el retrato a sangre —en
 * vez de meterlo en una columna— es lo que da la escala de cine; el
 * degradado hace el trabajo de legibilidad que antes hacía el recorte.
 */
export function HeroBackdrop() {
  const reduce = useReducedMotion();
  const [failed, setFailed] = React.useState(false);
  const [muted, setMuted] = React.useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const sectionRef = React.useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  // El fondo se va más lento que la página y se oscurece al salir: da
  // profundidad sin que el titular se despegue de su sitio.
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const dim = useTransform(scrollYProgress, [0, 1], [0, 0.55]);

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
    <div ref={sectionRef} className="absolute inset-0 -z-10 overflow-hidden">
      {/* El video es vertical: con `object-cover` sobre un contenedor ancho,
          `object-position` horizontal no hace nada (sobra alto, no ancho).
          Por eso el video vive en su propia columna a sangre a la derecha y
          se funde con el fondo por máscara, no por recorte. */}
      {/* La máscara desvanece el video hacia el fondo, y cambia de eje con
          el ancho: en móvil el video ocupa la franja superior y se apaga
          hacia abajo (el texto va debajo); en escritorio ocupa la columna
          derecha y se apaga hacia la izquierda. Un scrim horizontal en
          móvil dejaría el titular encima del rostro. */}
      <motion.div
        style={{ y: reduce ? 0 : y, scale: reduce ? 1 : scale }}
        className="absolute inset-x-0 top-0 h-[56svh] [-webkit-mask-image:linear-gradient(180deg,black_45%,transparent_92%)] [mask-image:linear-gradient(180deg,black_45%,transparent_92%)] lg:inset-y-0 lg:left-auto lg:h-auto lg:w-[64%] lg:[-webkit-mask-image:linear-gradient(90deg,transparent_0%,black_32%)] lg:[mask-image:linear-gradient(90deg,transparent_0%,black_32%)]"
      >
        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-muted text-muted-foreground">
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
            className="size-full object-cover object-[50%_12%]"
            onError={() => setFailed(true)}
          >
            <source src="/cabal-hero.mp4" type="video/mp4" />
          </video>
        )}
      </motion.div>

      {/* Scrim direccional: opaco donde va el texto, limpio sobre el rostro.
          Capas separadas (horizontal + inferior + superior) en vez de un
          velo plano, que apagaría la imagen entera. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden lg:block lg:[background:linear-gradient(90deg,var(--background)_0%,color-mix(in_oklab,var(--background)_96%,transparent)_34%,color-mix(in_oklab,var(--background)_55%,transparent)_50%,transparent_72%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-3/4 [background:linear-gradient(0deg,var(--background)_38%,color-mix(in_oklab,var(--background)_75%,transparent)_62%,transparent_100%)] lg:h-1/2 lg:[background:linear-gradient(0deg,var(--background)_6%,color-mix(in_oklab,var(--background)_70%,transparent)_45%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-56 [background:linear-gradient(180deg,var(--background)_2%,transparent_100%)]"
      />
      {/* Tinte de marca muy bajo: unifica el video con la paleta del sitio */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18] mix-blend-color [background:var(--brand)]"
      />
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-[0.1] mix-blend-overlay" aria-hidden="true" />

      {/* Oscurecido progresivo al hacer scroll */}
      <motion.div
        aria-hidden="true"
        style={{ opacity: reduce ? 0 : dim }}
        className="absolute inset-0 bg-background"
      />

      {!failed && (
        <>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={muted ? "Activar sonido del video" : "Silenciar video"}
            className="glass-panel absolute right-6 top-40 z-10 flex size-10 items-center justify-center rounded-full text-foreground transition-transform duration-300 hover:scale-105 lg:bottom-48 lg:right-10 lg:top-auto"
          >
            {muted ? (
              <VolumeX className="size-4" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4" aria-hidden="true" />
            )}
          </button>

          {/* Divulgación de contenido sintético: siempre visible, con su
              propio scrim fijo para que no dependa del tema. */}
          <span className="absolute right-6 top-28 z-10 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[10px] font-medium text-zinc-200 backdrop-blur-md lg:right-10 lg:top-32">
            <Wand2 className="size-3" aria-hidden="true" />
            Video generado con IA
          </span>
        </>
      )}
    </div>
  );
}
