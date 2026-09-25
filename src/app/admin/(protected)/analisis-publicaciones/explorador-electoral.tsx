"use client";

import * as React from "react";
import {
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronRight,
  Landmark,
  Loader2,
  MapPin,
  MapPinned,
  Percent,
  Search,
  Trophy,
  TriangleAlert,
  Vote,
  X,
} from "lucide-react";

import {
  CIRCUNSCRIPCIONES,
  ELECCIONES,
  NIVELES,
  findEleccion,
  type OpcionCargo,
} from "@/lib/gov-data/elecciones/catalogo";
import type {
  AmbitoRef,
  Candidato,
  Circunscripcion,
  Ganador,
  PartidoResultado,
  VistaElectoral,
  VotosCandidato,
  VotosHijo,
} from "@/lib/gov-data/elecciones/resultados";
import { heatColor } from "@/components/admin/colombia-heatmap";
import { FotoCandidato, HojaDeVidaPanel, LogoPartido } from "./candidato-ui";
import { FiltroEleccion } from "./filtro-eleccion";
import { titulo } from "./nombres";
import { CabalMap, type MapArea } from "./cabal-map";

const fmt = (n: number) => n.toLocaleString("es-CO");

/** Súbela cuando la API de resultados agregue o cambie campos. */
const DATOS_VERSION = "3";


// ---------------------------------------------------------------- mapa ---

type MapaCtx = {
  /** Elección y corporación de las que salen los ganadores. */
  clave: string;
  /** Departamento abierto (DANE), o null para el país. */
  dept: string | null;
  areas: MapArea[];
  /** Territorio resaltado (código de la Registraduría). */
  seleccionado?: string;
};

const pctNum = (s: string) => Number(s.replace("%", "").replace(",", ".")) || 0;

/** Cada territorio con el color de su ganador; más intenso cuanto más amplia la victoria. */
function areaDe(g: Ganador, geo: string, uninominal: boolean): MapArea {
  const ganador = uninominal && g.candidato ? titulo(g.candidato) : titulo(g.partidoNombre);
  return {
    id: g.codigo,
    name: titulo(g.nombre),
    votos: g.votos,
    geo,
    color: g.color,
    intensidad: (pctNum(g.pct) - 20) / 50,
    detalle: `${ganador} · ${g.pct}${g.empate ? " (empate)" : ""}`,
  };
}

/** Qué mapa corresponde a la vista: país, departamento, o Bogotá por localidades. */
function mapaDe(v: VistaElectoral): Omit<MapaCtx, "clave"> | null {
  const uni = v.corporacion.tipo === "uninominal";
  const mapa = v.resultado?.circunscripciones[0]?.mapa ?? [];
  const { nivel, dane } = v.ambito;
  if (nivel === 1) {
    return { dept: null, areas: mapa.filter((g) => g.dane).map((g) => areaDe(g, g.dane!, uni)) };
  }
  if (!dane) return null;
  if (nivel === 3 && dane === "11001") {
    // En Bogotá las zonas 01–20 son las localidades. Sus ganadores vienen en
    // `mapagan` o consultados uno a uno, según la elección.
    const zonas = new Map<string, Ganador>();
    for (const g of [...mapa, ...(v.ganadoresHijos ?? [])]) {
      if (g.codigo.startsWith(v.ambito.codigo) && g.codigo.length > v.ambito.codigo.length) zonas.set(g.codigo, g);
    }
    return {
      dept: "11",
      areas: [...zonas.values()]
        .map((g) => ({ g, loc: g.codigo.slice(-2) }))
        .filter(({ loc }) => Number(loc) >= 1 && Number(loc) <= 20)
        .map(({ g, loc }) => areaDe(g, loc, uni)),
    };
  }
  const areas = mapa.filter((g) => g.dane).map((g) => areaDe(g, g.dane!, uni));
  if (nivel === 2) return { dept: dane, areas };
  if (nivel === 3 && areas.length > 0) return { dept: dane.slice(0, 2), areas, seleccionado: v.ambito.codigo };
  return null;
}

/** El mapa de la vista nueva; en zonas, puestos y mesas se conserva el del municipio. */
function siguienteMapa(v: VistaElectoral, prev: MapaCtx | null): MapaCtx | null {
  const clave = `${v.eleccion.id}|${v.corporacion.sigla}`;
  const ctx = mapaDe(v);
  if (ctx) return { ...ctx, clave };
  if (prev?.clave !== clave) return null;
  // Municipio cuyo archivo trae ganadores por zona: el mapa del departamento, con él resaltado.
  if (v.ambito.nivel === 3) {
    return prev.dept && prev.dept === v.ambito.dane?.slice(0, 2) ? { ...prev, seleccionado: v.ambito.codigo } : null;
  }
  return v.ambito.nivel < 3 ? null : prev;
}

type Estado = {
  /** URL de la última respuesta (buena o con error). */
  url: string;
  error?: string;
  /** Última vista cargada: se queda en pantalla mientras llega la siguiente. */
  vista: VistaElectoral | null;
  vistaUrl: string;
  mapa: MapaCtx | null;
};

