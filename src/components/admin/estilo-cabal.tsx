import * as React from "react";
import type { LucideIcon } from "lucide-react";

/**
 * El estilo de las pantallas del panel (el de Análisis › Votaciones): un lienzo con manchas de color vivas, un encabezado en
 * degradado verde-agua con la etiqueta de la sección y los datos clave en tarjetas de colores. Se usa en TODAS las pantallas
 * para que el panel se vea de una pieza. Todo se adapta al ancho: el texto baja de tamaño, las tarjetas pasan de 4 a 2 columnas
 * y nada fuerza un ancho mayor que el de la pantalla (`min-w-0`).
 */

export function Lienzo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-border bg-surface p-3 shadow-xl shadow-emerald-900/5 sm:p-6 ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="cabal-blob absolute -top-24 -left-16 size-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="cabal-blob absolute -top-10 right-0 size-64 rounded-full bg-sky-400/20 blur-3xl [animation-delay:-4s]" />
        <div className="cabal-blob absolute bottom-0 left-1/3 size-80 rounded-full bg-amber-300/15 blur-3xl [animation-delay:-8s]" />
      </div>
      <div className="relative min-w-0 space-y-4 sm:space-y-5">{children}</div>
    </div>
  );
}

type PropsPortada = {
  icono: LucideIcon;
  /** La etiqueta de la sección, en mayúsculas: «Resultados oficiales», «Gestor documental»… */
  etiqueta: string;
  titulo: string;
  descripcion?: React.ReactNode;
  /** Chips o botones debajo de la descripción. */
  children?: React.ReactNode;
  /** A la derecha del título (botones de acción). */
  acciones?: React.ReactNode;
};

/** El encabezado en degradado de cada pantalla. */
export function Portada({ icono: Icono, etiqueta, titulo, descripcion, children, acciones }: PropsPortada) {
  return (
    <div className="relative z-10 rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-600 to-sky-600 p-4 text-white shadow-lg shadow-emerald-700/25 sm:p-5">
      {/* Los círculos van en su propia capa recortada: un desplegable dentro del encabezado debe poder salirse. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -right-10 -bottom-16 size-48 rounded-full bg-white/10" />
        <div className="absolute right-24 -top-12 size-28 rounded-full bg-amber-300/25 blur-xl" />
      </div>
      <div className="relative flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase backdrop-blur">
            <Icono className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{etiqueta}</span>
          </p>
          <h2 className="mt-2 text-xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-2xl">{titulo}</h2>
          {descripcion && <div className="mt-1 text-xs leading-relaxed text-white/85 sm:text-sm">{descripcion}</div>}
        </div>
        {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
      </div>
      {children && <div className="relative mt-3 flex min-w-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Un chip sobre el degradado de la portada. */
export function ChipPortada({ children, icono: Icono }: { children: React.ReactNode; icono?: LucideIcon }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
      {Icono && <Icono className="size-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

export type Tono = "esmeralda" | "cielo" | "ambar" | "fucsia";
const TONOS: Tono[] = ["esmeralda", "cielo", "ambar", "fucsia"];
const COLOR: Record<Tono, string> = {
  esmeralda: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
  cielo: "from-sky-500 to-indigo-600 shadow-sky-500/30",
  ambar: "from-amber-400 to-orange-600 shadow-orange-500/30",
  fucsia: "from-fuchsia-500 to-rose-600 shadow-rose-500/30",
};

export type ItemKpi = { etiqueta: string; valor: React.ReactNode; detalle?: React.ReactNode; icono: LucideIcon; tono?: Tono };

/** Datos clave en tarjetas de colores: 2 columnas en el celular, hasta 4 en pantallas anchas. */
export function Kpis({ items, columnas = 4 }: { items: ItemKpi[]; columnas?: 2 | 3 | 4 }) {
  const cols = columnas === 2 ? "grid-cols-2" : columnas === 3 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid gap-2.5 sm:gap-3 ${cols}`}>
      {items.map((k, i) => {
        const Icono = k.icono;
        return (
          <div key={`${k.etiqueta}-${i}`} className={`cabal-rise group relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br ${COLOR[k.tono ?? TONOS[i % TONOS.length]]} p-3.5 text-white shadow-lg transition-transform duration-300 hover:-translate-y-1 sm:p-4`} style={{ animationDelay: `${i * 70}ms` }}>
            <div aria-hidden="true" className="absolute -right-6 -bottom-8 size-24 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-125" />
            <div className="relative flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-medium text-white/85">{k.etiqueta}</p>
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur"><Icono className="size-4" aria-hidden="true" /></span>
            </div>
            <p className="relative mt-2 text-xl font-bold tabular-nums sm:text-2xl">{k.valor}</p>
            {k.detalle && <p className="relative line-clamp-2 text-[11px] text-white/80">{k.detalle}</p>}
          </div>
        );
      })}
    </div>
  );
}
