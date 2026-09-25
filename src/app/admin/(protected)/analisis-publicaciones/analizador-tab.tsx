"use client";

import * as React from "react";
import { CalendarDays, Flag, GripVertical, Landmark, Loader2, MapPin, MousePointerClick, Sparkles, X } from "lucide-react";

import { ELECCIONES, NIVELES } from "@/lib/gov-data/elecciones/catalogo";
import type { VistaElectoral } from "@/lib/gov-data/elecciones/resultados";
import { LogoPartido } from "./candidato-ui";
import { titulo } from "./nombres";

/**
 * Analizador electoral en lienzo: se arrastran tarjetas (año, cargo,
 * territorios hasta la mesa, partido) y el lienzo muestra el resultado
 * oficial de esa combinación. Mismos datos que el explorador (preconteo de
 * la Registraduría). Cada tarjeta también se puede agregar con un clic.
 */

const fmt = (n: number) => n.toLocaleString("es-CO");
const ANIOS = [...new Set(ELECCIONES.map((e) => e.fecha.slice(0, 4)))];

type Tarjeta =
  | { tipo: "anio"; anio: string }
  | { tipo: "cargo"; eleccion: string; sigla: string; nombre: string }
  | { tipo: "territorio"; codigo: string; nombre: string; nivel: number }
  | { tipo: "partido"; codigo: string; nombre: string; color: string };

const ESTILO: Record<Tarjeta["tipo"], { icono: React.ElementType; clase: string; etiqueta: string }> = {
  anio: { icono: CalendarDays, clase: "from-emerald-500 to-teal-600", etiqueta: "Año" },
  cargo: { icono: Landmark, clase: "from-sky-500 to-indigo-600", etiqueta: "Cargo" },
  territorio: { icono: MapPin, clase: "from-amber-400 to-orange-600", etiqueta: "Territorio" },
  partido: { icono: Flag, clase: "from-fuchsia-500 to-rose-600", etiqueta: "Partido" },
};

