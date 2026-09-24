"use client";

import * as React from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  Percent,
  Shield,
  TriangleAlert,
  Vote,
} from "lucide-react";

import { heatColor } from "@/components/admin/colombia-heatmap";
import { normalizePlaceName } from "@/lib/electoral-places";
import type {
  CabalNivel,
  ElectoralArea,
  ElectoralMesa,
  ElectoralPuesto,
} from "@/lib/gov-data/cabal-electoral";
import { CabalMap } from "./cabal-map";

type Year = 2018 | 2022;
type Pais = Extract<CabalNivel, { nivel: "pais" }>;
type Departamento = Extract<CabalNivel, { nivel: "departamento" }>;
type Puestos = Extract<CabalNivel, { nivel: "municipio" | "zona" }>;
type Mesas = Extract<CabalNivel, { nivel: "puesto" }>;

const fmt = (n: number) => n.toLocaleString("es-CO");
const share = (part: number, total: number) =>
  total > 0
    ? `${((part / total) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`
    : "";

/** Paleta de las tarjetas: cada KPI con su color, de izquierda a derecha. */
const KPI_STYLES = [
  {
    icon: Vote,
    card: "from-emerald-500 to-teal-600",
    glow: "shadow-emerald-500/30",
  },
  {
    icon: Building2,
    card: "from-sky-500 to-indigo-600",
    glow: "shadow-sky-500/30",
  },
  {
    icon: MapPin,
    card: "from-amber-400 to-orange-600",
    glow: "shadow-orange-500/30",
  },
  {
    icon: Percent,
    card: "from-fuchsia-500 to-rose-600",
    glow: "shadow-rose-500/30",
  },
];

/** Medallas para los tres primeros lugares de cada lista. */
const RANK_STYLES = [
  "bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950",
  "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900",
  "bg-gradient-to-br from-orange-300 to-amber-700 text-orange-950",
];

const apiUrl = (year: Year, nivel: string, id = "") =>
  `/api/admin/cabal-resultados?${new URLSearchParams({ year: String(year), nivel, id })}`;

/** Carga ligada a la URL: si la selección cambia antes de responder, la respuesta vieja se ignora. */
function useApi<T>(url: string | null) {
  const [state, setState] = React.useState<{
    url: string;
    data?: T;
    error?: string;
  } | null>(null);
  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok)
          throw new Error(body.error ?? "No fue posible cargar los datos.");
        return body as T;
      })
      .then(
        (data) => !cancelled && setState({ url, data }),
        (err: Error) => !cancelled && setState({ url, error: err.message }),
      );
    return () => {
      cancelled = true;
    };
  }, [url]);
  const current = state?.url === url ? state : null;
  return {
    data: current?.data,
    error: current?.error,
    loading: Boolean(url) && !current,
  };
}

/** Clave estable entre años (los ids de 2018 y 2022 son distintos): código del mapa o nombre. */
const areaKey = (a: ElectoralArea) => a.geo ?? normalizePlaceName(a.name);

/** Texto oscuro o claro según el fondo del mapa de calor. */
function textOn(rgb: string) {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0a0a0c" : "#ffffff";
}

