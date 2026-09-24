"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Loader2, Shield, TriangleAlert } from "lucide-react";

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
  total > 0 ? `${((part / total) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%` : "";

const apiUrl = (year: Year, nivel: string, id = "") =>
  `/api/admin/cabal-resultados?${new URLSearchParams({ year: String(year), nivel, id })}`;

/** Carga ligada a la URL: si la selección cambia antes de responder, la respuesta vieja se ignora. */
function useApi<T>(url: string | null) {
  const [state, setState] = React.useState<{ url: string; data?: T; error?: string } | null>(null);
  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "No fue posible cargar los datos.");
        return body as T;
      })
      .then(
        (data) => !cancelled && setState({ url, data }),
        (err: Error) => !cancelled && setState({ url, error: err.message })
      );
    return () => {
      cancelled = true;
    };
  }, [url]);
  const current = state?.url === url ? state : null;
  return { data: current?.data, error: current?.error, loading: Boolean(url) && !current };
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
    <ul className="divide-y divide-border">
      {sorted.map((a) => (
        <li key={a.id}>
          <button
            type="button"
            onClick={() => onSelect(a)}
            className="w-full px-3 py-2 text-left hover:bg-surface-muted"
          >
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{a.name}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{fmt(a.votos)}</span>{" "}
                <span className="text-xs text-muted-foreground">{share(a.votos, total)}</span>
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(a.votos / max) * 100}%`,
                    backgroundColor: heatColor(Math.max(0.35, Math.sqrt(a.votos / max))),
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
    apiUrl(year, "puesto", puesto.id) + (attempt ? `&intento=${attempt}` : "")
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
              className="rounded-md px-1 py-1 text-center"
              style={{ backgroundColor: bg, color: textOn(bg) }}
              title={`Mesa ${m.mesa}: ${fmt(m.votos)} votos`}
            >
              <div className="text-[10px] opacity-75">Mesa {m.mesa}</div>
              <div className="text-sm font-semibold tabular-nums">{fmt(m.votos)}</div>
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

function PuestosTable({ year, puestos }: { year: Year; puestos: ElectoralPuesto[] }) {
  const [filter, setFilter] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);
  const visible = [...puestos]
    .sort((a, b) => b.votos - a.votos)
    .filter((p) => normalizePlaceName(`${p.name} ${p.zona}`).includes(normalizePlaceName(filter)));

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
          className="w-40 rounded-full border border-border bg-transparent px-3 py-1 text-xs"
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
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted ${isOpen ? "bg-surface-muted" : ""}`}
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="w-12 shrink-0 text-xs text-muted-foreground">Zona {p.zona}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{fmt(p.mesas)} mesas</span>
                <span className="w-14 shrink-0 text-right font-semibold tabular-nums">
                  {fmt(p.votos)}
                </span>
              </button>
              {isOpen && <MesasGrid year={year} puesto={p} />}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-muted-foreground">Sin puestos.</li>
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
  const deptData = useApi<Departamento>(dept ? apiUrl(year, "departamento", dept.id) : null);
  const place = deptData.data?.areas.find((a) => areaKey(a) === placeKey) ?? null;
  const puestos = useApi<Puestos>(
    place
      ? apiUrl(year, deptData.data?.tipo === "localidades" ? "zona" : "municipio", place.id)
      : null
  );

  const mesasLabel = pais.data?.mesasLabel ?? "mesas";
  const nationalTotal = pais.data?.areas.reduce((acc, a) => acc + a.votos, 0) ?? 0;
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
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="size-4 text-brand" aria-hidden="true" />
            María Fernanda Cabal — resultados al Senado
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{pais.data?.fuente}</p>
        </div>
        <div className="flex rounded-full border border-border p-0.5 text-sm">
          {([2018, 2022] as const).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={
                y === year
                  ? "rounded-full bg-brand px-4 py-1 font-semibold text-white"
                  : "rounded-full px-4 py-1 text-muted-foreground hover:text-foreground"
              }
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {pais.data?.nota && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {pais.data.nota}
        </p>
      )}

      {pais.data && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {pais.data.kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[520px]">
          <CabalMap
            dept={dept?.geo ?? null}
            areas={dept?.geo ? (deptData.data?.areas ?? []) : (pais.data?.areas ?? [])}
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
          <nav aria-label="Nivel" className="flex flex-wrap items-center gap-1 text-sm">
            <button
              type="button"
              onClick={goHome}
              className={dept ? "text-brand hover:underline" : "font-semibold"}
            >
              Colombia
            </button>
            {dept && (
              <>
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setPlaceKey(null)}
                  className={place ? "text-brand hover:underline" : "font-semibold"}
                >
                  {dept.name}
                </button>
              </>
            )}
            {place && (
              <>
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="font-semibold">{place.name}</span>
              </>
            )}
          </nav>
          <p className="mt-1 text-xs text-muted-foreground">
            {place
              ? `${fmt(place.votos)} votos · ${share(place.votos, dept?.votos ?? 0)} de ${dept?.name}`
              : dept
                ? `${fmt(dept.votos)} votos · ${share(dept.votos, nationalTotal)} del total · elige ${deptData.data?.tipo === "localidades" ? "una localidad" : "un municipio"}`
                : "Elige un departamento en el mapa o en la lista."}
          </p>

          <div className="mt-3 max-h-[620px] overflow-y-auto rounded-xl border border-border">
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
              <AreaList areas={pais.data.areas} mesasLabel={mesasLabel} onSelect={selectDept} />
            ) : (
              <Loading />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
