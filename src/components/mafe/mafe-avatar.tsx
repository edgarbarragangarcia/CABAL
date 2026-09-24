import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Caricatura de MaFe (inspirada en María Fernanda Cabal): cabello oscuro
 * ondulado con raya al lado, cejas marcadas, sonrisa amplia, collar de
 * perlas y blazer negro. SVG a mano — parpadea sola y mueve la boca cuando
 * `talking` está activo (mientras el chat escribe la respuesta).
 */
export function MafeAvatar({
  talking = false,
  className,
  title = "MaFe",
}: {
  talking?: boolean;
  className?: string;
  title?: string;
}) {
  const id = React.useId().replace(/:/g, "");
  const pearls = Array.from({ length: 11 }, (_, i) => {
    // Arco del collar sobre el escote.
    const t = i / 10;
    const x = 94 + t * 52;
    const y = 191 + Math.sin(t * Math.PI) * 16;
    return { x, y };
  });

  return (
    <svg
      viewBox="0 0 240 240"
      className={cn("mafe-avatar", talking && "mafe-avatar--talking", className)}
      role="img"
      aria-label={title}
    >
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#fdf1d6" />
          <stop offset="100%" stopColor="#e3b566" />
        </radialGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a271d" />
          <stop offset="100%" stopColor="#1f140f" />
        </linearGradient>
        <radialGradient id={`${id}-skin`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#f6cdab" />
          <stop offset="100%" stopColor="#e4a782" />
        </radialGradient>
        <radialGradient id={`${id}-pearl`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#eeeae3" />
          <stop offset="100%" stopColor="#c9c2b6" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx="120" cy="120" r="120" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id}-clip)`}>
        <circle cx="120" cy="120" r="120" fill={`url(#${id}-bg)`} />

        {/* Cabello de atrás: volumen hasta los hombros */}
        <path
          d="M120 22c-46 0-72 30-74 70-2 30-10 52-22 72-10 18-4 40 18 44 18 3 30-8 36-22l84 0c6 14 18 25 36 22 22-4 28-26 18-44-12-20-20-42-22-72-2-40-28-70-74-70z"
          fill={`url(#${id}-hair)`}
        />

        {/* Blazer, blusa y cuello */}
        <path d="M22 240c4-34 26-52 60-58l38 8 38-8c34 6 56 24 60 58z" fill="#16181c" />
        <path d="M96 184l24 44 24-44-24 6z" fill="#f5f2ec" />
        <path d="M82 182l38 58-14 0-34-52z" fill="#23262c" />
        <path d="M158 182l-38 58 14 0 34-52z" fill="#23262c" />
        <path d="M106 150h28v34c-6 6-22 6-28 0z" fill="#e7ae8b" />
        <path d="M106 160c8 6 20 6 28 0v8c-8 5-20 5-28 0z" fill="#d99a76" opacity="0.6" />

        {/* Collar de perlas */}
        {pearls.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4.6} fill={`url(#${id}-pearl)`} stroke="#b9b1a4" strokeWidth={0.5} />
        ))}
        <circle cx={pearls[5].x + 7} cy={pearls[5].y - 3} r={3.2} fill="#d4a93c" />

        {/* Orejas y aretes de perla */}
        {/* Solo la oreja derecha: la izquierda la tapa el cabello */}
        <ellipse cx="168" cy="108" rx="8" ry="12" fill="#e4a782" />
        <circle cx="168" cy="124" r="4" fill={`url(#${id}-pearl)`} />

        {/* Cara */}
        <path
          d="M120 46c30 0 48 24 48 56 0 36-22 62-48 62s-48-26-48-62c0-32 18-56 48-56z"
          fill={`url(#${id}-skin)`}
        />

        {/* Cabello de adelante: raya al lado y onda sobre la frente */}
        <path
          d="M136 40c-40-6-70 14-72 52-1 14 2 30 6 42 4-18 10-34 20-44 14-14 32-20 46-36 4 10 12 18 24 22 10 4 20 12 26 26 2-28-12-56-50-62z"
          fill={`url(#${id}-hair)`}
        />
        <path
          d="M64 96c-6 22-4 46 4 64-10-8-16-22-16-38 0-10 4-20 12-26zM176 96c6 22 4 46-4 64 10-8 16-22 16-38 0-10-4-20-12-26z"
          fill="#2a1c15"
        />
        <path d="M150 50c10 7 16 18 18 30M60 110c-2 16 0 30 6 42" stroke="#7a5642" strokeWidth={4} strokeLinecap="round" fill="none" opacity="0.45" />

        {/* Cejas */}
        <path d="M88 94c8-8 18-9 26-4" stroke="#241712" strokeWidth={5} strokeLinecap="round" fill="none" />
        <path d="M126 90c8-5 18-4 26 4" stroke="#241712" strokeWidth={5} strokeLinecap="round" fill="none" />

        {/* Ojos (parpadean) */}
        <g className="mafe-avatar__eyes">
          <ellipse cx="101" cy="101" rx="11" ry="5" fill="#c98a6e" opacity="0.3" />
          <ellipse cx="139" cy="101" rx="11" ry="5" fill="#c98a6e" opacity="0.3" />
          <ellipse cx="101" cy="106" rx="9.5" ry="7" fill="#fffdf9" />
          <ellipse cx="139" cy="106" rx="9.5" ry="7" fill="#fffdf9" />
          <circle cx="101.5" cy="105.5" r="5.8" fill="#5a3522" />
          <circle cx="138.5" cy="105.5" r="5.8" fill="#5a3522" />
          <circle cx="101.5" cy="105.5" r="2.8" fill="#120b07" />
          <circle cx="138.5" cy="105.5" r="2.8" fill="#120b07" />
          <circle cx="103.4" cy="103.4" r="1.7" fill="#ffffff" />
          <circle cx="140.4" cy="103.4" r="1.7" fill="#ffffff" />
          <path d="M90 104c6-7 16-8 22-1M128 103c6-7 16-6 22 1" stroke="#1c1410" strokeWidth={2.8} strokeLinecap="round" fill="none" />
          <path d="M91 102l-4-3M93 100l-2-4M149 102l4-3M147 100l2-4" stroke="#1c1410" strokeWidth={1.8} strokeLinecap="round" />
        </g>

        {/* Nariz y mejillas */}
        <path d="M121 114c-2 5-3 9-1 11 2 1.5 5 1.5 7-0.5" stroke="#cf8f6c" strokeWidth={2} strokeLinecap="round" fill="none" />
        <circle cx="92" cy="130" r="9" fill="#f08a80" opacity="0.28" />
        <circle cx="148" cy="130" r="9" fill="#f08a80" opacity="0.28" />

        {/* Boca (se mueve al "hablar") */}
        <g className="mafe-avatar__mouth">
          <path d="M98 137c10 17 34 17 44 0-11 5-33 5-44 0z" fill="#c24b53" />
          <path d="M103 139c9 7 25 7 34 0-9 2.5-25 2.5-34 0z" fill="#ffffff" />
          <path d="M98 137c11-3 33-3 44 0-6-5-15-4-22-1-7-3-16-4-22 1z" fill="#b13f48" />
        </g>
      </g>
    </svg>
  );
}
