import * as React from "react";
import {
  Baby,
  Brain,
  Broom,
  Car,
  ClipboardText,
  FirstAid,
  Flask,
  Flower,
  Gear,
  Hand,
  HandHeart,
  Heartbeat,
  HouseLine,
  Motorcycle,
  PaintBrush,
  PaintBucket,
  PersonSimpleWalk,
  Scissors,
  ShieldCheck,
  Sparkle,
  Star,
  Stethoscope,
  Tire,
  Tooth,
  VideoCamera,
  Wheelchair,
  Wrench,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps } from "@phosphor-icons/react";

/**
 * Piezas visuales compartidas por las plantillas de portales: íconos por identificador, malla de color, tarjetas de vidrio y
 * maqueta de celular. Todo es presentacional (sin estado ni hooks) para que sirva igual en el servidor y en el cliente.
 */

const ICONOS: Record<string, Icon> = {
  stethoscope: Stethoscope, heartbeat: Heartbeat, flask: Flask, brain: Brain, tooth: Tooth, video: VideoCamera,
  scissors: Scissors, razor: Star, hand: Hand, brush: PaintBrush, flower: Flower, sparkle: Sparkle,
  wrench: Wrench, paint: PaintBucket, tire: Tire, clipboard: ClipboardText, shield: ShieldCheck, gear: Gear, car: Car, moto: Motorcycle,
  house: HouseLine, wheelchair: Wheelchair, firstaid: FirstAid, handheart: HandHeart, walk: PersonSimpleWalk, baby: Baby, broom: Broom,
};

/** Ícono por identificador (los datos de la plantilla no importan React). Es un componente de nivel superior: no se crea al renderizar. */
export const Ic = ({ id, ...p }: { id: string } & IconProps) => React.createElement(ICONOS[id] ?? Sparkle, p);

export const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase();

/** Avatar de iniciales en degradado de la marca (no hay fotos de personas: son ejemplos). */
export function Avatar({ nombre, className = "size-9 text-xs" }: { nombre: string; className?: string }) {
  return <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--p)] to-[var(--p2)] font-bold text-[var(--sobre)] ${className}`}>{iniciales(nombre)}</span>;
}

/**
 * Fondo de malla: manchas de color muy difuminadas más un grano fino. Va detrás del contenido. Por defecto se desvanece hacia
 * los bordes (máscara elíptica) para que no se note la caja; con `lleno` rellena su contenedor y lo recorta el padre.
 */
export function Malla({ colores, className = "", intensidad = 0.55, lleno = false }: { colores: string[]; className?: string; intensidad?: number; lleno?: boolean }) {
  const sitios = [{ l: "-4%", t: "4%", w: "62%" }, { l: "46%", t: "-6%", w: "56%" }, { l: "22%", t: "46%", w: "64%" }];
  const caja = lleno ? "-inset-[12%] overflow-hidden" : "-inset-[20%] [mask-image:radial-gradient(closest-side,#000_40%,transparent)]";
  return (
    <div aria-hidden className={`pointer-events-none absolute -z-10 ${caja} ${className}`}>
      {colores.slice(0, 3).map((c, i) => (
        <span key={i} className="absolute aspect-square rounded-full blur-[70px]" style={{ background: c, opacity: intensidad, left: sitios[i].l, top: sitios[i].t, width: sitios[i].w }} />
      ))}
      <div className="bg-grain absolute inset-0 opacity-[0.1] mix-blend-overlay" />
    </div>
  );
}

/** Tarjeta de vidrio (translúcida y desenfocada): para los avisos que «flotan» junto a la maqueta. */
export function Vidrio({ children, className = "", oscuro = false, retraso = 0 }: { children: React.ReactNode; className?: string; oscuro?: boolean; retraso?: number }) {
  return (
    <div style={{ animationDelay: `${retraso}s` }} className={`rounded-2xl border p-3.5 backdrop-blur-xl motion-safe:animate-float-y ${oscuro ? "border-white/12 bg-[#11151c]/70 text-white shadow-[0_28px_60px_-24px_rgba(0,0,0,0.8)]" : "border-white/80 bg-white/75 text-[#0f172a] shadow-[0_28px_60px_-26px_rgba(15,23,42,0.45)]"} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Maqueta de celular: marco, isla y pantalla. El contenido es una pantalla de ejemplo (decorativa). El `className` va en el
 * envoltorio (posición, giro, escala); el marco lleva su propio `relative` para no pelear con un `absolute` de quien lo use.
 */
export function Telefono({ children, className = "", oscuro = false }: { children: React.ReactNode; className?: string; oscuro?: boolean }) {
  return (
    <div aria-hidden className={`w-[15.5rem] shrink-0 ${className}`}>
      <div className={`relative rounded-[2.75rem] p-2 shadow-[0_60px_100px_-40px_rgba(6,10,22,0.75),0_24px_40px_-24px_rgba(6,10,22,0.55)] ring-1 ${oscuro ? "bg-[#202734] ring-white/15" : "bg-[#0d1220] ring-black/30"}`}>
        <span className="absolute top-[0.9rem] left-1/2 z-10 h-[1.1rem] w-[4.4rem] -translate-x-1/2 rounded-full bg-black" />
        <span className={`absolute top-24 -right-[3px] h-14 w-[3px] rounded-r ${oscuro ? "bg-[#2e3748]" : "bg-[#222a3d]"}`} />
        <div className={`relative h-[31rem] overflow-hidden rounded-[2.3rem] ${oscuro ? "bg-[#0e1218] text-white" : "bg-white text-[#0f172a]"}`}>{children}</div>
      </div>
    </div>
  );
}

/** Negro o blanco según el color de fondo, para que el texto sobre el color de marca siempre se lea. */
export function textoSobre(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "#111827" : "#ffffff";
}
