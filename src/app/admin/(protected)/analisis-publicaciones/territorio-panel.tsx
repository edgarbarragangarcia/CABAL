"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Database, Flame, Loader2, MapPinned, Search, ShieldAlert, TriangleAlert } from "lucide-react";

import { buildNetwork, type Mapping } from "@/lib/crm/network";
import { seguidoresEn } from "@/lib/crm/seguidores";
import { DIMENSIONS, type CrmSnapshot } from "@/lib/crm/types";
import type { Indicadores, ItemIndicador } from "@/lib/territorio/indicadores";
import { GRUPOS, type Grupo } from "@/lib/territorio/catalogo";
import type { Coincidencia, Lugar } from "@/lib/territorio/jerarquia";
import type { Relacion } from "@/lib/territorio/relacion";
import type { EleccionLugar } from "@/lib/territorio/votacion";
import { titulo } from "./nombres";
import { usePeticion } from "./peticion";
import { SocioeconomicoTerritorio } from "./territorio-socioeconomico";
import { RelacionTerritorio } from "./territorio-relacion";
import { TerritorioMapa, mapaDe } from "./territorio-mapa";
import { FuentesTerritorio } from "./territorio-fuentes";

/**
 * Territorio: elige un departamento o municipio y ves cómo le fue a María Fernanda Cabal y a la oposición, qué conflicto armado y qué
 * problemas hay, la relación entre ambos municipio por municipio y quiénes son tus principales seguidores allí (del CRM). Todo sale de
 * Supabase; las cifras del conflicto se cargan desde datos.gov.co con el panel de fuentes de abajo.
 */

type Respuesta = { lugar: Lugar; elecciones: EleccionLugar[]; indicadores: Indicadores | null; relacion: Relacion | null; error?: string };

const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";
const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const dec = (n: number, d = 1) => n.toLocaleString("es-CO", { maximumFractionDigits: d, minimumFractionDigits: d });
const CLAVE_LUGAR = "el-admin-territorio-v2";
const CLAVE_CAMPOS = "el-admin-red-crm-campos-v1";
const TODAS: ReadonlySet<(typeof DIMENSIONS)[number]> = new Set(DIMENSIONS);

function leerLugar(): string {
  try {
    return localStorage.getItem(CLAVE_LUGAR) || "co";
  } catch {
    return "co";
  }
}

function guardarLugar(id: string) {
  try {
    localStorage.setItem(CLAVE_LUGAR, id);
  } catch {
    /* la preferencia dura mientras la pestaña esté abierta */
  }
}

function leerCampos(): Mapping {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CAMPOS) ?? "{}") as Mapping;
  } catch {
    return {};
  }
}