function AreaList({
  areas,
  mesasLabel,
  onSelect,
}: {
  areas: ElectoralArea[];
  mesasLabel: string;
  onSelect: (a: ElectoralArea) => void;
}) {
  const sorted = [...areas].sort((a, b) => b.votos - a.votos);
  const total = sorted.reduce((acc, a) => acc + a.votos, 0);
  const max = Math.max(1, sorted[0]?.votos ?? 0);
  return (
    <ul className="space-y-1.5 p-2">
      {sorted.map((a, i) => (
        <li
          key={a.id}
          className="cabal-rise"
          style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}
        >
          <button
            type="button"
            onClick={() => onSelect(a)}
            className="group w-full rounded-xl border border-transparent bg-surface px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400/40 hover:bg-gradient-to-r hover:from-emerald-500/10 hover:via-sky-500/5 hover:to-transparent hover:shadow-lg hover:shadow-emerald-500/10"
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${RANK_STYLES[i] ?? "bg-surface-muted text-muted-foreground"}`}
                >
                  {i + 1}
                </span>
                <span className="truncate font-medium transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                  {a.name}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{fmt(a.votos)}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  {share(a.votos, total)}
                </span>
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/60">
                <div
                  className="cabal-bar h-full rounded-full"
                  style={{
                    width: `${(a.votos / max) * 100}%`,
                    background: `linear-gradient(90deg, ${heatColor(0.35)}, ${heatColor(Math.max(0.5, Math.sqrt(a.votos / max)))}${i === 0 ? ", #f59e0b" : ""})`,
                  }}
                />
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {fmt(a.mesas)} {mesasLabel}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MesasGrid({ year, puesto }: { year: Year; puesto: ElectoralPuesto }) {
  const [attempt, setAttempt] = React.useState(0);
  const { data, error, loading } = useApi<Mesas>(
    apiUrl(year, "puesto", puesto.id) + (attempt ? `&intento=${attempt}` : ""),
  );
  if (loading) {
    return (
      <p className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        {year === 2022
          ? `Consultando ${fmt(puesto.mesas)} mesas en la Registraduría...`
          : "Cargando mesas..."}
      </p>
    );
  }
  if (error || !data) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-3 py-3 text-xs">
        <span className="text-red-600">{error}</span>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="rounded-full border border-border px-2.5 py-0.5 font-medium hover:bg-surface-muted"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const max = Math.max(1, ...data.mesas.map((m: ElectoralMesa) => m.votos));
  return (
    <div className="px-3 pb-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5">
        {data.mesas.map((m) => {
          const bg = heatColor(m.votos > 0 ? Math.sqrt(m.votos / max) : 0);
          return (
            <div
              key={m.mesa}
              className="rounded-lg px-1 py-1 text-center shadow-sm transition-transform duration-150 hover:scale-110 hover:shadow-md"
              style={{ backgroundColor: bg, color: textOn(bg) }}
              title={`Mesa ${m.mesa}: ${fmt(m.votos)} votos`}
            >
              <div className="text-[10px] opacity-75">Mesa {m.mesa}</div>
              <div className="text-sm font-semibold tabular-nums">
                {fmt(m.votos)}
              </div>
            </div>
          );
        })}
      </div>
      {year === 2018 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          El dataset de 2018 solo trae las mesas donde obtuvo votos.
        </p>
      )}
    </div>
  );
}

function PuestosTable({
  year,
  puestos,
}: {
  year: Year;
  puestos: ElectoralPuesto[];
}) {
  const [filter, setFilter] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);
  const visible = [...puestos]
    .sort((a, b) => b.votos - a.votos)
    .filter((p) =>
      normalizePlaceName(`${p.name} ${p.zona}`).includes(
        normalizePlaceName(filter),
      ),
    );

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          {fmt(puestos.length)} puestos · clic en uno para ver sus mesas
        </p>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar puesto"
          className="w-40 rounded-full border border-border bg-surface px-3 py-1 text-xs outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
        />
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {visible.map((p) => {
          const isOpen = open === p.id;
          const Icon = isOpen ? ChevronDown : ChevronRight;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : p.id)}
                aria-expanded={isOpen}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-500/5 ${isOpen ? "bg-emerald-500/10" : ""}`}
              >
                <Icon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="w-12 shrink-0 text-xs text-muted-foreground">
                  Zona {p.zona}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmt(p.mesas)} mesas
                </span>
                <span className="w-16 shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {fmt(p.votos)}
                </span>
              </button>
              {isOpen && <MesasGrid year={year} puesto={p} />}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">
            Sin puestos.
          </li>
        )}
      </ul>
    </div>
  );
}

function Loading() {
  return (
    <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando...
    </p>
  );
}

