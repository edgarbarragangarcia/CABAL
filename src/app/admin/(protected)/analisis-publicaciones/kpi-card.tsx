import type { LucideIcon } from "lucide-react";

/** Tarjeta de color con icono, la misma de Red Cabal, Votaciones y Avales. */
export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  card,
  glow,
  delay,
}: {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  card: string;
  glow: string;
  delay: number;
}) {
  return (
    <div
      className={`cabal-rise group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card} p-4 text-white shadow-lg ${glow} transition-transform duration-300 hover:-translate-y-1`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        aria-hidden="true"
        className="absolute -right-6 -bottom-8 size-24 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-125"
      />
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-white/85">{label}</p>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="relative mt-2 text-2xl font-bold">{value}</p>
      <p className="relative text-[11px] text-white/80">{sub}</p>
    </div>
  );
}
