"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Database, Flame, Loader2, MapPinned, Network as NetworkIcon, Scale, ShieldAlert, TriangleAlert, Users, Vote } from "lucide-react";

import { buildNetwork, type Mapping } from "@/lib/crm/network";
import { seguidoresEn } from "@/lib/crm/seguidores";
import { DIMENSIONS, type CrmSnapshot } from "@/lib/crm/types";
import type { Indicadores, ItemIndicador } from "@/lib/territorio/indicadores";
import { GRUPOS, type Grupo } from "@/lib/territorio/catalogo";
import type { Lugar } from "@/lib/territorio/lugares";
import type { Relacion } from "@/lib/territorio/relacion";
import type { EleccionLugar, FilaRanking } from "@/lib/territorio/votacion";
import { titulo } from "./nombres";
import { usePeticion } from "./peticion";
import { RelacionTerritorio } from "./territorio-relacion";
import { FuentesTerritorio } from "./territorio-fuentes";

/**
 * Territorio: elige un departamento o municipio y ves cómo le fue a María Fernanda Cabal y a la oposición, qué conflicto armado y qué
 * problemas hay, la relación entre ambos municipio por municipio y quiénes son tus principales seguidores allí (del CRM). Todo sale de
 * Supabase; las cifras del conflicto se cargan desde datos.gov.co con el panel de fuentes de abajo.
 */

type Lista = { departamentos: { dane: string; nombre: string }[]; municipios: { dane: string; nombre: string; dep: string }[] };
type Respuesta = { lugar: Lugar; elecciones: EleccionLugar[]; indicadores: Indicadores; relacion: Relacion | null };

const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";
const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const dec = (n: number, d = 1) => n.toLocaleString("es-CO", { maximumFractionDigits: d, minimumFractionDigits: d });
const CLAVE_LUGAR = "el-admin-territorio-v1";
const CLAVE_CAMPOS = "el-admin-red-crm-campos-v1";
const TODAS: ReadonlySet<(typeof DIMENSIONS)[number]> = new Set(DIMENSIONS);

function leerLugar(): { dep: string; muni: string } {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_LUGAR) ?? "null") as { dep?: string; muni?: string } | null;
    if (v?.dep) return { dep: v.dep, muni: v.muni ?? "" };
  } catch {
    /* sin almacenamiento: se arranca en Bolívar */
  }
  return { dep: "13", muni: "" };
}