export function CabalResultados() {
  const [year, setYear] = React.useState<Year>(2022);
  // La selección se guarda por clave (código del mapa o nombre) para
  // conservarla al cambiar de año.
  const [deptKey, setDeptKey] = React.useState<string | null>(null);
  const [placeKey, setPlaceKey] = React.useState<string | null>(null);

  const pais = useApi<Pais>(apiUrl(year, "pais"));
  const dept = pais.data?.areas.find((a) => areaKey(a) === deptKey) ?? null;
  const deptData = useApi<Departamento>(
    dept ? apiUrl(year, "departamento", dept.id) : null,
  );
  const place =
    deptData.data?.areas.find((a) => areaKey(a) === placeKey) ?? null;
  const puestos = useApi<Puestos>(
    place
      ? apiUrl(
          year,
          deptData.data?.tipo === "localidades" ? "zona" : "municipio",
          place.id,
        )
      : null,
  );

  const mesasLabel = pais.data?.mesasLabel ?? "mesas";
  const nationalTotal =
    pais.data?.areas.reduce((acc, a) => acc + a.votos, 0) ?? 0;
  const error = pais.error ?? deptData.error ?? puestos.error;

  const selectDept = (a: ElectoralArea) => {
    setDeptKey(areaKey(a));
    setPlaceKey(null);
  };
  const goHome = () => {
    setDeptKey(null);
    setPlaceKey(null);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-xl shadow-emerald-900/5 sm:p-6">
      {/* Manchas de color de fondo, desenfocadas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-0"
      >
        <div className="cabal-blob absolute -top-24 -left-16 size-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="cabal-blob absolute -top-10 right-0 size-64 rounded-full bg-sky-400/20 blur-3xl [animation-delay:-4s]" />
        <div className="cabal-blob absolute bottom-0 left-1/3 size-80 rounded-full bg-amber-300/15 blur-3xl [animation-delay:-8s]" />
      </div>

      <div className="relative">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-600 to-sky-600 p-5 text-white shadow-lg shadow-emerald-700/25">
          <div
            aria-hidden="true"
            className="absolute -right-10 -bottom-16 size-48 rounded-full bg-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute right-24 -top-12 size-28 rounded-full bg-amber-300/25 blur-xl"
          />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase backdrop-blur">
                <Shield className="size-3.5" aria-hidden="true" />
                Senado de la República
              </p>
              <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                María Fernanda Cabal
              </p>
              <p className="mt-1 max-w-xl text-xs text-white/80">
                {pais.data?.fuente}
              </p>
            </div>
            <div className="flex rounded-full bg-white/15 p-1 text-sm backdrop-blur">
              {([2018, 2022] as const).map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={
                    y === year
                      ? "rounded-full bg-white px-4 py-1 font-semibold text-emerald-800 shadow-md transition-all"
                      : "rounded-full px-4 py-1 text-white/80 transition-all hover:bg-white/10 hover:text-white"
                  }
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        {pais.data?.nota && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-orange-400/5 p-3 text-xs text-amber-800 dark:text-amber-300">
            <TriangleAlert
              className="mt-0.5 size-3.5 shrink-0"
              aria-hidden="true"
            />
            {pais.data.nota}
          </p>
        )}

        {pais.data && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {pais.data.kpis.map((k, i) => {
              const style = KPI_STYLES[i % KPI_STYLES.length];
              const Icon = style.icon;
              return (
                <div
                  key={`${year}-${k.label}`}
                  className={`cabal-rise group relative overflow-hidden rounded-2xl bg-gradient-to-br ${style.card} p-4 text-white shadow-lg ${style.glow} transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02]`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute -right-6 -bottom-8 size-24 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-125"
                  />
                  <div className="relative flex items-center justify-between">
                    <p className="text-xs font-medium text-white/85">
                      {k.label}
                    </p>
                    <span className="grid size-8 place-items-center rounded-xl bg-white/20 backdrop-blur">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="relative mt-2 text-2xl font-bold tabular-nums">
                    {k.value}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[520px] rounded-2xl bg-gradient-to-b from-sky-500/5 to-emerald-500/10 p-3 ring-1 ring-border/60">
            <CabalMap
              dept={dept?.geo ?? null}
              areas={
                dept?.geo
                  ? (deptData.data?.areas ?? [])
                  : (pais.data?.areas ?? [])
              }
              selectedId={place?.id}
              loading={pais.loading || deptData.loading}
              onSelect={(a) => {
                if (!dept) {
                  const area = pais.data?.areas.find((x) => x.id === a.id);
                  if (area) selectDept(area);
                } else {
                  const area = deptData.data?.areas.find((x) => x.id === a.id);
                  if (area) setPlaceKey(areaKey(area));
                }
              }}
              onBack={goHome}
              onOpenBogota={() => {
                setDeptKey("11");
                setPlaceKey(null);
              }}
            />
            {dept && !dept.geo && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Votos en el exterior: no se ubican en el mapa.
              </p>
            )}
          </div>

          <div className="min-w-0">
            <nav
              aria-label="Nivel"
              className="flex flex-wrap items-center gap-1 text-sm"
            >
              <button
                type="button"
                onClick={goHome}
                className={
                  dept
                    ? "rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                    : "rounded-full bg-emerald-600 px-2.5 py-0.5 font-semibold text-white"
                }
              >
                Colombia
              </button>
              {dept && (
                <>
                  <ChevronRight
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => setPlaceKey(null)}
                    className={
                      place
                        ? "rounded-full bg-sky-500/10 px-2.5 py-0.5 text-sky-700 transition hover:bg-sky-500/20 dark:text-sky-300"
                        : "rounded-full bg-sky-600 px-2.5 py-0.5 font-semibold text-white"
                    }
                  >
                    {dept.name}
                  </button>
                </>
              )}
              {place && (
                <>
                  <ChevronRight
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 font-semibold text-white">
                    {place.name}
                  </span>
                </>
              )}
            </nav>
            <p className="mt-2 text-xs text-muted-foreground">
              {place
                ? `${fmt(place.votos)} votos · ${share(place.votos, dept?.votos ?? 0)} de ${dept?.name}`
                : dept
                  ? `${fmt(dept.votos)} votos · ${share(dept.votos, nationalTotal)} del total · elige ${deptData.data?.tipo === "localidades" ? "una localidad" : "un municipio"}`
                  : "Elige un departamento en el mapa o en la lista."}
            </p>

            <div className="mt-3 max-h-[620px] overflow-y-auto rounded-2xl border border-border bg-surface-muted/40">
              {place ? (
                puestos.data ? (
                  <PuestosTable
                    key={`${year}-${place.id}`}
                    year={year}
                    puestos={puestos.data.puestos}
                  />
                ) : (
                  <Loading />
                )
              ) : dept ? (
                deptData.data ? (
                  <AreaList
                    areas={deptData.data.areas}
                    mesasLabel={mesasLabel}
                    onSelect={(a) => setPlaceKey(areaKey(a))}
                  />
                ) : (
                  <Loading />
                )
              ) : pais.data ? (
                <AreaList
                  areas={pais.data.areas}
                  mesasLabel={mesasLabel}
                  onSelect={selectDept}
                />
              ) : (
                <Loading />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
