"use client";

import * as React from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Landmark,
  Loader2,
  MapPin,
  Percent,
  Search,
  Trophy,
  TriangleAlert,
  Vote,
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
} from "@/lib/gov-data/elecciones/resultados";
import { FotoCandidato, HojaDeVidaPanel, LogoPartido } from "./candidato-ui";
import { FiltroEleccion } from "./filtro-eleccion";
import { titulo } from "./nombres";
import { MapaElectoral3D, type RegionMapa } from "./mapa-electoral-3d";

const fmt = (n: number) => n.toLocaleString("es-CO");

/** Súbela cuando la API de resultados agregue o cambie campos. */
const DATOS_VERSION = "3";


// ---------------------------------------------------------------- mapa ---

type MapaCtx = {
  /** Elección y corporación de las que salen los ganadores. */
  clave: string;
  geoUrl: string;
  regiones: RegionMapa[];
  destacado?: string;
  excluir?: string[];
};

function regionDe(g: Ganador, geo: string, uninominal: boolean): RegionMapa {
  return {
    geo,
    codigo: g.codigo,
    nombre: titulo(g.nombre),
    color: g.color,
    valor: g.votos,
    detalle: [
      uninominal && g.candidato ? `Ganó: ${titulo(g.candidato)}` : `Ganó: ${titulo(g.partidoNombre)}`,
      `${fmt(g.votos)} votos (${g.pct})`,
      `Participación ${g.participacion}`,
      ...(g.empate ? ["Empate"] : []),
    ],
  };
}

/** Qué mapa corresponde a la vista: país, departamento, o Bogotá por localidades. */
function mapaDe(v: VistaElectoral): Omit<MapaCtx, "clave"> | null {
  const uni = v.corporacion.tipo === "uninominal";
  const mapa = v.resultado?.circunscripciones[0]?.mapa ?? [];
  const { nivel, dane } = v.ambito;
  if (nivel === 1) {
    return {
      geoUrl: "/data/geo/departamentos.json",
      excluir: ["88"],
      regiones: mapa.filter((g) => g.dane).map((g) => regionDe(g, g.dane!, uni)),
    };
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
      geoUrl: "/data/geo/bogota-localidades.json",
      regiones: [...zonas.values()]
        .map((g) => ({ g, loc: g.codigo.slice(-2) }))
        .filter(({ loc }) => Number(loc) >= 1 && Number(loc) <= 20)
        .map(({ g, loc }) => regionDe(g, loc, uni)),
    };
  }
  const regiones = mapa.filter((g) => g.dane).map((g) => regionDe(g, g.dane!, uni));
  if (nivel === 2 || (nivel === 3 && regiones.length > 0)) {
    return {
      geoUrl: `/data/geo/municipios/${dane.slice(0, 2)}.json`,
      destacado: nivel === 3 ? dane : undefined,
      regiones,
    };
  }
  return null;
}

/** El mapa de la vista nueva; en zonas, puestos y mesas se conserva el del municipio. */
function siguienteMapa(v: VistaElectoral, prev: MapaCtx | null): MapaCtx | null {
  const clave = `${v.eleccion.id}|${v.corporacion.sigla}`;
  const ctx = mapaDe(v);
  if (ctx) return { ...ctx, clave };
  if (prev?.clave !== clave) return null;
  // Municipio cuyo archivo trae ganadores por zona: el mapa del departamento, con él resaltado.
  if (v.ambito.nivel === 3) return prev.geoUrl.includes("/municipios/") ? { ...prev, destacado: v.ambito.dane } : null;
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

function RankingCandidatos({ c, filtro, eleccionId }: { c: Circunscripcion; filtro: string; eleccionId: string }) {
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
                    Hoja de vida
                    <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </span>
                </span>
              </span>
            </button>
            {open && <HojaDeVidaPanel cedula={x.cedula} nombre={x.nombre} />}
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
}: {
  candidatos: Candidato[];
  filtro: string;
  eleccionId: string;
  partido: PartidoResultado;
}) {
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
            {abierto === x.codigo && <HojaDeVidaPanel cedula={x.cedula} nombre={x.nombre} />}
          </li>
        )
      )}
    </ul>
  );
}

function TablaPartidos({ c, filtro, eleccionId }: { c: Circunscripcion; filtro: string; eleccionId: string }) {
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
            {open && <CandidatosDeLista candidatos={p.candidatos} filtro={q} eleccionId={eleccionId} partido={p} />}
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

  // Leyenda: territorios ganados por partido en el mapa.
  const leyenda = new Map<string, { nombre: string; color: string; n: number }>();
  for (const reg of mapaCtx?.regiones ?? []) {
    const nombre = reg.detalle[0]?.replace(/^Ganó: /, "") ?? "";
    const k = `${reg.color}|${nombre}`;
    const e = leyenda.get(k) ?? { nombre, color: reg.color, n: 0 };
    e.n += 1;
    leyenda.set(k, e);
  }

  const nivelHijos = vista?.hijos[0]?.nivel;
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
              Resultados oficiales · todos los candidatos
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
        <nav aria-label="Territorio" className="mt-4 flex flex-wrap items-center gap-1 text-sm">
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

        {vista && !r && !loading && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-orange-400/5 p-3 text-xs text-amber-800 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            La Registraduría no publica resultados de {vista.corporacion.nombre} para{" "}
            {vista.ambito.nivel === 1 ? "todo el país" : titulo(vista.ambito.nombre)}
            {vista.ambito.nivel === 7 ? " (no hay detalle por mesa en esta elección)" : ""}.
          </p>
        )}

        {/* KPIs */}
        {r && (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k, i) => {
              const s = KPI_STYLES[i];
              const Icon = s.icon;
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
            {mapaCtx && mapaCtx.regiones.length > 0 ? (
              <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-sky-500/10 via-emerald-500/5 to-amber-400/10 ring-1 ring-border/60">
                <MapaElectoral3D
                  geoUrl={mapaCtx.geoUrl}
                  regiones={mapaCtx.regiones}
                  destacado={mapaCtx.destacado}
                  excluir={mapaCtx.excluir}
                  onSelect={irA}
                />
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
                    {hijos.map(({ h, g }) => (
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
                    ))}
                  </div>
                ) : (
                  <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                    {hijos.map(({ h, g }, i) => (
                      <li key={h.codigo} className="cabal-rise" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Resultados */}
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
                <RankingCandidatos key={url} c={c} filtro={filtro} eleccionId={vista?.eleccion.id ?? eleccionId} />
              ) : (
                <TablaPartidos key={`${url}-${circ}`} c={c} filtro={filtro} eleccionId={vista?.eleccion.id ?? eleccionId} />
              )
            ) : loading ? (
              <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Consultando la Registraduría...
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
