import * as React from "react";
import { CalendarBlank, HandHeart, Megaphone, Newspaper, UsersThree } from "@phosphor-icons/react/dist/ssr";

import type { PlantillaId } from "@/lib/portales/plantillas";
import { Pantalla } from "./pantallas";
import { Avatar, Ic, Malla, Telefono, Vidrio } from "./piezas";

/**
 * Arte principal de cada portal: una composición de maqueta de celular, tarjetas de vidrio e ilustración dibujada por código
 * (sin fotografías). Cada plantilla tiene su propia dirección visual: clínica y limpia, editorial y cálida, nocturna y técnica,
 * y hogareña y amable.
 *
 * Las que llevan maqueta de celular tienen alto fijo (no `aspect-ratio` + `min-height`): dentro de la rejilla del hero, el
 * `min-height` se transfiere por la proporción al ancho mínimo del elemento y ensancha la columna más allá de la pantalla.
 */

/* ------------------------------------------------------------------ salud */

function HeroSalud() {
  return (
    <div className="relative mx-auto h-[34rem] w-full max-w-[32rem]">
      <Malla colores={["var(--p)", "var(--p2)", "#a7f3d0"]} />
      <svg aria-hidden viewBox="0 0 400 424" className="absolute inset-0 size-full text-[var(--p)]" fill="none">
        <circle cx="200" cy="212" r="196" stroke="currentColor" strokeOpacity=".2" strokeDasharray="3 9" />
        <circle cx="200" cy="212" r="152" stroke="currentColor" strokeOpacity=".15" />
        <circle cx="200" cy="212" r="108" stroke="currentColor" strokeOpacity=".1" strokeDasharray="1 7" />
        {[[44, 120], [352, 84], [368, 330], [30, 318]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y - 7}v14M${x - 7} ${y}h14`} stroke="currentColor" strokeOpacity=".45" strokeWidth="2.5" strokeLinecap="round" />)}
      </svg>
      <Telefono className="absolute top-[3%] left-1/2 -translate-x-1/2 -rotate-3"><Pantalla id="salud" /></Telefono>
      <Vidrio className="absolute top-[50%] -left-[8%] hidden w-[12.8rem] @md:block">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-[var(--p)] text-[var(--sobre)]"><CalendarBlank weight="bold" className="size-4" /></span><div><p className="text-[0.78rem] font-bold">Próximo encuentro</p><p className="text-[0.68rem] text-slate-500">Este sábado · 9:30 a. m.</p></div></div>
      </Vidrio>
      <Vidrio retraso={-3} className="absolute right-[-6%] bottom-[9%] hidden w-[11rem] @md:block">
        <div className="flex items-center gap-2"><Newspaper weight="duotone" className="size-5 text-[var(--p)]" /><p className="text-[0.78rem] font-bold">Novedades</p></div>
        <p className="mt-1.5 text-[0.68rem] leading-snug text-slate-500">Una guía o una noticia nueva cada semana</p>
      </Vidrio>
    </div>
  );
}

/* --------------------------------------------------------------- belleza */

function Destello({ className }: { className: string }) {
  return <svg aria-hidden viewBox="0 0 24 24" className={className}><path d="M12 1c.8 5.6 3.4 8.2 11 11-7.6 2.8-10.2 5.4-11 11-.8-5.6-3.4-8.2-11-11 7.6-2.8 10.2-5.4 11-11z" fill="currentColor" /></svg>;
}

function HeroBelleza() {
  return (
    <div className="relative mx-auto h-[34.5rem] w-full max-w-[32rem]">
      <Malla colores={["var(--p)", "#fbbf24", "#f9a8d4"]} intensidad={0.5} />
      {/* Los tres arcos salen de la «niebla»: se desvanecen hacia abajo en vez de terminar en un borde duro. */}
      <div className="absolute inset-x-0 top-0 bottom-0 [mask-image:linear-gradient(to_bottom,#000_62%,transparent_96%)]">
        <div className="absolute bottom-0 left-[1%] h-[72%] w-[31%] rounded-t-full bg-gradient-to-b from-[var(--pm)] to-[var(--p)]" />
        <div className="absolute bottom-0 left-[34%] h-[90%] w-[32%] rounded-t-full bg-gradient-to-b from-white via-[#fde4d3] to-[var(--p2)]" />
        <div className="absolute right-[1%] bottom-0 h-[64%] w-[30%] rounded-t-full bg-gradient-to-b from-[var(--p2)] to-[var(--pd)]" />
      </div>
      <Destello className="absolute top-[10%] left-[16%] size-9 text-[#f5b942]" />
      <Destello className="absolute top-[26%] right-[10%] size-6 text-white drop-shadow" />
      <Destello className="absolute top-[4%] right-[30%] size-4 text-[var(--p)]" />
      <Telefono className="absolute bottom-[-3%] left-1/2 -translate-x-1/2 scale-[.92] rotate-[5deg]"><Pantalla id="belleza" /></Telefono>
      <Vidrio className="absolute top-[56%] -left-[9%] hidden w-[12.4rem] @md:block">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[var(--p)] to-[var(--p2)] text-[var(--sobre)]"><CalendarBlank weight="bold" className="size-4" /></span><div><p className="text-[0.78rem] font-bold">Taller de la comunidad</p><p className="text-[0.68rem] text-slate-500">Sábado · 3:30 p. m.</p></div></div>
      </Vidrio>
      <Vidrio retraso={-3} className="absolute top-[8%] right-[-3%] hidden w-[9.4rem] @md:block">
        <p className="text-[0.68rem] font-bold text-slate-500">Tendencia de la semana</p>
        <div className="mt-2 flex gap-1.5">{["var(--p)", "var(--p2)", "#f5b942", "#fde4d3"].map((c, i) => <span key={i} className="size-6 rounded-full ring-2 ring-white" style={{ background: c }} />)}</div>
      </Vidrio>
    </div>
  );
}

/* ------------------------------------------------------------ motos y carros */

function Medidor({ base }: { base: string }) {
  const cx = 200, cy = 200;
  // Redondeadas a centésimas: el seno y el coseno difieren en los últimos decimales entre Node y el navegador, y eso rompe la hidratación.
  const dosDec = (n: number) => Math.round(n * 100) / 100;
  const pt = (r: number, g: number): [number, number] => [dosDec(cx + r * Math.sin((g * Math.PI) / 180)), dosDec(cy - r * Math.cos((g * Math.PI) / 180))];
  const marcas = Array.from({ length: 41 }, (_, i) => ({ g: -135 + i * (270 / 40), mayor: i % 5 === 0 }));
  const fin = -135 + 0.72 * 270;
  const [x0, y0] = pt(168, -135);
  const [x1, y1] = pt(168, fin);
  const [nx, ny] = pt(112, fin);
  return (
    <svg aria-hidden viewBox="0 0 400 400" className="absolute inset-0 size-full" fill="none">
      <defs>
        <linearGradient id={`${base}-medidor-g`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="var(--p)" /><stop offset="1" stopColor="#ef4444" /></linearGradient>
        <filter id={`${base}-medidor-brillo`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <circle cx={cx} cy={cy} r="190" stroke="white" strokeOpacity=".07" />
      <circle cx={cx} cy={cy} r="132" stroke="white" strokeOpacity=".06" strokeDasharray="2 8" />
      {marcas.map(({ g, mayor }) => { const [a, b] = pt(mayor ? 146 : 152, g); const [c, d] = pt(160, g); return <line key={g} x1={a} y1={b} x2={c} y2={d} stroke="white" strokeOpacity={mayor ? 0.5 : 0.22} strokeWidth={mayor ? 2.5 : 1.5} strokeLinecap="round" />; })}
      <path d={`M${x0} ${y0}A168 168 0 1 1 ${x1} ${y1}`} stroke={`url(#${base}-medidor-g)`} strokeWidth="9" strokeLinecap="round" filter={`url(#${base}-medidor-brillo)`} opacity=".7" />
      <path d={`M${x0} ${y0}A168 168 0 1 1 ${x1} ${y1}`} stroke={`url(#${base}-medidor-g)`} strokeWidth="9" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="white" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="9" fill="#0a0c10" stroke="white" strokeWidth="3" />
    </svg>
  );
}

function HeroMotos({ base }: { base: string }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[32rem]">
      <Malla colores={["var(--p)", "#ef4444", "#2563eb"]} intensidad={0.42} />
      <svg aria-hidden viewBox="0 0 400 400" className="absolute inset-0 size-full" fill="none">
        {[[-10, 330, 210, 270], [40, 372, 250, 300], [-30, 280, 140, 236]].map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={`url(#${base}-medidor-g)`} strokeWidth="3" strokeLinecap="round" opacity=".55" />)}
      </svg>
      <Medidor base={base} />
      <Ic id="car" weight="duotone" className="absolute top-[34%] left-[28%] size-[44%] text-white drop-shadow-[0_0_28px_var(--p)]" />
      <span className="absolute right-[7%] bottom-[10%] grid size-24 place-items-center rounded-full border border-white/15 bg-white/[0.07] shadow-[0_0_50px_-10px_var(--p)] backdrop-blur-xl"><Ic id="moto" weight="duotone" className="size-14 text-white" /></span>
      <Telefono oscuro className="absolute -bottom-[10%] left-[-6%] hidden scale-[.58] -rotate-6 origin-bottom-left @4xl:block"><Pantalla id="motos-autos" /></Telefono>
      <Vidrio oscuro className="absolute top-[6%] right-[-3%] hidden w-[12.4rem] @md:block">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-[var(--p)] text-[var(--sobre)]"><CalendarBlank weight="bold" className="size-4" /></span><div><p className="text-[0.78rem] font-bold">Rodada de la comunidad</p><p className="text-[0.68rem] text-white/60">Domingo · 7:00 a. m.</p></div></div>
      </Vidrio>
      <Vidrio oscuro retraso={-3} className="absolute top-[14%] left-[-5%] hidden w-[11.6rem] @md:block">
        <div className="flex items-center gap-2"><Megaphone weight="fill" className="size-4 text-[var(--p)]" /><p className="text-[0.78rem] font-bold">Normas al día</p></div>
        <p className="mt-0.5 text-[0.68rem] text-white/60">Lo que cambia, explicado</p>
      </Vidrio>
    </div>
  );
}