function useVista(url: string | null) {
  const [state, setState] = React.useState<{ url: string; vista?: VistaElectoral; error?: string } | null>(null);
  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        if (!cancelled) setState({ url, vista: body as VistaElectoral });
      })
      .catch((err: Error) => !cancelled && setState({ url, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  const actual = url && state?.url === url ? state : null;
  return { vista: actual?.vista, error: actual?.error, loading: !!url && !actual };
}

function Chip({ t, onAdd }: { t: Tarjeta; onAdd: (t: Tarjeta) => void }) {
  const e = ESTILO[t.tipo];
  const Icon = e.icono;
  const texto = t.tipo === "anio" ? t.anio : titulo(t.nombre);
  return (
    <button
      type="button"
      draggable
      onDragStart={(ev) => ev.dataTransfer.setData("application/json", JSON.stringify(t))}
      onClick={() => onAdd(t)}
      title="Arrástrala al lienzo o haz clic"
      className={`inline-flex cursor-grab items-center gap-1.5 rounded-xl bg-gradient-to-br ${e.clase} px-3 py-2 text-left text-xs font-semibold text-white shadow-md transition hover:-translate-y-0.5 active:cursor-grabbing`}
    >
      <GripVertical className="size-3.5 opacity-70" aria-hidden="true" />
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="max-w-[14rem] truncate">{texto}</span>
    </button>
  );
}

/** Markdown mínimo del análisis: títulos, viñetas y párrafos. */
function Markdown({ texto }: { texto: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {texto.split("\n").map((l, i) => {
        const t = l.trim();
        if (!t) return null;
        const limpio = t.replace(/\*\*(.+?)\*\*/g, "$1");
        if (t.startsWith("#")) return <p key={i} className="pt-2 font-semibold text-foreground">{limpio.replace(/^#+\s*/, "")}</p>;
        if (/^[-*•]\s/.test(t)) return <p key={i} className="pl-4 before:-ml-3 before:mr-1.5 before:content-['•']">{limpio.replace(/^[-*•]\s/, "")}</p>;
        return <p key={i} className="text-muted-foreground">{limpio}</p>;
      })}
    </div>
  );
}

function AnalisisIA({ params, nombre }: { params: Record<string, string>; nombre: string }) {
  const [estado, setEstado] = React.useState<{ texto?: string; error?: string; cargando?: boolean }>({});
  const analizar = () => {
    setEstado({ cargando: true });
    fetch("/api/admin/elecciones/analisis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        setEstado({ texto: body.analisis });
      })
      .catch((err: Error) => setEstado({ error: err.message }));
  };
  return (
    <div className="rounded-2xl border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500/5 via-surface to-sky-500/5 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Análisis de {titulo(nombre)}</p>
        <button
          type="button"
          onClick={analizar}
          disabled={estado.cargando}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-600 to-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-60"
        >
          {estado.cargando ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
          {estado.texto ? "Volver a analizar" : "Analizar con IA"}
        </button>
      </div>
      {estado.cargando && (
        <p className="mt-3 text-xs text-muted-foreground">Consultando sus votos en cada territorio y preparando el análisis (puede tardar hasta un minuto)…</p>
      )}
      {estado.error && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{estado.error}</p>}
      {estado.texto && (
        <div className="mt-3">
          <Markdown texto={estado.texto} />
          <p className="mt-3 text-[11px] text-muted-foreground">Generado con IA a partir del preconteo oficial. Revisa las cifras antes de decidir.</p>
        </div>
      )}
    </div>
  );
}

export function AnalizadorTab() {
  const [anio, setAnio] = React.useState<string | null>(null);
  const [cargo, setCargo] = React.useState<{ eleccion: string; sigla: string; nombre: string } | null>(null);
  const [ruta, setRuta] = React.useState<{ codigo: string; nombre: string; nivel: number }[]>([]);
  const [partido, setPartido] = React.useState<{ codigo: string; nombre: string; color: string } | null>(null);
  const [sobre, setSobre] = React.useState(false);
  const [filtro, setFiltro] = React.useState("");
  const [candSel, setCandSel] = React.useState<{ url: string; codigo: string; nombre: string } | null>(null);

  const ambito = ruta.at(-1)?.codigo;
  const url = cargo
    ? `/api/admin/elecciones?${new URLSearchParams({ v: "3", e: cargo.eleccion, c: cargo.sigla, ...(ambito ? { a: ambito } : {}) })}`
    : null;
  const { vista, error, loading } = useVista(url);
  const circ = vista?.resultado?.circunscripciones[0];

  const agregar = (t: Tarjeta) => {
    setFiltro("");
    if (t.tipo === "anio") {
      setAnio(t.anio);
      setCargo(null);
      setRuta([]);
      setPartido(null);
    } else if (t.tipo === "cargo") {
      setCargo(t);
      setRuta([]);
      setPartido(null);
    } else if (t.tipo === "territorio") setRuta((r) => [...r, t]);
    else setPartido(t);
  };
  const quitar = (t: Tarjeta, i?: number) => {
    if (t.tipo === "anio" || t.tipo === "cargo") {
      if (t.tipo === "anio") setAnio(null);
      setCargo(null);
      setRuta([]);
      setPartido(null);
    } else if (t.tipo === "territorio") setRuta((r) => r.slice(0, i));
    else setPartido(null);
  };

  // Tarjetas disponibles: lo siguiente que tiene sentido agregar.
  const q = filtro.trim().toLowerCase();
  const disponibles: Tarjeta[] = !anio
    ? ANIOS.map((a) => ({ tipo: "anio", anio: a }))
    : !cargo
      ? ELECCIONES.filter((e) => e.fecha.startsWith(anio)).flatMap((e) =>
          e.corporaciones.map((c) => ({
            tipo: "cargo" as const,
            eleccion: e.id,
            sigla: c.sigla,
            nombre: c.sigla === "PR" ? e.nombre : c.nombre,
          }))
        )
      : [
          ...(vista?.hijos ?? [])
            .filter((h) => h.nombre.toLowerCase().includes(q))
            .slice(0, 60)
            .map((h) => ({ tipo: "territorio" as const, codigo: h.codigo, nombre: h.nombre, nivel: h.nivel })),
          ...(partido ? [] : (circ?.partidos ?? []))
            .filter((p) => p.votos > 0 && p.nombre.toLowerCase().includes(q))
            .sort((a, b) => b.votos - a.votos)
            .slice(0, 30)
            .map((p) => ({ tipo: "partido" as const, codigo: p.codigo, nombre: p.nombre, color: p.color })),
        ];

  const puestas: Tarjeta[] = [
    ...(anio ? [{ tipo: "anio" as const, anio }] : []),
    ...(cargo ? [{ tipo: "cargo" as const, ...cargo }] : []),
    ...ruta.map((r) => ({ tipo: "territorio" as const, ...r })),
    ...(partido ? [{ tipo: "partido" as const, ...partido }] : []),
  ];

  const p = partido ? circ?.partidos.find((x) => x.codigo === partido.codigo) : undefined;
  const partidos = [...(circ?.partidos ?? [])].filter((x) => x.votos > 0).sort((a, b) => b.votos - a.votos);
  const max = Math.max(1, partidos[0]?.votos ?? 0);
  const lugar = ruta.length ? titulo(ruta.at(-1)!.nombre) : "todo el país";
  // Candidato elegido para el análisis: vale para el territorio y partido en que se eligió.
  const elegido = candSel && candSel.url === url && p?.candidatos.some((x) => x.codigo === candSel.codigo) ? candSel : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarjetas</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {!anio
            ? "Empieza por el año."
            : !cargo
              ? "Ahora el cargo."
              : vista && vista.hijos.length === 0
                ? `Llegaste a ${lugar}: aquí solo queda elegir un partido.`
                : `${NIVELES[vista?.hijos[0]?.nivel ?? 2] ?? "Territorio"}s y partidos de ${lugar}.`}
        </p>
        {cargo && (vista?.hijos.length ?? 0) > 8 && (
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar tarjeta"
            className="mt-3 w-full rounded-full border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
          />
        )}
        <div className="mt-3 flex max-h-[560px] flex-wrap gap-2 overflow-y-auto">
          {loading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Consultando la Registraduría...
            </p>
          )}
          {!loading && disponibles.map((t, i) => <Chip key={i} t={t} onAdd={agregar} />)}
        </div>
      </aside>

      <section
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          try {
            agregar(JSON.parse(e.dataTransfer.getData("application/json")) as Tarjeta);
          } catch {
            // Lo soltado no era una tarjeta.
          }
        }}
        className={`min-h-[420px] rounded-2xl border-2 border-dashed p-4 transition ${
          sobre ? "border-emerald-500 bg-emerald-500/5" : "border-border bg-surface-muted/40"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {puestas.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MousePointerClick className="size-4" aria-hidden="true" /> Arrastra tarjetas aquí: año, cargo, territorios hasta la
              mesa y un partido.
            </p>
          )}
          {puestas.map((t, i) => {
            const e = ESTILO[t.tipo];
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br ${e.clase} px-3 py-1.5 text-xs font-semibold text-white shadow`}
              >
                <span className="opacity-75">{t.tipo === "territorio" ? NIVELES[t.nivel] : e.etiqueta}:</span>
                {t.tipo === "anio" ? t.anio : titulo(t.nombre)}
                <button
                  type="button"
                  aria-label="Quitar"
                  onClick={() => quitar(t, t.tipo === "territorio" ? ruta.findIndex((r) => r.codigo === t.codigo) : undefined)}
                  className="rounded-full p-0.5 hover:bg-white/20"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm text-red-700 dark:text-red-300">{error}</p>}

        {vista?.resultado && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Votantes", fmt(vista.resultado.votantes)],
                ["Participación", vista.resultado.participacion || "—"],
                ["Mesas informadas", vista.resultado.mesas.pct || "—"],
                ...(p ? [["Votos del partido", `${fmt(p.votos)} · ${p.pct}`]] : [["Partidos con votos", fmt(partidos.length)]]),
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface p-3 shadow-sm ring-1 ring-border">
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                  <p className="text-lg font-bold tabular-nums">{v}</p>
                </div>
              ))}
            </div>

            {p && elegido && cargo && circ && (
              <AnalisisIA
                key={`${url}-${elegido.codigo}`}
                nombre={elegido.nombre}
                params={{ e: cargo.eleccion, c: cargo.sigla, a: ambito ?? "", circ: circ.codigo, p: p.codigo, k: elegido.codigo }}
              />
            )}
            {p && !elegido && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-fuchsia-600" aria-hidden="true" /> Toca un candidato para analizar sus votos en {lugar} con IA.
              </p>
            )}
            {p ? (
              <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <LogoPartido eleccionId={cargo!.eleccion} logo={p.logo} nombre={p.nombre} color={p.color} className="size-9" />
                  {titulo(p.nombre)} en {lugar}
                  {p.curules > 0 && ` · ${p.curules} curules`}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {[...p.candidatos]
                    .sort((a, b) => b.votos - a.votos)
                    .slice(0, 40)
                    .map((x) => (
                      <li
                        key={x.codigo}
                        className={`flex items-center gap-3 rounded-lg px-2 py-1 text-sm ${
                          elegido?.codigo === x.codigo ? "bg-fuchsia-500/10 ring-1 ring-fuchsia-400/50" : ""
                        }`}
                      >
                        {x.soloLista ? (
                          <span className="min-w-0 flex-1 truncate italic text-muted-foreground">Solo por la lista</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCandSel({ url: url ?? "", codigo: x.codigo, nombre: x.nombre })}
                            className="min-w-0 flex-1 truncate text-left hover:text-fuchsia-700 dark:hover:text-fuchsia-300"
                            title="Elegir para analizar con IA"
                          >
                            {titulo(x.nombre)}
                          </button>
                        )}
                        <span className="h-3 w-40 overflow-hidden rounded-full bg-border/60">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${(x.votos / Math.max(1, p.votos)) * 100}%`, background: `linear-gradient(90deg, ${p.color}99, ${p.color})` }}
                          />
                        </span>
                        <span className="w-20 text-right font-semibold tabular-nums">{fmt(x.votos)}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              circ && (
                <div className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
                  <p className="text-sm font-semibold">Partidos en {lugar}</p>
                  <ul className="mt-3 space-y-1.5">
                    {partidos.slice(0, 15).map((x) => (
                      <li key={x.codigo} className="flex items-center gap-3 text-sm">
                        <LogoPartido
                          eleccionId={cargo!.eleccion}
                          logo={x.logo}
                          nombre={x.nombre}
                          color={x.color}
                          className="size-9 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-medium">{titulo(x.nombre)}</span>
                            <span className="shrink-0 font-semibold tabular-nums">
                              {fmt(x.votos)} <span className="text-xs font-normal text-muted-foreground">{x.pct}</span>
                            </span>
                          </span>
                          <span className="mt-1 block h-3 overflow-hidden rounded-full bg-border/60">
                            <span
                              className="cabal-bar block h-full rounded-full"
                              style={{ width: `${Math.max(1.5, (x.votos / max) * 100)}%`, background: `linear-gradient(90deg, ${x.color}99, ${x.color})` }}
                            />
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
            <p className="text-[11px] text-muted-foreground">
              {vista.fuente}. La edad de los votantes no la publica ninguna fuente oficial.
            </p>
          </div>
        )}
        {vista && !vista.resultado && (
          <p className="mt-4 text-sm text-muted-foreground">La Registraduría no publica resultados de este cargo para {lugar}.</p>
        )}
      </section>
    </div>
  );
}