/** Cómo le fue a María Fernanda Cabal en el lugar, elección por elección (en 2026 su partido fue con lista cerrada). */
function VotosCabal({ elecciones, lugar }: { elecciones: EleccionLugar[]; lugar: string }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr><th className="px-3 py-2.5 font-semibold">Elección</th><th className="px-3 py-2.5 text-right font-semibold">Votos</th><th className="px-3 py-2.5 text-right font-semibold">% de los válidos</th><th className="px-3 py-2.5 font-semibold">Puesto</th></tr>
          </thead>
          <tbody>
            {elecciones.map((e) => (
              <tr key={e.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2.5 font-medium">{e.titulo}</td>
                {!e.guardado ? (
                  <td colSpan={3} className="px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">Sin resultado guardado{e.cobertura ? ` (${e.cobertura.guardados} de ${e.cobertura.total})` : ""}. Se carga en Fuente de la verdad.</td>
                ) : e.noPublicado ? (
                  <td colSpan={3} className="px-3 py-2.5 text-xs text-muted-foreground">La Registraduría no publica este lugar.</td>
                ) : e.cabal ? (
                  <>
                    <td className="px-3 py-2.5 text-right text-base font-bold tabular-nums">{fmt(e.cabal.votos)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{dec(e.cabal.pct, 2)} %</td>
                    <td className="px-3 py-2.5 tabular-nums">{e.cabal.puesto} <span className="text-xs text-muted-foreground">de {fmt(e.cabal.de)}</span></td>
                  </>
                ) : (
                  <td colSpan={3} className="px-3 py-2.5 text-xs text-muted-foreground">
                    {e.listaCerrada && e.partidoCabal ? `Lista cerrada: no hay votos por candidato. Su partido, ${titulo(e.partidoCabal.nombre)}, sacó ${fmt(e.partidoCabal.votos)} votos (${dec(e.partidoCabal.pct)} %).` : "Sin votos propios en este lugar."}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Votos de María Fernanda Cabal al Senado en {lugar}, de los resultados guardados en Supabase.</p>
    </div>
  );
}

function Indicador({ i }: { i: ItemIndicador }) {
  const veces = i.veces;
  const alto = veces !== undefined && veces >= 1.5;
  const bajo = veces !== undefined && veces <= 0.67;
  const cambio = i.anterior && i.anterior.valor > 0 ? ((i.valor - i.anterior.valor) / i.anterior.valor) * 100 : null;
  const esPdet = i.clave === "pdet";
  return (
    <li className={`rounded-xl border p-3 ${alto ? "border-amber-400/60 bg-amber-500/5" : "border-border"}`} title={i.ayuda}>
      <p className="text-xs font-semibold text-muted-foreground">{i.etiqueta}</p>
      {esPdet ? (
        <p className="mt-1 text-lg font-bold">{i.municipios !== undefined && i.valor > 0 ? (i.detalle ? "Sí" : `${fmt(i.valor)} municipios`) : "No"}</p>
      ) : (
        <p className="mt-1 text-lg font-bold tabular-nums">{fmt(i.valor)} <span className="text-xs font-medium text-muted-foreground">{i.unidad}</span></p>
      )}
      {esPdet && i.detalle && <p className="text-xs text-muted-foreground">Subregión {titulo(i.detalle)}</p>}
      {i.tasa && <p className="text-xs text-muted-foreground">{fmt(i.tasa.cantidad)} {i.tasa.texto}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {veces !== undefined && (alto || bajo) && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${alto ? "bg-amber-500/20 text-amber-800 dark:text-amber-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>{alto ? `${dec(veces)} × el promedio nacional` : "por debajo del promedio nacional"}</span>
        )}
        {cambio !== null && Math.abs(cambio) >= 5 && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${cambio > 0 ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>
            {cambio > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{fmt(Math.abs(cambio))} % frente a {i.anterior!.periodo}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">{i.periodo === "acum" ? "Acumulado" : i.periodo}</p>
    </li>
  );
}

function Conflicto({ ind, alCargar }: { ind: Indicadores; alCargar: () => void }) {
  if (!ind.disponible) {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"><TriangleAlert className="mt-0.5 size-4 shrink-0" />{ind.sinTablas ? "Falta crear la tabla de cifras del territorio en Supabase (un paso, con el SQL de abajo)." : "Todavía no están cargadas las cifras de conflicto y problemas. Cárgalas abajo: salen de datos.gov.co y se guardan en Supabase."}</p>
        <FuentesTerritorio alCargar={alCargar} />
      </div>
    );
  }
  const fuentes = [...new Set(ind.items.map((i) => i.fuente))];
  return (
    <div className="space-y-5">
      {ind.grupos.map((g) => (
        <div key={g.grupo}>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">{g.grupo === "conflicto" ? <Flame className="size-3.5" /> : g.grupo === "seguridad" ? <ShieldAlert className="size-3.5" /> : null}{GRUPOS[g.grupo as Grupo]}</p>
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            {ind.items.filter((i) => i.grupo === g.grupo).map((i) => <Indicador key={i.clave} i={i} />)}
          </ul>
        </div>
      ))}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Fuentes: {fuentes.join("; ")}. Las tasas usan la población proyectada por el DANE para {ind.anioPoblacion}{ind.poblacion ? ` (${fmt(ind.poblacion)} habitantes en este lugar)` : ""}. Las víctimas son personas registradas por hechos ocurridos allí desde que existe el registro, así que pueden superar la población actual en los lugares más golpeados.
      </p>
    </div>
  );
}

const PRINCIPALES = [
  ["11001", "Bogotá"],
  ["05001", "Medellín"],
  ["76001", "Cali"],
  ["08001", "Barranquilla"],
  ["13001", "Cartagena"],
  ["68001", "Bucaramanga"],
] as const;
const NIVEL_TEXTO: Record<string, string> = { pais: "País", departamento: "Departamento", municipio: "Municipio", localidad: "Localidad o comuna", barrio: "Barrio", puesto: "Puesto de votación" };
const LIMITE = 48;

/** Escribir un lugar y elegirlo de la lista: la forma más corta de llegar a cualquier nivel. */
function Buscador({ alElegir }: { alElegir: (id: string) => void }) {
  const [q, setQ] = React.useState("");
  const [lista, setLista] = React.useState<Coincidencia[]>([]);
  React.useEffect(() => {
    if (q.trim().length < 2) return;
    let viva = true;
    const t = setTimeout(() => {
      fetch(`/api/admin/territorio/buscar?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j: { resultados?: Coincidencia[] }) => viva && setLista(j.resultados ?? []))
        .catch(() => viva && setLista([]));
    }, 200);
    return () => {
      viva = false;
      clearTimeout(t);
    };
  }, [q]);
  const visibles = q.trim().length >= 2 ? lista : [];
  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 focus-within:border-brand">
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca un departamento, ciudad, localidad, barrio o puesto…" aria-label="Buscar un lugar" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>
      {visibles.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-2xl border border-border bg-surface p-1 shadow-xl">
          {visibles.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { setQ(""); setLista([]); alElegir(c.id); }} className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-surface-muted">
                <span className="text-sm font-semibold">{titulo(c.nombre)}</span>
                <span className="text-xs text-muted-foreground">{titulo(c.contexto)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lo que se puede elegir ahora, un nivel más abajo. */
function Elegir({ lugar, alElegir, compacto = false, valores }: { lugar: Lugar; alElegir: (id: string) => void; compacto?: boolean; /** Votos de María Fernanda por lugar: colorea cada uno según cuántos tuvo. */ valores?: Record<string, number> | null }) {
  const max = valores ? Math.max(0, ...Object.values(valores)) : 0;
  const [vista, setVista] = React.useState(0);
  const [filtro, setFiltro] = React.useState("");
  const [todo, setTodo] = React.useState(false);
  const v = lugar.vistas[Math.min(vista, lugar.vistas.length - 1)];
  if (!v) return null;
  const f = filtro.trim().toLowerCase();
  const items = f ? v.items.filter((i) => i.nombre.toLowerCase().includes(f)) : v.items;
  const ver = todo || f ? items : items.slice(0, LIMITE);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {lugar.vistas.length > 1 ? (
          <div role="tablist" className="flex gap-1.5">
            {lugar.vistas.map((x, i) => (
              <button key={x.clave} type="button" role="tab" aria-selected={i === vista} onClick={() => { setVista(i); setFiltro(""); setTodo(false); }} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${i === vista ? "bg-brand text-brand-foreground" : "text-muted-foreground ring-1 ring-border hover:text-foreground"}`}>{x.titulo} ({x.items.length})</button>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold">{v.titulo} <span className="font-normal text-muted-foreground">({v.items.length})</span></p>
        )}
        {v.items.length > 12 && <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar…" aria-label="Filtrar la lista" className="ml-auto w-44 rounded-full border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:border-brand" />}
      </div>
      <ul className={compacto ? "grid grid-cols-1 gap-2" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"}>
        {ver.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => alElegir(i.id)}
              style={valores ? { backgroundColor: valores[i.id] === undefined ? undefined : `color-mix(in srgb, var(--brand) ${Math.round(8 + 42 * Math.sqrt(max > 0 ? valores[i.id] / max : 0))}%, transparent)` } : undefined}
              className="flex h-full w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left transition hover:border-brand"
            >
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{titulo(i.nombre)}</span>{(i.detalle || valores?.[i.id] !== undefined) && <span className="block truncate text-xs text-muted-foreground">{valores?.[i.id] !== undefined ? <b className="text-foreground">{fmt(valores[i.id])} votos</b> : null}{valores?.[i.id] !== undefined && i.detalle ? " · " : ""}{i.detalle}</span>}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nada coincide con «{filtro}».</p>}
      {!todo && !f && items.length > LIMITE && <button type="button" onClick={() => setTodo(true)} className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold hover:bg-surface-muted">Ver los {items.length}</button>}
    </div>
  );
}

/** El mapa (donde lo hay) y la lista de lugares, ambos coloreados por los votos de María Fernanda Cabal. */
function Explorar({ lugar, alElegir }: { lugar: Lugar; alElegir: (id: string) => void }) {
  const mapa = mapaDe(lugar.id, lugar.nivel);
  const [eleccion, setEleccion] = React.useState("congreso-2022");
  const votos = usePeticion<{ votos: Record<string, number>; guardados: number; elecciones: { id: string; titulo: string }[] }>(`/api/admin/territorio/mapa?id=${encodeURIComponent(lugar.id)}&eleccion=${eleccion}`);
  const v = votos.estado === "listo" && votos.data.guardados > 0 ? votos.data : null;
  const barra = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold">Coloreado por los votos de María Fernanda Cabal en</span>
      {(votos.estado === "listo" ? votos.data.elecciones : [{ id: "congreso-2022", titulo: "Senado 2022" }, { id: "congreso-2018", titulo: "Senado 2018" }]).map((e) => (
        <button key={e.id} type="button" onClick={() => setEleccion(e.id)} className={`rounded-full px-3 py-1 font-semibold ${eleccion === e.id ? "bg-brand text-brand-foreground" : "ring-1 ring-border text-muted-foreground hover:text-foreground"}`}>{e.titulo}</button>
      ))}
      {votos.estado === "listo" && votos.data.guardados === 0 && <span className="text-muted-foreground">Aún no hay resultados guardados de esta elección para estos lugares (se cargan en Fuente de la verdad).</span>}
      {votos.estado === "error" && <span className="text-muted-foreground">{votos.error}</span>}
    </div>
  );
  if (!mapa) return <div className="space-y-3">{barra}<Elegir key={lugar.id} lugar={lugar} alElegir={alElegir} valores={v?.votos ?? null} /></div>;
  return (
    <div className="space-y-3">
      {barra}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <TerritorioMapa url={mapa.url} idDe={mapa.idDe} alElegir={alElegir} valores={v?.votos ?? null} />
        <div className="lg:max-h-[36rem] lg:overflow-y-auto lg:pr-1">
          <Elegir key={lugar.id} lugar={lugar} alElegir={alElegir} compacto valores={v?.votos ?? null} />
        </div>
      </div>
    </div>
  );
}

type Pestana = "votacion" | "conflicto" | "economia" | "seguidores" | "municipios";

export function TerritorioPanel({ snapshot, demo }: { snapshot: CrmSnapshot; demo: boolean }) {
  const [id, setId] = React.useState(leerLugar);
  const [version, setVersion] = React.useState(0);
  const [pestana, setPestana] = React.useState<Pestana>("votacion");
  const [fuentesAbiertas, setFuentesAbiertas] = React.useState(false);
  const datos = usePeticion<Respuesta>(`/api/admin/territorio?id=${encodeURIComponent(id)}&v=${version}`);

  const red = React.useMemo(() => buildNetwork(snapshot, leerCampos(), TODAS), [snapshot]);
  const d = datos.estado === "listo" ? datos.data : null;
  const lugar = d?.lugar ?? null;
  const ir = (nuevo: string) => {
    setId(nuevo);
    guardarLugar(nuevo);
    setPestana("votacion");
  };

  // Seguidores: el CRM ubica por departamento o municipio; en un barrio o puesto se muestran los del municipio.
  const seguidores = React.useMemo(() => {
    if (!lugar || lugar.nivel === "pais") return null;
    const m = lugar.municipio;
    return seguidoresEn(snapshot, red, m ? { nivel: "municipio", nombre: m.nombre, departamento: lugar.departamento?.nombre } : { nivel: "departamento", nombre: lugar.departamento!.nombre }, 8);
  }, [lugar, snapshot, red]);

  const nombreLugar = lugar ? titulo(lugar.nombre) : "";
  const hayInfo = !!lugar && lugar.nivel !== "pais";
  const bajo = lugar && (lugar.nivel === "localidad" || lugar.nivel === "barrio" || lugar.nivel === "puesto");
  const pestanas: [Pestana, string][] = [["votacion", "Votación"], ["conflicto", "Conflicto y problemas"], ["economia", "Economía y población"], ["seguidores", "Seguidores"], ...(d?.relacion ? ([["municipios", "Municipio por municipio"]] as [Pestana, string][]) : [])];

  return (
    <div className="space-y-4">
      <div className={`${tarjeta} space-y-4 p-5`}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><MapPinned className="size-5" /></span>
          <div>
            <h2 className="font-display text-lg font-semibold">Territorio</h2>
            <p className="text-sm text-muted-foreground">Elige un lugar, de lo general a lo particular. Cuando lo elijas verás cómo le fue a María Fernanda Cabal y a la oposición, el conflicto y tus seguidores allí.</p>
          </div>
        </div>
        <Buscador alElegir={ir} />

        {lugar && lugar.nivel !== "pais" && (
          <nav aria-label="Dónde estás" className="flex flex-wrap items-center gap-1 text-sm">
            {lugar.ruta.map((m, i) => (
              <React.Fragment key={m.id}>
                {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                {i === lugar.ruta.length - 1 ? <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">{titulo(m.nombre)}</span> : <button type="button" onClick={() => ir(m.id)} className="rounded-full px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-soft">{titulo(m.nombre)}</button>}
              </React.Fragment>
            ))}
            <span className="ml-2 text-xs text-muted-foreground">{NIVEL_TEXTO[lugar.nivel]}</span>
          </nav>
        )}

        {datos.estado === "cargando" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>}
        {datos.estado === "error" && <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{datos.error}</p>}

        {lugar?.nivel === "pais" && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ciudades principales</p>
              <div className="flex flex-wrap gap-2">{PRINCIPALES.map(([c, n]) => <button key={c} type="button" onClick={() => ir(c)} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-brand hover:bg-surface-muted">{n}</button>)}</div>
            </div>
            <Explorar lugar={lugar} alElegir={ir} />
          </div>
        )}
        {lugar && lugar.nivel !== "pais" && lugar.vistas.length > 0 && (
          <div className="border-t border-border pt-4"><Explorar key={lugar.id} lugar={lugar} alElegir={ir} /></div>
        )}
        {lugar?.puesto && (
          <div className="rounded-xl bg-surface-muted/70 p-4 text-sm">
            <p className="font-semibold">{nombreLugar}</p>
            <p className="text-muted-foreground">{lugar.puesto.direccion ? titulo(lugar.puesto.direccion) : "Sin dirección oficial"} · {lugar.puesto.mesas} mesas{lugar.puesto.barrio ? <> · barrio <button type="button" onClick={() => ir(lugar.puesto!.barrio!.id)} className="font-semibold text-brand hover:underline">{titulo(lugar.puesto.barrio.nombre)}</button></> : ""}</p>
          </div>
        )}
        {lugar?.cercanos && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Puestos más cercanos</p>
            <ul className="grid gap-2 sm:grid-cols-2">{lugar.cercanos.map((c) => <li key={c.id}><button type="button" onClick={() => ir(c.id)} className="w-full rounded-xl border border-border px-3 py-2 text-left hover:border-brand"><span className="block truncate text-sm font-semibold">{titulo(c.nombre)}</span><span className="text-xs text-muted-foreground">a {c.metros >= 1000 ? `${(c.metros / 1000).toFixed(1)} km` : `${c.metros} m`}</span></button></li>)}</ul>
          </div>
        )}
        {lugar && lugar.notas.map((n) => <p key={n} className="flex items-start gap-2 text-xs text-muted-foreground"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />{n}</p>)}
      </div>

      {hayInfo && d && (
        <div className={`${tarjeta} p-5`}>
          <div role="tablist" className="flex flex-wrap gap-1 border-b border-border">
            {pestanas.map(([k, t]) => <button key={k} type="button" role="tab" aria-selected={pestana === k} onClick={() => setPestana(k)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm ${pestana === k ? "border-brand font-semibold text-brand" : "border-transparent font-medium text-muted-foreground hover:text-foreground"}`}>{t}</button>)}
          </div>
          {d.error && <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">{d.error}</p>}

          <div className="mt-5">
            {pestana === "votacion" && !d.error && (
              <div className="space-y-3">
                {bajo && <p className="text-xs text-muted-foreground">{lugar!.nivel === "puesto" ? "Votos de este puesto." : lugar!.nivel === "barrio" ? "Suma de los puestos de votación del barrio." : "Suma de las zonas electorales de la localidad o comuna."}</p>}
                <VotosCabal elecciones={d.elecciones} lugar={nombreLugar} />
              </div>
            )}
            {pestana === "conflicto" && d.indicadores && (
              <div className="space-y-4">
                {bajo && lugar!.municipio && <p className="text-xs text-muted-foreground">Las cifras de conflicto existen por municipio, no por {lugar!.nivel === "barrio" ? "barrio" : lugar!.nivel === "puesto" ? "puesto" : "localidad"}: estas son las de {titulo(lugar!.municipio.nombre)}.</p>}
                <Conflicto ind={d.indicadores} alCargar={() => setVersion((v) => v + 1)} />
                <details className="rounded-xl border border-border p-3" open={fuentesAbiertas} onToggle={(e) => setFuentesAbiertas((e.currentTarget as HTMLDetailsElement).open)}>
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Database className="size-4 text-brand" /> Fuentes de estas cifras</summary>
                  <div className="mt-3">{fuentesAbiertas && <FuentesTerritorio alCargar={() => setVersion((v) => v + 1)} />}</div>
                </details>
              </div>
            )}
            {pestana === "economia" && <SocioeconomicoTerritorio key={lugar!.id} lugarId={lugar!.id} nombreLugar={nombreLugar} subnivel={!!bajo} />}
            {pestana === "seguidores" && seguidores && (
              <div className="space-y-2">
                {demo && <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />Son contactos de ejemplo (inventados). Cuando conectes Bitrix24 aquí aparecerán los reales.</p>}
                {bajo && <p className="text-xs text-muted-foreground">El CRM ubica a los contactos por municipio: se muestran los de {lugar!.municipio ? titulo(lugar!.municipio.nombre) : ""}.</p>}
                {!seguidores.hayCampo ? (
                  <p className="text-sm text-muted-foreground">El CRM no tiene un campo de departamento o municipio con el que ubicar a los contactos.</p>
                ) : seguidores.total === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no hay contactos del CRM en este lugar.</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground"><b className="text-foreground">{fmt(seguidores.total)}</b> contactos{seguidores.total > seguidores.seguidores.length ? `; estos son los ${seguidores.seguidores.length} con más influencia` : ""}.</p>
                    <ol className="grid gap-2 sm:grid-cols-2">
                      {seguidores.seguidores.map((s, i) => (
                        <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.nombre}</span><span className="block truncate text-xs text-muted-foreground">{s.municipio ? `${s.municipio} · ` : ""}trajo a {fmt(s.trajo)} · conectado con {fmt(s.conexiones)}</span></span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            )}
            {pestana === "municipios" && d.relacion && <RelacionTerritorio relacion={d.relacion} departamento={lugar!.nombre} />}
          </div>
        </div>
      )}
    </div>
  );
}