/* ------------------------------------------------------------------ hogar */

function Casa({ className, base }: { className?: string; base: string }) {
  return (
    <svg aria-hidden viewBox="0 0 400 368" className={className} fill="none">
      <defs>
        <linearGradient id={`${base}-casa-techo`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--p)" /><stop offset="1" stopColor="var(--pd)" /></linearGradient>
        <linearGradient id={`${base}-casa-pared`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffdf8" /><stop offset="1" stopColor="#f6ecdc" /></linearGradient>
      </defs>
      <ellipse cx="200" cy="338" rx="168" ry="15" fill="#2a2a24" opacity=".1" />
      <circle cx="326" cy="66" r="34" fill="#f2cc8f" /><circle cx="326" cy="66" r="52" fill="#f2cc8f" opacity=".22" />
      <rect x="84" y="156" width="232" height="168" rx="20" fill={`url(#${base}-casa-pared)`} />
      <path d="M62 170 200 66l138 104" stroke={`url(#${base}-casa-techo)`} strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="258" y="82" width="26" height="46" rx="6" fill="var(--pd)" />
      <rect x="176" y="224" width="48" height="100" rx="12" fill="#e07a5f" /><circle cx="212" cy="276" r="4" fill="#fff4e0" />
      <rect x="112" y="204" width="44" height="44" rx="10" fill="#ffe8a3" /><path d="M134 204v44M112 226h44" stroke="#f2cc8f" strokeWidth="3" />
      <rect x="244" y="204" width="44" height="44" rx="10" fill="#ffe8a3" /><path d="M266 204v44M244 226h44" stroke="#f2cc8f" strokeWidth="3" />
      <path d="M200 120c-9-9-24 2-14 14 6 8 14 13 14 13s8-5 14-13c10-12-5-23-14-14z" fill="#fff4e0" opacity=".95" />
      <g fill="var(--p)"><ellipse cx="70" cy="318" rx="11" ry="25" transform="rotate(-18 70 318)" /><ellipse cx="90" cy="320" rx="10" ry="22" transform="rotate(14 90 320)" /><ellipse cx="332" cy="318" rx="11" ry="25" transform="rotate(18 332 318)" /><ellipse cx="312" cy="320" rx="10" ry="22" transform="rotate(-14 312 320)" /></g>
    </svg>
  );
}

function HeroHogar({ base }: { base: string }) {
  return (
    <div className="relative mx-auto aspect-[1/0.95] w-full max-w-[32rem]">
      <Malla colores={["#f2cc8f", "var(--p)", "#e07a5f"]} intensidad={0.4} />
      <Casa base={base} className="absolute inset-0 size-full drop-shadow-[0_30px_40px_rgba(42,42,36,0.18)]" />
      <Vidrio className="absolute top-[6%] -left-[2%] hidden w-[12.6rem] @md:block">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[var(--p)] to-[var(--p2)] text-[var(--sobre)]"><HandHeart weight="duotone" className="size-5" /></span><div><p className="text-[0.78rem] font-bold">Encuentro de cuidadores</p><p className="text-[0.68rem] text-slate-500">Jueves · 6:00 p. m.</p></div></div>
      </Vidrio>
      <Vidrio retraso={-3} className="absolute right-[-3%] bottom-[-3%] hidden w-[12.4rem] @md:block">
        <div className="flex -space-x-2">{["Ana", "Luis", "Marta"].map((n) => <Avatar key={n} nombre={n} className="size-8 text-xs ring-2 ring-white" />)}</div>
        <p className="mt-2 flex items-center gap-1.5 text-[0.78rem] font-bold"><UsersThree weight="fill" className="size-4 text-[var(--p)]" /> Cuidadores que se acompañan</p>
      </Vidrio>
    </div>
  );
}

/** El arte principal de la plantilla. `base` hace únicos los identificadores de los degradados SVG si hay varios portales en la misma página. */
export function HeroArte({ id, base }: { id: PlantillaId; base: string }) {
  if (id === "belleza") return <HeroBelleza />;
  if (id === "motos-autos") return <HeroMotos base={base} />;
  if (id === "hogar-cuidado") return <HeroHogar base={base} />;
  return <HeroSalud />;
}