function guardarLugar(dep: string, muni: string) {
  try {
    localStorage.setItem(CLAVE_LUGAR, JSON.stringify({ dep, muni }));
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

function Tarjeta({ icono: Icono, etiqueta, valor, sub, estilo }: { icono: React.ComponentType<{ className?: string }>; etiqueta: string; valor: string; sub: string; estilo: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${estilo} p-4 text-white shadow-lg`}>
      <div aria-hidden="true" className="absolute -right-6 -bottom-8 size-24 rounded-full bg-white/15" />
      <div className="relative flex items-center justify-between"><p className="text-xs font-medium text-white/85">{etiqueta}</p><span className="grid size-8 place-items-center rounded-xl bg-white/20 backdrop-blur"><Icono className="size-4" /></span></div>
      <p className="relative mt-3 text-2xl font-bold tracking-tight tabular-nums">{valor}</p>
      <p className="relative mt-0.5 text-xs text-white/80">{sub}</p>
    </div>
  );
}

function Etiqueta({ children, tono }: { children: React.ReactNode; tono: "cabal" | "oposicion" }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tono === "cabal" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300"}`}>{children}</span>;
}

function FilaPartido({ p, maximo }: { p: FilaRanking; maximo: number }) {
  return (
    <li className="space-y-1">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate font-medium">{titulo(p.nombre)}</span>
        {p.esCabal && <Etiqueta tono="cabal">CABAL</Etiqueta>}
        {p.esOposicion && <Etiqueta tono="oposicion">OPOSICIÓN</Etiqueta>}
        <span className="tabular-nums text-muted-foreground">{fmt(p.votos)}</span>
        <span className="w-14 text-right font-semibold tabular-nums">{dec(p.pct)} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full" style={{ width: `${maximo > 0 ? Math.max(1.5, (p.votos / maximo) * 100) : 0}%`, background: p.color || "#64748b" }} /></div>
    </li>
  );
}

/** El ranking de una elección en el lugar: María Fernanda, la oposición y los demás partidos y candidatos. */
function Votacion({ e, lugar }: { e: EleccionLugar; lugar: string }) {
  if (!e.guardado) return <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"><TriangleAlert className="mt-0.5 size-4 shrink-0" />El resultado de {e.titulo} para {lugar} todavía no está guardado en Supabase (se guarda en Análisis &gt; Datos electorales).</p>;
  if (e.noPublicado) return <p className="rounded-xl bg-surface-muted/70 px-4 py-3 text-sm text-muted-foreground">La Registraduría no publica resultados de {e.titulo} para {lugar}.</p>;
  const esLista = e.corporacion !== "PR";
  const maximo = Math.max(...e.partidos.map((p) => p.votos), 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-sky-400/40 bg-sky-500/5 p-4">
          <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-sky-700 uppercase dark:text-sky-300"><Vote className="size-3.5" /> María Fernanda Cabal</p>
          {e.cabal ? (
            <>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">{fmt(e.cabal.votos)} <span className="text-sm font-medium text-muted-foreground">votos · {dec(e.cabal.pct, 2)} % de los válidos</span></p>
              <p className="mt-0.5 text-sm text-muted-foreground">Puesto <b className="text-foreground">{e.cabal.puesto}</b> entre {fmt(e.cabal.de)} candidatos con votos en {lugar}.</p>
            </>
          ) : esLista ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{e.listaCerrada ? "Su partido fue con lista cerrada: solo hay votos por la lista, no por cada candidato." : "No aparece con votos propios en este lugar."}</p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground">No fue candidata en esta elección.</p>
          )}
          {e.partidoCabal && <p className="mt-1.5 text-sm">Su partido, <b>{titulo(e.partidoCabal.nombre)}</b>: {dec(e.partidoCabal.pct)} % ({fmt(e.partidoCabal.votos)} votos), puesto {e.partidoCabal.puesto}.</p>}
        </div>
        <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/5 p-4">
          <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-fuchsia-700 uppercase dark:text-fuchsia-300"><Scale className="size-3.5" /> La oposición</p>
          {e.oposicion ? (
            <>
              <p className="mt-1.5 text-2xl font-bold tabular-nums">{dec(e.oposicion.pct)} % <span className="text-sm font-medium text-muted-foreground">· {fmt(e.oposicion.votos)} votos · puesto {e.oposicion.puesto}</span></p>
              <p className="mt-0.5 text-sm text-muted-foreground">{e.oposicion.partidos.map(titulo).join(" + ")}</p>
              {e.ventajaOposicion !== null && e.partidoCabal && <p className="mt-1.5 text-sm">Frente al {titulo(e.partidoCabal.nombre)}: <b className={e.ventajaOposicion >= 0 ? "text-fuchsia-700 dark:text-fuchsia-300" : "text-sky-700 dark:text-sky-300"}>{e.ventajaOposicion >= 0 ? "+" : "−"}{dec(Math.abs(e.ventajaOposicion))} puntos</b> {e.ventajaOposicion >= 0 ? "a favor de la oposición" : "a favor del partido de María Fernanda"}.</p>}
            </>
          ) : <p className="mt-1.5 text-sm text-muted-foreground">No hay lista de la oposición con votos en este lugar.</p>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{esLista ? "Partidos" : "Candidatos"} · {fmt(e.validos)} votos válidos</p>
          <ol className="space-y-2.5">{e.partidos.slice(0, esLista ? 10 : 6).map((p) => <FilaPartido key={`${p.codigo}-${p.nombre}`} p={p} maximo={maximo} />)}</ol>
        </div>
        {esLista && e.candidatos.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Candidatos más votados</p>
            <ol className="space-y-1.5 text-sm">
              {e.candidatos.map((k, i) => (
                <li key={`${k.nombre}-${i}`} className="flex items-baseline gap-2">
                  <span className="w-5 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1"><span className="truncate font-medium">{titulo(k.nombre)}</span> <span className="text-xs text-muted-foreground">· {titulo(k.partido)}</span></span>
                  {k.esCabal && <Etiqueta tono="cabal">CABAL</Etiqueta>}
                  {k.esOposicion && <Etiqueta tono="oposicion">OPOSICIÓN</Etiqueta>}
                  <span className="font-semibold tabular-nums">{fmt(k.votos)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

/** Cómo le fue a María Fernanda y a la oposición en cada elección, para ver el cambio de una a otra. */
function Evolucion({ elecciones }: { elecciones: EleccionLugar[] }) {
  const con = elecciones.filter((e) => e.guardado && !e.noPublicado && e.oposicion);
  if (con.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="border-b border-border bg-surface-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr><th className="px-3 py-2.5 font-semibold">Elección</th><th className="px-3 py-2.5 font-semibold">María Fernanda / su partido</th><th className="px-3 py-2.5 font-semibold">Oposición</th><th className="px-3 py-2.5 text-right font-semibold">Diferencia</th></tr>
        </thead>
        <tbody>
          {con.map((e) => (
            <tr key={e.id} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2 font-medium">{e.titulo}</td>
              <td className="px-3 py-2">
                {e.cabal ? <>{dec(e.cabal.pct, 2)} % <span className="text-xs text-muted-foreground">({fmt(e.cabal.votos)} votos, puesto {e.cabal.puesto})</span></> : e.partidoCabal ? <>{dec(e.partidoCabal.pct)} % <span className="text-xs text-muted-foreground">({titulo(e.partidoCabal.nombre).replace("Partido ", "")}{e.listaCerrada ? ", lista cerrada" : ""})</span></> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-3 py-2">{dec(e.oposicion!.pct)} % <span className="text-xs text-muted-foreground">(puesto {e.oposicion!.puesto})</span></td>
              <td className="px-3 py-2 text-right tabular-nums">{e.ventajaOposicion === null ? <span className="text-muted-foreground">—</span> : <b className={e.ventajaOposicion >= 0 ? "text-fuchsia-700 dark:text-fuchsia-300" : "text-sky-700 dark:text-sky-300"}>{e.ventajaOposicion >= 0 ? "+" : "−"}{dec(Math.abs(e.ventajaOposicion))} pts</b>}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function Seccion({ icono: Icono, titulo: t, sub, children }: { icono: React.ComponentType<{ className?: string }>; titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className={`${tarjeta} p-5`}>
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><Icono className="size-5 text-brand" aria-hidden="true" /> {t}</h3>
      {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function TerritorioPanel({ snapshot, demo }: { snapshot: CrmSnapshot; demo: boolean }) {
  const [{ dep, muni }, setLugar] = React.useState(leerLugar);
  const [version, setVersion] = React.useState(0);
  const [eleccionId, setEleccionId] = React.useState<string>("");
  const [fuentesAbiertas, setFuentesAbiertas] = React.useState(false);
  const lista = usePeticion<Lista>("/api/admin/territorio/lugares");
  const dane = muni || dep;
  const datos = usePeticion<Respuesta>(dep ? `/api/admin/territorio?dane=${dane}&v=${version}` : null);

  const red = React.useMemo(() => buildNetwork(snapshot, leerCampos(), TODAS), [snapshot]);
  const d = datos.estado === "listo" ? datos.data : null;
  const seguidores = React.useMemo(
    () => (d ? seguidoresEn(snapshot, red, { nivel: d.lugar.nivel, nombre: d.lugar.nombre, departamento: d.lugar.departamento?.nombre }, 8) : null),
    [d, snapshot, red]
  );

  const cambiar = (nuevoDep: string, nuevoMuni = "") => {
    setLugar({ dep: nuevoDep, muni: nuevoMuni });
    guardarLugar(nuevoDep, nuevoMuni);
  };
  const municipios = lista.estado === "listo" ? lista.data.municipios.filter((m) => m.dep === dep) : [];
  const eleccion = d?.elecciones.find((e) => e.id === eleccionId) ?? d?.elecciones[0];
  const nombreLugar = d ? (d.lugar.nivel === "municipio" ? `${d.lugar.nombre}, ${d.lugar.departamento?.nombre}` : d.lugar.nombre) : "";

  // Las cuatro tarjetas de arriba: lo más reciente de cada cosa.
  const senado2022 = d?.elecciones.find((e) => e.id === "congreso-2022");
  const cabalReciente = d?.elecciones.find((e) => e.cabal && e.guardado);
  const presidencia = d?.elecciones.find((e) => e.id === "presidencia-2026-2v");
  const victimas = d?.indicadores.items.find((i) => i.clave === "victimas_total");

  return (
    <div className="space-y-5">
      <div className={`${tarjeta} p-5`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><MapPinned className="size-6" /></span>
          <div className="min-w-[min(100%,16rem)] flex-1">
            <h2 className="font-display text-lg font-semibold">Territorio: votación, conflicto y seguidores</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Elige un lugar para ver cómo le fue a María Fernanda Cabal y a la oposición, qué conflicto armado y qué problemas hay, cómo se relacionan municipio por municipio y quiénes son tus principales seguidores allí.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><span className="font-semibold">Departamento</span>
            <select value={dep} onChange={(e) => cambiar(e.target.value)} disabled={lista.estado !== "listo"} className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold outline-none focus:border-brand">
              {lista.estado === "listo" ? lista.data.departamentos.map((x) => <option key={x.dane} value={x.dane}>{x.nombre}</option>) : <option>Cargando…</option>}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><span className="font-semibold">Municipio</span>
            <select value={muni} onChange={(e) => cambiar(dep, e.target.value)} disabled={lista.estado !== "listo"} className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold outline-none focus:border-brand">
              <option value="">Todo el departamento</option>
              {municipios.map((m) => <option key={m.dane} value={m.dane}>{m.nombre}</option>)}
            </select>
          </label>
          {datos.estado === "cargando" && <Loader2 className="size-4 animate-spin text-brand" aria-label="Cargando" />}
        </div>
      </div>

      {datos.estado === "error" && <p className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{datos.error}</p>}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tarjeta icono={Users} etiqueta="Población" valor={d.indicadores.poblacion ? fmt(d.indicadores.poblacion) : "—"} sub={`${nombreLugar} · DANE ${d.indicadores.anioPoblacion}`} estilo="from-emerald-500 to-teal-600" />
            <Tarjeta icono={Vote} etiqueta="María Fernanda Cabal" valor={cabalReciente?.cabal ? fmt(cabalReciente.cabal.votos) : "—"} sub={cabalReciente?.cabal ? `${cabalReciente.titulo}: ${dec(cabalReciente.cabal.pct, 2)} %, puesto ${cabalReciente.cabal.puesto}` : senado2022?.guardado ? "Sin votos propios en este lugar" : "Sin datos guardados"} estilo="from-sky-500 to-indigo-600" />
            <Tarjeta icono={Scale} etiqueta="Oposición (2ª vuelta 2026)" valor={presidencia?.oposicion ? `${dec(presidencia.oposicion.pct)} %` : "—"} sub={presidencia?.oposicion ? `Puesto ${presidencia.oposicion.puesto} de ${presidencia.partidos.length}` : "Sin datos guardados"} estilo="from-fuchsia-500 to-rose-600" />
            <Tarjeta icono={Flame} etiqueta="Víctimas del conflicto" valor={victimas ? fmt(victimas.valor) : "—"} sub={victimas?.tasa ? `${fmt(victimas.tasa.cantidad)} por 1.000 hab.${victimas.veces ? ` · ${dec(victimas.veces)} × el país` : ""}` : "Sin cifras cargadas"} estilo="from-amber-400 to-orange-600" />
          </div>

          <Seccion icono={Vote} titulo={`Votación en ${nombreLugar}`} sub="Ranking de partidos y candidatos, con María Fernanda y la oposición señaladas. Se lee de los resultados guardados en Supabase.">
            <div className="space-y-4">
              <div role="tablist" aria-label="Elección" className="flex flex-wrap gap-1.5">
                {d.elecciones.map((e) => (
                  <button key={e.id} type="button" role="tab" aria-selected={eleccion?.id === e.id} onClick={() => setEleccionId(e.id)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${eleccion?.id === e.id ? "bg-brand text-brand-foreground shadow" : "text-muted-foreground ring-1 ring-border hover:text-foreground"}`}>{e.titulo}</button>
                ))}
              </div>
              {eleccion && <Votacion e={eleccion} lugar={nombreLugar} />}
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cómo le fue a la oposición, elección por elección</p>
                <Evolucion elecciones={d.elecciones} />
                <p className="mt-2 text-[11px] text-muted-foreground">La oposición se toma como el Pacto Histórico (y su lista de 2018, la Lista de la Decencia). En 2026 el Centro Democrático fue con lista cerrada: no hay votos por candidato.</p>
              </div>
            </div>
          </Seccion>

          <Seccion icono={Flame} titulo="Conflicto armado y problemas" sub={`Cifras oficiales de ${nombreLugar}, guardadas en Supabase desde datos.gov.co, comparadas con el promedio del país.`}>
            <Conflicto ind={d.indicadores} alCargar={() => setVersion((v) => v + 1)} />
          </Seccion>

          {d.relacion && (
            <Seccion icono={Scale} titulo={`Relación en los municipios de ${d.lugar.nombre}`} sub="Cómo votó cada municipio frente a cuánto conflicto tiene. Elige una columna para ordenar.">
              <RelacionTerritorio relacion={d.relacion} departamento={d.lugar.nombre} />
            </Seccion>
          )}

          <Seccion icono={NetworkIcon} titulo={`Tus principales seguidores en ${nombreLugar}`} sub="Los contactos del CRM que viven aquí, ordenados por a cuánta gente trajeron y con cuántos están conectados (la red de abajo).">
            {demo && <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />Son contactos de ejemplo (inventados). Cuando conectes Bitrix24 aquí aparecerán los reales.</p>}
            {!seguidores ? null : !seguidores.hayCampo ? (
              <p className="text-sm text-muted-foreground">El CRM no tiene un campo de {d.lugar.nivel === "departamento" ? "departamento" : "municipio"} con el que ubicar a los contactos.</p>
            ) : seguidores.total === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay contactos del CRM en {nombreLugar}.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground"><b className="text-foreground">{fmt(seguidores.total)}</b> contactos en {nombreLugar}{seguidores.total > seguidores.seguidores.length ? `; estos son los ${seguidores.seguidores.length} con más influencia` : ""}.</p>
                <ol className="grid gap-2 sm:grid-cols-2">
                  {seguidores.seguidores.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.nombre}</span><span className="block truncate text-xs text-muted-foreground">{s.municipio ? `${s.municipio} · ` : ""}trajo a {fmt(s.trajo)} · conectado con {fmt(s.conexiones)}</span></span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Seccion>

          <details className={`${tarjeta} p-5`} open={fuentesAbiertas} onToggle={(e) => setFuentesAbiertas((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="flex cursor-pointer items-center gap-2 font-display text-base font-semibold"><Database className="size-4 text-brand" /> Fuentes de las cifras del territorio</summary>
            <div className="mt-4">{fuentesAbiertas && <FuentesTerritorio alCargar={() => setVersion((v) => v + 1)} />}</div>
          </details>
        </>
      )}
    </div>
  );
}