function useVista(url: string) {
  const [state, setState] = React.useState<Estado>({ url: "", vista: null, vistaUrl: "", mapa: null });
  const [intento, setIntento] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        const vista = body as VistaElectoral;
        if (!cancelled) setState((prev) => ({ url, vista, vistaUrl: url, mapa: siguienteMapa(vista, prev.mapa) }));
      })
      .catch((err: Error) => {
        if (!cancelled) setState((prev) => ({ ...prev, url, error: err.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [url, intento]);
  return {
    vista: state.vista,
    vistaUrl: state.vistaUrl,
    mapaCtx: state.mapa,
    error: state.url === url ? state.error : undefined,
    loading: state.url !== url,
    retry: () => setIntento((n) => n + 1),
  };
}

// ------------------------------------------------- candidato seguido ---

/** Candidato cuyos votos se siguen por el territorio; vale para la elección y el cargo en que se eligió. */
type Seguido = {
  clave: string;
  circ: string;
  candidato: Candidato;
  partido: Pick<PartidoResultado, "codigo" | "nombre" | "color" | "logo">;
};

const RONDAS = 8;

/** Votos del candidato seguido. Si quedaron territorios sin consultar, se vuelven a pedir por tandas. */
function useVotosCandidato(url: string | null) {
  const [state, setState] = React.useState<{ url: string; data?: VotosCandidato; error?: string; agotado?: boolean } | null>(
    null
  );
  const [intento, setIntento] = React.useState(0);
  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pedir = (ronda: number) => {
      fetch(url)
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
          return body as VotosCandidato;
        })
        .then(
          (data) => {
            if (cancelled) return;
            const agotado = data.pendientes > 0 && ronda >= RONDAS;
            setState({ url, data, agotado });
            if (data.pendientes > 0 && !agotado) timer = setTimeout(() => pedir(ronda + 1), 400);
          },
          (err: Error) => {
            if (!cancelled) setState((prev) => ({ url, data: prev?.url === url ? prev.data : undefined, error: err.message }));
          }
        );
    };
    pedir(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [url, intento]);
  const actual = url && state?.url === url ? state : null;
  return {
    data: actual?.data,
    error: actual?.error,
    /** Tras todas las tandas, la Registraduría no respondió por algunos territorios. */
    faltantes: actual?.agotado ? (actual.data?.pendientes ?? 0) : 0,
    loading: !!url && !actual?.error && !actual?.agotado && (!actual?.data || actual.data.pendientes > 0),
    retry: () => setIntento((n) => n + 1),
  };
}

/** Mapa de calor de los votos del candidato: país, departamento o Bogotá por localidades. */
function mapaSeguido(v: VistaElectoral, votos: VotosCandidato | undefined): { dept: string | null; areas: MapArea[] } | null {
  if (!votos || votos.ambito.codigo !== v.ambito.codigo) return null;
  const area = (h: VotosHijo, geo: string): MapArea => ({
    id: h.codigo,
    name: titulo(h.nombre),
    votos: h.votos ?? 0,
    geo,
    detalle: h.votos === null ? "consultando…" : `${fmt(h.votos)} votos${h.pct ? ` · ${h.pct}` : ""}`,
  });
  const { nivel, dane } = v.ambito;
  if (nivel === 1) return { dept: null, areas: votos.hijos.filter((h) => h.dane).map((h) => area(h, h.dane!)) };
  if (nivel === 2 && dane) return { dept: dane, areas: votos.hijos.filter((h) => h.dane).map((h) => area(h, h.dane!)) };
  if (nivel === 3 && dane === "11001") {
    return {
      dept: "11",
      areas: votos.hijos
        .map((h) => ({ h, loc: h.codigo.slice(-2) }))
        .filter(({ loc }) => Number(loc) >= 1 && Number(loc) <= 20)
        .map(({ h, loc }) => area(h, loc)),
    };
  }
  return null;
}

/** Texto oscuro o claro según el fondo del mapa de calor. */
function textoSobre(rgb: string) {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0a0a0c" : "#ffffff";
}

function BotonSeguir({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-600 to-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
    >
      <MapPinned className="size-3.5" aria-hidden="true" />
      Ver sus votos por territorio, hasta la mesa
    </button>
  );
}

// --------------------------------------------------------- resultados ---

function Barra({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/60">
      <div
        className="cabal-bar h-full rounded-full"
        style={{ width: `${Math.max(1.5, pct)}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }}
      />
    </div>
  );
}

/** Al elegir "ver sus votos", el tablero pasa a mostrar solo a ese candidato. */
type AlSeguir = { onSeguir: (x: Candidato, p: PartidoResultado) => void };

function RankingCandidatos({
  c,
  filtro,
  eleccionId,
  onSeguir,
}: { c: Circunscripcion; filtro: string; eleccionId: string } & AlSeguir) {
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const lista = c.partidos
    .flatMap((p) =>
      p.candidatos.filter((x) => !x.soloLista).map((x) => ({ ...x, partido: p }))
    )
    .sort((a, b) => b.votos - a.votos);
  const visibles = lista.filter((x) => x.nombre.toLowerCase().includes(filtro.toLowerCase()));
  const max = Math.max(1, lista[0]?.votos ?? 0);

  return (
    <ul className="space-y-2">
      {visibles.map((x, i) => {
        const pos = lista.indexOf(x) + 1;
        const ganador = pos === 1;
        const key = `${x.partido.codigo}-${x.codigo}`;
        const open = abierto === key;
        return (
          <li
            key={key}
            className={`cabal-rise rounded-2xl border p-3 transition-all duration-200 hover:shadow-lg ${
              ganador
                ? "border-amber-300/70 bg-gradient-to-r from-amber-300/20 via-amber-200/10 to-transparent shadow-md shadow-amber-500/10"
                : "border-border bg-surface"
            } ${open ? "ring-2 ring-emerald-500/40" : "hover:-translate-y-0.5"}`}
            style={{ animationDelay: `${Math.min(i, 15) * 40}ms` }}
          >
            <button
              type="button"
              onClick={() => setAbierto(open ? null : key)}
              aria-expanded={open}
              className="flex w-full items-start gap-3 text-left"
            >
              <span className="relative shrink-0">
                <FotoCandidato
                  eleccionId={eleccionId}
                  candidato={x}
                  logo={x.partido.logo}
                  color={x.partido.color}
                  className={`size-14 ${ganador ? "ring-2 ring-amber-400" : ""}`}
                />
                <span
                  className={`absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full text-[11px] font-bold text-white shadow ring-2 ring-surface ${
                    ganador ? "bg-gradient-to-br from-amber-400 to-orange-500" : ""
                  }`}
                  style={ganador ? undefined : { backgroundColor: x.partido.color }}
                >
                  {ganador ? <Trophy className="size-3.5" aria-hidden="true" /> : pos}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{titulo(x.nombre)}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-bold">{fmt(x.votos)}</span>{" "}
                    <span className="text-xs text-muted-foreground">{x.pct}</span>
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <LogoPartido
                    eleccionId={eleccionId}
                    logo={x.partido.logo}
                    nombre={x.partido.nombre}
                    color={x.partido.color}
                    className="size-6"
                  />
                  <span className="truncate">
                    {titulo(x.partido.nombre)}
                    {x.formula && <> · Fórmula: {titulo(x.formula)}</>}
                  </span>
                </span>
                <span className="mt-2 flex items-center gap-2">
                  <Barra pct={(x.votos / max) * 100} color={x.partido.color} />
                  {x.electo ? (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Electo
                    </span>
                  ) : ganador ? (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Más votado
                    </span>
                  ) : null}
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Votos y hoja de vida
                    <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </span>
                </span>
              </span>
            </button>
            {open && (
              <>
                <BotonSeguir onClick={() => onSeguir(x, x.partido)} />
                <HojaDeVidaPanel cedula={x.cedula} nombre={x.nombre} />
              </>
            )}
          </li>
        );
      })}
      {visibles.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin coincidencias.</li>}
    </ul>
  );
}

function CandidatosDeLista({
  candidatos,
  filtro,
  eleccionId,
  partido,
  onSeguir,
}: {
  candidatos: Candidato[];
  filtro: string;
  eleccionId: string;
  partido: PartidoResultado;
} & AlSeguir) {
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const lista = [...candidatos]
    .sort((a, b) => Number(b.electo) - Number(a.electo) || b.votos - a.votos)
    .filter((x) => x.nombre.toLowerCase().includes(filtro.toLowerCase()));
  return (
    <ul className="mt-2 divide-y divide-border rounded-xl border border-border bg-surface-muted/40">
      {lista.map((x) =>
        x.soloLista ? (
          <li key={x.codigo} className="flex items-center gap-2 px-3 py-2 text-sm">
            <LogoPartido eleccionId={eleccionId} logo={partido.logo} nombre={partido.nombre} color={partido.color} className="size-8" />
            <span className="min-w-0 flex-1 truncate italic text-muted-foreground">Solo por la lista (logo)</span>
            <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{fmt(x.votos)}</span>
          </li>
        ) : (
          <li key={x.codigo} className="px-3 py-2 text-sm">
            <button
              type="button"
              onClick={() => setAbierto(abierto === x.codigo ? null : x.codigo)}
              aria-expanded={abierto === x.codigo}
              className="flex w-full items-center gap-2 text-left"
            >
              <FotoCandidato eleccionId={eleccionId} candidato={x} logo={partido.logo} color={partido.color} className="size-8" />
              <span className="w-7 shrink-0 text-[11px] tabular-nums text-muted-foreground">{x.codigo}</span>
              <span className="min-w-0 flex-1 truncate">{titulo(x.nombre)}</span>
              {x.electo && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Curul
                </span>
              )}
              <span className="w-20 shrink-0 text-right font-semibold tabular-nums">{fmt(x.votos)}</span>
              <ChevronDown
                className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${abierto === x.codigo ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {abierto === x.codigo && (
              <>
                <BotonSeguir onClick={() => onSeguir(x, partido)} />
                <HojaDeVidaPanel cedula={x.cedula} nombre={x.nombre} />
              </>
            )}
          </li>
        )
      )}
    </ul>
  );
}

function TablaPartidos({
  c,
  filtro,
  eleccionId,
  onSeguir,
}: { c: Circunscripcion; filtro: string; eleccionId: string } & AlSeguir) {
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const partidos = [...c.partidos].sort((a, b) => b.curules - a.curules || b.votos - a.votos);
  const q = filtro.trim().toLowerCase();
  const visibles = q
    ? partidos.filter(
        (p) => p.nombre.toLowerCase().includes(q) || p.candidatos.some((x) => x.nombre.toLowerCase().includes(q))
      )
    : partidos.slice(0, 60);
  const max = Math.max(1, ...partidos.map((p) => p.votos));

  return (
    <ul className="space-y-2">
      {visibles.map((p: PartidoResultado, i) => {
        const open = abierto === p.codigo || (q !== "" && p.candidatos.some((x) => x.nombre.toLowerCase().includes(q)));
        const conCandidatos = p.candidatos.length > 0;
        return (
          <li
            key={p.codigo}
            className="cabal-rise rounded-2xl border border-border bg-surface p-3 transition-shadow hover:shadow-md"
            style={{ animationDelay: `${Math.min(i, 15) * 35}ms` }}
          >
            <button
              type="button"
              disabled={!conCandidatos}
              onClick={() => setAbierto(open ? null : p.codigo)}
              aria-expanded={conCandidatos ? open : undefined}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2">
                <LogoPartido eleccionId={eleccionId} logo={p.logo} nombre={p.nombre} color={p.color} className="size-10" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{titulo(p.nombre)}</span>
                {p.curules > 0 && (
                  <span className="shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                    {p.curules} {p.curules === 1 ? "curul" : "curules"}
                  </span>
                )}
                <span className="shrink-0 text-sm tabular-nums">
                  <span className="font-bold">{fmt(p.votos)}</span>{" "}
                  <span className="text-xs text-muted-foreground">{p.pct}</span>
                </span>
                {conCandidatos &&
                  (open ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Barra pct={(p.votos / max) * 100} color={p.color} />
                {conCandidatos && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {p.candidatos.filter((x) => !x.soloLista).length} candidatos
                  </span>
                )}
              </div>
            </button>
            {open && (
              <CandidatosDeLista
                candidatos={p.candidatos}
                filtro={q}
                eleccionId={eleccionId}
                partido={p}
                onSeguir={onSeguir}
              />
            )}
          </li>
        );
      })}
      {!q && partidos.length > visibles.length && (
        <li className="px-3 py-2 text-center text-xs text-muted-foreground">
          Y {fmt(partidos.length - visibles.length)} listas más con menos votos (usa el buscador).
        </li>
      )}
      {visibles.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin coincidencias.</li>}
    </ul>
  );
}

// ------------------------------------------------------------ pantalla ---

/** Tarjetas del candidato seguido: votos, puesto, peso en su lista (o distancia) y territorios con votos. */
const KPI_ICONOS_SEGUIDO = [Vote, Trophy, Percent, MapPin];
const KPI_ICONOS_SEGUIDO_UNINOMINAL = [Vote, Trophy, ArrowUpDown, MapPin];

const pctTexto = (n: number) => `${(n * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;

const KPI_STYLES = [
  { icon: Vote, card: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
  { icon: Building2, card: "from-sky-500 to-indigo-600 shadow-sky-500/30" },
  { icon: Percent, card: "from-amber-400 to-orange-600 shadow-orange-500/30" },
  { icon: Landmark, card: "from-fuchsia-500 to-rose-600 shadow-rose-500/30" },
];

export function ExploradorElectoral() {
  const [eleccionId, setEleccionId] = React.useState(ELECCIONES[0].id);
  const [sigla, setSigla] = React.useState(ELECCIONES[0].corporaciones[0].sigla);
  const [destino, setDestino] = React.useState<{ a?: string; dane?: string }>({});
  // Circunscripción elegida y filtro de territorios: valen para la vista en la que se eligieron.
  const [circSel, setCircSel] = React.useState({ url: "", i: 0 });
  const [filtro, setFiltro] = React.useState("");
  const [filtroHijosSel, setFiltroHijosSel] = React.useState({ url: "", q: "" });
  const [seguidoSel, setSeguidoSel] = React.useState<Seguido | null>(null);
  const navRef = React.useRef<HTMLElement>(null);

  const eleccion = findEleccion(eleccionId) ?? ELECCIONES[0];
  const url = `/api/admin/elecciones?${new URLSearchParams({
    // Versión de la forma de los datos: al cambiarla, el navegador no reutiliza respuestas viejas.
    v: DATOS_VERSION,
    e: eleccionId,
    c: sigla,
    ...(destino.a ? { a: destino.a } : {}),
    ...(destino.dane ? { dane: destino.dane } : {}),
  })}`;
  const { vista, vistaUrl, mapaCtx, error, loading, retry } = useVista(url);
  const clave = `${eleccionId}|${sigla}`;
  const seguido = seguidoSel?.clave === clave ? seguidoSel : null;
  const votosUrl =
    seguido && vista && vista.eleccion.id === eleccionId && vista.corporacion.sigla === sigla
      ? `/api/admin/elecciones/candidato?${new URLSearchParams({
          v: DATOS_VERSION,
          e: eleccionId,
          c: sigla,
          a: vista.ambito.codigo,
          circ: seguido.circ,
          p: seguido.partido.codigo,
          k: seguido.candidato.codigo,
        })}`
      : null;
  const votos = useVotosCandidato(votosUrl);
  const circ = circSel.url === vistaUrl ? circSel.i : 0;
  const setCirc = (i: number) => setCircSel({ url: vistaUrl, i });
  const filtroHijos = filtroHijosSel.url === vistaUrl ? filtroHijosSel.q : "";
  const setFiltroHijos = (q: string) => setFiltroHijosSel({ url: vistaUrl, q });

  const irA = (codigo: string) => setDestino({ a: codigo });
  const cambiarCargo = (o: OpcionCargo) => {
    const lugar = [...(vista?.ruta ?? [])].reverse().find((r) => r.dane && r.nivel <= 3);
    // En la misma elección los códigos coinciden entre cargos; entre elecciones
    // cambian, así que se conserva el departamento o municipio por DANE.
    setDestino(
      o.eleccionId === eleccionId && vista ? { a: vista.ambito.codigo, dane: lugar?.dane } : lugar?.dane ? { dane: lugar.dane } : {}
    );
    setEleccionId(o.eleccionId);
    setSigla(o.sigla);
  };
  const cargo = eleccion.corporaciones.find((co) => co.sigla === sigla) ?? eleccion.corporaciones[0];
  const encabezado =
    cargo.sigla === "PR" ? eleccion.nombre : `${cargo.nombre} ${eleccion.fecha.slice(0, 4)}`;

  const r = vista?.resultado ?? null;
  const circs = r?.circunscripciones ?? [];
  const c = circs[Math.min(circ, circs.length - 1)];
  const uninominal = vista?.corporacion.tipo === "uninominal";
  const hayCandidatos = !!c?.partidos.some((p) => p.candidatos.some((x) => !x.soloLista));
  const blancos = circs.reduce((acc, x) => acc + x.blancos, 0);
  const seguir = (x: Candidato, p: PartidoResultado) => {
    setSeguidoSel({
      clave,
      circ: c?.codigo ?? "",
      candidato: x,
      partido: { codigo: p.codigo, nombre: p.nombre, color: p.color, logo: p.logo },
    });
    requestAnimationFrame(() => navRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const kpis = r
    ? [
        { label: "Votantes", value: fmt(r.votantes), hint: `Participación ${r.participacion}` },
        { label: "Mesas informadas", value: r.mesas.pct || "—", hint: `${fmt(r.mesas.informadas)} de ${fmt(r.mesas.total)}` },
        { label: "Votos en blanco", value: fmt(blancos), hint: c?.pctBlancos ? `${c.pctBlancos} de los válidos` : "" },
        uninominal
          ? { label: "Candidatos", value: fmt(c?.partidos.reduce((a, p) => a + p.candidatos.filter((x) => !x.soloLista).length, 0) ?? 0), hint: "en este territorio" }
          : { label: "Curules", value: fmt(r.curules || c?.curules || 0), hint: r.curules ? "en juego" : "se asignan en su circunscripción" },
      ]
    : [];

  // Ganador de cada hijo, del `mapagan` del ámbito o consultado uno a uno.
  const ganadores = new Map<string, Ganador>();
  for (const g of c?.mapa ?? []) ganadores.set(g.codigo, g);
  for (const g of vista?.ganadoresHijos ?? []) ganadores.set(g.codigo, g);
  const hijos = (vista?.hijos ?? [])
    .map((h) => ({ h, g: ganadores.get(h.codigo) }))
    .filter(({ h }) => h.nombre.toLowerCase().includes(filtroHijos.toLowerCase()))
    .sort((a, b) => (a.h.nivel === 7 ? 0 : (b.g?.votantes ?? -1) - (a.g?.votantes ?? -1)));
  const votosHijo = new Map((votos.data?.hijos ?? []).map((h) => [h.codigo, h]));
  const maxHijo = Math.max(1, ...(votos.data?.hijos ?? []).map((h) => h.votos ?? 0));
  const minMesa = Math.min(maxHijo, ...(votos.data?.hijos ?? []).flatMap((h) => (h.votos ? [h.votos] : [])));
  if (seguido && votos.data) {
    hijos.sort((a, b) =>
      a.h.nivel === 7 ? 0 : (votosHijo.get(b.h.codigo)?.votos ?? -1) - (votosHijo.get(a.h.codigo)?.votos ?? -1)
    );
  }
  const mapaCand = seguido && vista ? mapaSeguido(vista, votos.data) : null;
  const lugar = vista?.ambito.nivel === 1 ? "todo el país" : titulo(vista?.ambito.nombre ?? "");

  // Leyenda: territorios ganados por partido en el mapa.
  const leyenda = new Map<string, { nombre: string; color: string; n: number }>();
  for (const a of mapaCtx?.areas ?? []) {
    const nombre = a.detalle?.split(" · ")[0] ?? "";
    const color = a.color ?? "#94a3b8";
    const k = `${color}|${nombre}`;
    const e = leyenda.get(k) ?? { nombre, color, n: 0 };
    e.n += 1;
    leyenda.set(k, e);
  }

  const nivelHijos = vista?.hijos[0]?.nivel;

  // El candidato seguido en el territorio visible: su puesto entre todos y dentro de su lista.
  const cSeguido = seguido
    ? (circs.find((x) => x.codigo === seguido.circ) ?? (circs.length === 1 ? circs[0] : undefined))
    : undefined;
  const ranking = (cSeguido?.partidos ?? [])
    .flatMap((p) => p.candidatos.filter((x) => !x.soloLista).map((x) => ({ x, p })))
    .sort((a, b) => b.x.votos - a.x.votos);
  const puesto = seguido
    ? ranking.findIndex(({ x, p }) => p.codigo === seguido.partido.codigo && x.codigo === seguido.candidato.codigo)
    : -1;
  const aqui = puesto >= 0 ? ranking[puesto] : null;
  const rival = aqui && ranking.length > 1 ? ranking[puesto === 0 ? 1 : 0] : null;
  const enLista = aqui ? aqui.p.candidatos.filter((x) => !x.soloLista).sort((a, b) => b.votos - a.votos) : [];
  const puestoLista = aqui ? enLista.findIndex((x) => x.codigo === aqui.x.codigo) + 1 : 0;
  const conVotos = (votos.data?.hijos ?? []).filter((h) => (h.votos ?? 0) > 0).length;
  const pctAqui = votos.data?.pct || aqui?.x.pct;
  const kpisSeguido = seguido
    ? [
        {
          label: `Votos en ${lugar}`,
          value: votos.data ? fmt(votos.data.votos) : aqui ? fmt(aqui.x.votos) : "…",
          hint: pctAqui ? `${pctAqui} de los válidos` : "",
        },
        {
          label: "Puesto aquí",
          value: aqui ? `#${fmt(puesto + 1)}` : "—",
          hint: aqui ? `entre ${fmt(ranking.length)} candidatos` : "no aparece en este territorio",
        },
        uninominal
          ? {
              label: puesto === 0 ? "Ventaja sobre el segundo" : "Distancia al primero",
              value: aqui && rival ? fmt(Math.abs(aqui.x.votos - rival.x.votos)) : "—",
              hint: rival ? (puesto === 0 ? "votos sobre el segundo" : "votos detrás del primero") : "",
            }
          : {
              label: "Peso en su lista",
              value: aqui && aqui.p.votos ? pctTexto(aqui.x.votos / aqui.p.votos) : "—",
              hint: aqui ? `de los ${fmt(aqui.p.votos)} votos de su partido` : "",
            },
        vista && vista.hijos.length > 0
          ? {
              label: `${NIVELES[nivelHijos ?? 2]}s con votos`,
              value: votos.data && !votos.loading ? `${fmt(conVotos)} de ${fmt(vista.hijos.length)}` : "…",
              hint: "donde obtuvo al menos un voto",
            }
          : { label: "Votantes aquí", value: r ? fmt(r.votantes) : "—", hint: r ? `Participación ${r.participacion}` : "" },
      ]
    : null;
  const pideTerritorio = vista && !hayCandidatos && vista.ambito.nivel < vista.corporacion.nivelEleccion;
  // Consultas donde cada partido lleva un solo candidato (2022) se leen como ranking;
  // si cada consulta agrupa a varios (2026), por consulta.
  const comoRanking =
    hayCandidatos &&
    (uninominal ||
      (vista?.corporacion.tipo === "consulta" &&
        !!c?.partidos.every((p) => p.candidatos.filter((x) => !x.soloLista).length <= 1)));

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-xl shadow-emerald-900/5 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="cabal-blob absolute -top-24 -left-16 size-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="cabal-blob absolute -top-10 right-0 size-64 rounded-full bg-sky-400/20 blur-3xl [animation-delay:-4s]" />
        <div className="cabal-blob absolute bottom-0 left-1/3 size-80 rounded-full bg-amber-300/15 blur-3xl [animation-delay:-8s]" />
      </div>

      <div className="relative">
        {/* Encabezado: elección y corporación */}
        <div className="relative z-20 rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-600 to-sky-600 p-5 text-white shadow-lg shadow-emerald-700/25">
          {/* Los círculos van en su propia capa recortada: el desplegable del filtro debe poder salirse. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute -right-10 -bottom-16 size-48 rounded-full bg-white/10" />
            <div className="absolute right-24 -top-12 size-28 rounded-full bg-amber-300/25 blur-xl" />
          </div>
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide backdrop-blur">
              <Vote className="size-3.5" aria-hidden="true" />
              {seguido ? `Resultados oficiales · ${titulo(seguido.candidato.nombre)}` : "Resultados oficiales · todos los candidatos"}
            </p>
            <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">{encabezado}</p>
            <p className="mt-1 text-xs text-white/80">
              {vista?.fuente ?? "Preconteo oficial de la Registraduría Nacional del Estado Civil"}
              {r?.corte ? ` · corte ${r.corte}` : ""}
            </p>

            <FiltroEleccion eleccionId={eleccionId} sigla={sigla} onChange={cambiarCargo} />
          </div>
        </div>

        {/* Migas */}
        <nav ref={navRef} aria-label="Territorio" className="mt-4 flex scroll-mt-4 flex-wrap items-center gap-1 text-sm">
          {(vista?.ruta ?? []).map((a: AmbitoRef, i, all) => {
            const last = i === all.length - 1;
            return (
              <React.Fragment key={a.codigo}>
                {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                <button
                  type="button"
                  disabled={last}
                  onClick={() => irA(a.codigo)}
                  className={
                    last
                      ? "rounded-full bg-emerald-600 px-2.5 py-0.5 font-semibold text-white"
                      : "rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                  }
                >
                  {a.nivel === 1 ? "Colombia" : titulo(a.nombre)}
                </button>
              </React.Fragment>
            );
          })}
          {loading && <Loader2 className="ml-2 size-4 animate-spin text-emerald-600" aria-label="Cargando" />}
        </nav>

        {error && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-300/50 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
            <TriangleAlert className="size-4" aria-hidden="true" />
            {error}
            <button
              type="button"
              onClick={retry}
              className="rounded-full border border-border bg-surface px-3 py-0.5 text-xs font-medium text-foreground"
            >
              Reintentar
            </button>
          </div>
        )}

        {seguido && (
          <div className="cabal-rise mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-surface to-emerald-500/10 p-3 shadow-sm">
            <FotoCandidato
              eleccionId={eleccionId}
              candidato={seguido.candidato}
              logo={seguido.partido.logo}
              color={seguido.partido.color}
              className="size-12"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                <MapPinned className="size-3.5" aria-hidden="true" />
                Siguiendo sus votos hasta la mesa
              </p>
              <p className="flex items-center gap-2 font-semibold">
                <span className="truncate">{titulo(seguido.candidato.nombre)}</span>
                {seguido.candidato.electo && (
                  <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {uninominal ? "Electo" : "Curul"}
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {titulo(seguido.partido.nombre)}
                {seguido.candidato.formula && <> · Fórmula: {titulo(seguido.candidato.formula)}</>}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">{votos.data ? fmt(votos.data.votos) : "…"}</p>
              <p className="text-[11px] text-muted-foreground">
                votos en {lugar}
                {votos.data?.pct ? ` · ${votos.data.pct} de los válidos` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSeguidoSel(null)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium transition hover:bg-surface-muted"
            >
              <X className="size-3.5" aria-hidden="true" />
              Dejar de seguir
            </button>
            {(votos.loading || votos.error || votos.faltantes > 0) && (
              <p className="flex w-full flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {votos.error || votos.faltantes > 0 ? (
                  <>
                    <span className="text-red-700 dark:text-red-300">
                      {votos.error ??
                        `La Registraduría no respondió por ${fmt(votos.faltantes)} de ${fmt(votos.data?.hijos.length ?? 0)}; puede estar limitando las consultas.`}
                    </span>
                    <button
                      type="button"
                      onClick={votos.retry}
                      className="rounded-full border border-border bg-surface px-2.5 py-0.5 font-medium text-foreground"
                    >
                      Reintentar
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    Consultando sus votos en cada {NIVELES[nivelHijos ?? 2]?.toLowerCase() ?? "territorio"}
                    {votos.data?.pendientes ? ` (faltan ${fmt(votos.data.pendientes)} de ${fmt(votos.data.hijos.length)})` : "…"}
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {vista && !r && !loading && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-orange-400/5 p-3 text-xs text-amber-800 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            La Registraduría no publica resultados de {vista.corporacion.nombre} para{" "}
            {vista.ambito.nivel === 1 ? "todo el país" : titulo(vista.ambito.nombre)}
            {vista.ambito.nivel === 7 ? " (no hay detalle por mesa en esta elección)" : ""}.
          </p>
        )}

        {/* KPIs: del territorio, o del candidato seguido */}
        {(seguido || r) && (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(kpisSeguido ?? kpis).map((k, i) => {
              const s = KPI_STYLES[i];
              const Icon = kpisSeguido ? (uninominal ? KPI_ICONOS_SEGUIDO_UNINOMINAL : KPI_ICONOS_SEGUIDO)[i] : s.icon;
              return (
                <div
                  key={`${url}-${k.label}`}
                  className={`cabal-rise group relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.card} p-4 text-white shadow-lg transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.02]`}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div aria-hidden="true" className="absolute -right-6 -bottom-8 size-24 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-125" />
                  <div className="relative flex items-center justify-between">
                    <p className="text-xs font-medium text-white/85">{k.label}</p>
                    <span className="grid size-8 place-items-center rounded-xl bg-white/20 backdrop-blur">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="relative mt-2 text-2xl font-bold tabular-nums">{k.value}</p>
                  {k.hint && <p className="relative text-[11px] text-white/80">{k.hint}</p>}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* Mapa 3D + territorios */}
          <div className="min-w-0 space-y-4">
            {seguido ? (
              mapaCand && (
                <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-sky-500/10 via-emerald-500/5 to-amber-400/10 ring-1 ring-border/60">
                  <div className="mx-auto w-full max-w-[520px] p-3">
                    <CabalMap
                      dept={mapaCand.dept}
                      areas={mapaCand.areas}
                      loading={loading || votos.loading}
                      onSelect={(a) => irA(a.id)}
                      onBack={() => vista && irA(vista.ruta[0].codigo)}
                      onOpenBogota={() => setDestino({ dane: "11001" })}
                      ariaLabel={`Mapa de calor de los votos de ${titulo(seguido.candidato.nombre)}`}
                    />
                  </div>
                </div>
              )
            ) : mapaCtx && (mapaCtx.areas.length > 0 || mapaCtx.dept) ? (
              <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-sky-500/10 via-emerald-500/5 to-amber-400/10 ring-1 ring-border/60">
                <div className="mx-auto w-full max-w-[520px] p-3">
                  <CabalMap
                    dept={mapaCtx.dept}
                    areas={mapaCtx.areas}
                    selectedId={mapaCtx.seleccionado}
                    loading={loading}
                    onSelect={(a) => irA(a.id)}
                    onBack={() => vista && irA(vista.ruta[0].codigo)}
                    onOpenBogota={() => setDestino({ dane: "11001" })}
                    ariaLabel={`Mapa de ganadores: ${vista?.corporacion.nombre ?? ""}`}
                  />
                </div>
                {leyenda.size > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-border/60 bg-surface/70 p-3 backdrop-blur">
                    {[...leyenda.values()]
                      .sort((a, b) => b.n - a.n)
                      .slice(0, 8)
                      .map((l) => (
                        <span
                          key={`${l.color}${l.nombre}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium shadow-sm ring-1 ring-border"
                        >
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                          {l.nombre}
                          <span className="text-muted-foreground">· {l.n}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ) : null}

            {vista && vista.hijos.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface-muted/40 p-3">
                <div className="flex items-center justify-between gap-2 px-1 pb-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {NIVELES[nivelHijos ?? 2]}s · {fmt(vista.hijos.length)}
                  </p>
                  {vista.hijos.length > 8 && nivelHijos !== 7 && (
                    <input
                      value={filtroHijos}
                      onChange={(e) => setFiltroHijos(e.target.value)}
                      placeholder="Buscar"
                      className="w-36 rounded-full border border-border bg-surface px-3 py-1 text-xs outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                    />
                  )}
                </div>
                {nivelHijos === 7 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
                    {hijos.map(({ h, g }) => {
                      if (seguido) {
                        const v = votosHijo.get(h.codigo);
                        // Entre mesas de un puesto los votos se parecen: la escala va del mínimo al
                        // máximo del puesto, para que se vea cuáles pesan más. Sin votos, gris.
                        const bg = heatColor(v?.votos ? 0.2 + 0.8 * ((v.votos - minMesa) / Math.max(1, maxHijo - minMesa)) : 0);
                        return (
                          <button
                            key={h.codigo}
                            type="button"
                            onClick={() => irA(h.codigo)}
                            className="rounded-lg px-1 py-1.5 text-center shadow-sm transition-transform hover:scale-105"
                            style={{ backgroundColor: bg, color: textoSobre(bg) }}
                            title={`${h.nombre}: ${v?.votos == null ? "consultando" : `${fmt(v.votos)} votos`} de ${titulo(seguido.candidato.nombre)}`}
                          >
                            <div className="text-[10px] opacity-85">{h.nombre}</div>
                            <div className="text-xs font-semibold tabular-nums">{v?.votos == null ? "…" : fmt(v.votos)}</div>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={h.codigo}
                          type="button"
                          onClick={() => irA(h.codigo)}
                          className="rounded-lg px-1 py-1.5 text-center text-white shadow-sm transition-transform hover:scale-105"
                          style={{ backgroundColor: g?.color ?? "#94a3b8" }}
                          title={g ? `${h.nombre}: ${titulo(g.candidato ?? g.partidoNombre)} (${g.pct})` : h.nombre}
                        >
                          <div className="text-[10px] opacity-85">{h.nombre}</div>
                          <div className="text-xs font-semibold tabular-nums">{g ? fmt(g.votantes) : "—"}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                    {hijos.map(({ h, g }, i) => (
                      <li key={h.codigo} className="cabal-rise" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
                        {seguido ? (
                          <button
                            type="button"
                            onClick={() => irA(h.codigo)}
                            className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-surface px-3 py-2 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-sky-400/40 hover:shadow-md"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium group-hover:text-sky-700 dark:group-hover:text-sky-300">
                                {titulo(h.nombre)}
                              </span>
                              <span className="mt-1.5 flex items-center">
                                <Barra
                                  pct={((votosHijo.get(h.codigo)?.votos ?? 0) / maxHijo) * 100}
                                  color={seguido.partido.color}
                                />
                              </span>
                            </span>
                            <span className="shrink-0 text-right tabular-nums">
                              <span className="block text-sm font-semibold">
                                {votosHijo.get(h.codigo)?.votos == null ? "…" : fmt(votosHijo.get(h.codigo)!.votos!)}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {votosHijo.get(h.codigo)?.pct || "votos"}
                              </span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => irA(h.codigo)}
                            className="group flex w-full items-center gap-2 rounded-xl border border-transparent bg-surface px-3 py-2 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-md"
                          >
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g?.color ?? "#cbd5e1" }} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                                {titulo(h.nombre)}
                              </span>
                              {g && (
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {titulo(uninominal && g.candidato ? g.candidato : g.partidoNombre)} · {g.pct}
                                </span>
                              )}
                            </span>
                            {g && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(g.votantes)} votantes</span>}
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Resultados: todos los partidos, o solo el candidato seguido */}
          {seguido ? (
            <div className="min-w-0 space-y-4">
              {aqui && !uninominal && (
                <div className="cabal-rise rounded-2xl border border-border bg-surface p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Su lista en {lugar}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <LogoPartido
                      eleccionId={eleccionId}
                      logo={aqui.p.logo}
                      nombre={aqui.p.nombre}
                      color={aqui.p.color}
                      className="size-10"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{titulo(aqui.p.nombre)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {fmt(aqui.p.votos)} votos · {aqui.p.pct}
                        {aqui.p.curules > 0 && ` · ${aqui.p.curules} ${aqui.p.curules === 1 ? "curul" : "curules"}`}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Barra pct={aqui.p.votos ? (aqui.x.votos / aqui.p.votos) * 100 : 0} color={aqui.p.color} />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      #{puestoLista} de {fmt(enLista.length)} en su lista
                    </span>
                  </div>
                </div>
              )}
              <HojaDeVidaPanel cedula={seguido.candidato.cedula} nombre={seguido.candidato.nombre} />
            </div>
          ) : (
          <div className="min-w-0">
            {circs.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {circs.map((x, i) => (
                  <button
                    key={x.codigo}
                    type="button"
                    onClick={() => setCirc(i)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      i === circ ? "bg-sky-600 text-white shadow" : "bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
                    }`}
                  >
                    Circunscripción {CIRCUNSCRIPCIONES[x.codigo] ?? x.codigo}
                  </button>
                ))}
              </div>
            )}

            {c && (
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder={hayCandidatos ? "Buscar candidato o partido" : "Buscar partido"}
                  className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                />
              </div>
            )}

            {pideTerritorio && (
              <p className="mb-3 rounded-xl border border-sky-400/40 bg-sky-500/5 p-3 text-xs text-sky-800 dark:text-sky-300">
                Aquí se ven los votos por partido. Para ver los candidatos ({vista!.corporacion.nombre}), elige{" "}
                {vista!.corporacion.nivelEleccion === 2
                  ? "un departamento"
                  : vista!.corporacion.nivelEleccion === 5
                    ? "un municipio y luego una comuna"
                    : "un municipio"}{" "}
                en el mapa o en la lista.
              </p>
            )}

            {c ? (
              comoRanking ? (
                <RankingCandidatos
                  key={url}
                  c={c}
                  filtro={filtro}
                  eleccionId={vista?.eleccion.id ?? eleccionId}
                  onSeguir={seguir}
                />
              ) : (
                <TablaPartidos
                  key={`${url}-${circ}`}
                  c={c}
                  filtro={filtro}
                  eleccionId={vista?.eleccion.id ?? eleccionId}
                  onSeguir={seguir}
                />
              )
            ) : loading ? (
              <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Consultando la Registraduría...
              </p>
            ) : null}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
