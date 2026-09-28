"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import * as React from "react";

/**
 * Telón de fondo del hero: el retrato ocupa la sección entera y el texto se
 * apoya sobre un degradado direccional. Encuadrar el retrato a sangre —en
 * vez de meterlo en una columna— es lo que da la escala de cine; el
 * degradado hace el trabajo de legibilidad que antes hacía el recorte.
 *
 * Foto fija (antes había un video generado con IA; se retiró).
 */
export function HeroBackdrop() {
  const reduce = useReducedMotion();
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

  return (
    <div ref={sectionRef} className="absolute inset-0 -z-10 overflow-hidden">
      {/* El retrato es vertical: con `object-cover` sobre un contenedor ancho,
          `object-position` horizontal no hace nada (sobra alto, no ancho).
          Por eso vive en su propia columna a sangre a la derecha y se funde
          con el fondo por máscara, no por recorte. */}
      {/* La máscara desvanece la foto hacia el fondo, y cambia de eje con el
          ancho: en móvil ocupa la franja superior y se apaga hacia abajo (el
          texto va debajo); en escritorio ocupa la columna derecha y se apaga
          hacia la izquierda. Un scrim horizontal en móvil dejaría el titular
          encima del rostro. */}
      <motion.div
        style={{ y: reduce ? 0 : y, scale: reduce ? 1 : scale }}
        className="absolute inset-x-0 top-0 h-[56svh] [-webkit-mask-image:linear-gradient(180deg,black_45%,transparent_92%)] [mask-image:linear-gradient(180deg,black_45%,transparent_92%)] lg:inset-y-0 lg:left-auto lg:h-auto lg:w-[64%] lg:[-webkit-mask-image:linear-gradient(90deg,transparent_0%,black_32%)] lg:[mask-image:linear-gradient(90deg,transparent_0%,black_32%)]"
      >
        <Image
          src="/cabal-hero.jpg"
          alt="María Fernanda Cabal"
          fill
          priority
          sizes="(min-width: 1024px) 64vw, 100vw"
          className="object-cover object-[50%_18%]"
        />
      </motion.div>

      {/* Scrim direccional: opaco donde va el texto, limpio sobre el rostro.
          Capas separadas (horizontal + inferior + superior) en vez de un
          velo plano, que apagaría la imagen entera. */}
      {/* El titular puede ser largo ("Construimos libertad a través de la
          educación" a 3 líneas): en pantallas justo por encima de `lg`
          (~1024–1280px) sus líneas más anchas llegan bastante más allá de
          donde arranca la columna de la foto. Por eso el velo se mantiene
          opaco hasta bien pasada esa zona en vez de apagarse enseguida —
          si no, el texto queda leyéndose directamente sobre la foto. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden lg:block lg:[background:linear-gradient(90deg,var(--background)_0%,color-mix(in_oklab,var(--background)_97%,transparent)_42%,color-mix(in_oklab,var(--background)_50%,transparent)_64%,transparent_88%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-3/4 [background:linear-gradient(0deg,var(--background)_38%,color-mix(in_oklab,var(--background)_75%,transparent)_62%,transparent_100%)] lg:h-1/2 lg:[background:linear-gradient(0deg,var(--background)_6%,color-mix(in_oklab,var(--background)_70%,transparent)_45%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-56 [background:linear-gradient(180deg,var(--background)_2%,transparent_100%)]"
      />
      {/* Tinte de marca muy bajo: unifica la foto con la paleta del sitio */}
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
    </div>
  );
}
