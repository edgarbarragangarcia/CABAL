"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Building2, ChevronDown, CircleAlert, CircleCheck, ExternalLink, FileText, Info, Landmark, Search, TriangleAlert, User, Users } from "lucide-react";

import { formatoDocumento } from "@/lib/gov-data/secop/documento";
import { fechaCorta, pesos, pesosCorto } from "@/lib/gov-data/secop/formato";
import type { ClaseEstado, ContratoSecop, Ficha, Relaciones, RolContrato, Senal, Vinculo } from "@/lib/gov-data/secop/tipos";
import { consultaDe, type Navegar } from "./contratos-comun";
import { ContratosGrafo } from "./contratos-grafo";
import { KpiCard } from "./kpi-card";
import { titulo } from "./nombres";

const marco = "rounded-2xl border border-border bg-surface p-4 shadow-sm";
const tituloSeccion = "flex items-center gap-1.5 text-sm font-bold tracking-wide uppercase";

/* --------------------------------------------------------------- cabecera */

export function nombreDe(f: Ficha): string {
  return f.nombres[0]?.nombre ?? f.registros.find((r) => r.relacion === "propio")?.nombre ?? f.comoEntidad?.nombres[0] ?? "Sin nombre en el SECOP";
}

const TIPO = {
  persona: { texto: "Persona natural", Icono: User },
  empresa: { texto: "Empresa u organización", Icono: Building2 },
  indeterminado: { texto: "Persona o empresa", Icono: Users },
} as const;

function Cabecera({ f }: { f: Ficha }) {
  const { texto, Icono } = TIPO[f.tipo];
  const esNit = f.modo === "nit" || f.tipo === "empresa";
  const propio = f.registros.find((r) => r.relacion === "propio");
  const otros = f.nombres.slice(1, 4).map((n) => titulo(n.nombre));
  return (
    <div className="cabal-rise flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/25">
        <Icono className="size-7" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl font-extrabold tracking-tight [overflow-wrap:anywhere] sm:text-2xl">{titulo(nombreDe(f))}</h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold text-foreground ring-1 ring-border">
            {esNit ? "NIT" : "C.C."} {formatoDocumento(f.numero, esNit)}
          </span>
          <span>{texto}</span>
          {propio && (
            <span>
              · registrado como proveedor en SECOP II{propio.creado ? ` desde ${propio.creado.slice(0, 4)}` : ""}
              {propio.activo === false ? " (inactivo)" : ""}
            </span>
          )}
        </p>
        {otros.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">También figura como: {otros.join(" · ")}</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- indicadores */

export function Indicadores({ f }: { f: Ficha }) {
  const { contratista: c, representante: r, funcionario: u } = f.resumen;
  const { tope } = f;
  const mas = (n: number, alTope: boolean) => (alTope && n > 0 ? "+" : "");
  const vigentes = c.vigentes + r.vigentes;
  const valorVigente = c.valorVigente + r.valorVigente;
  return (
    <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      <KpiCard
        label="Como contratista"
        value={`${c.n}${mas(c.n, tope.contratista)}`}
        sub={c.n ? `${pesosCorto(c.valor)} · SECOP II ${c.porFuente["SECOP II"]} · SECOP I ${c.porFuente["SECOP I"]}${c.otros ? ` · ${c.otros} sin firmar o cancelados` : ""}` : c.otros ? `${c.otros} sin firmar o cancelados` : "sin contratos registrados"}
        icon={FileText}
        card="from-sky-500 to-indigo-600"
        glow="shadow-sky-500/30"
        delay={0}
      />
      <KpiCard
        label="Como representante legal"
        value={`${r.n}${mas(r.n, tope.representante)}`}
        sub={r.n ? `de otras empresas · ${pesosCorto(r.valor)}` : "no figura como representante"}
        icon={Building2}
        card="from-violet-500 to-fuchsia-600"
        glow="shadow-fuchsia-500/30"
        delay={80}
      />
      <KpiCard
        label="Como supervisor u ordenador"
        value={`${u.n}${mas(u.n, tope.funcionario)}`}
        sub={u.n ? "contratos de funcionarios (SECOP II)" : "no figura como funcionario"}
        icon={Landmark}
        card="from-amber-400 to-orange-600"
        glow="shadow-orange-500/30"
        delay={160}
      />
      <KpiCard
        label="Vigentes hoy"
        value={`${vigentes}${mas(vigentes, (tope.contratista && c.vigentes > 0) || (tope.representante && r.vigentes > 0))}`}
        sub={vigentes ? `${pesosCorto(valorVigente)} en ejecución` : "ninguno en ejecución"}
        icon={CircleCheck}
        card="from-emerald-500 to-teal-600"
        glow="shadow-emerald-500/30"
        delay={240}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- señales */

const NIVEL: Record<Senal["nivel"], { Icono: LucideIcon; caja: string; texto: string; etiqueta: string }> = {
  alerta: { Icono: TriangleAlert, caja: "bg-red-600/5 ring-red-600/25", texto: "text-red-700 dark:text-red-300", etiqueta: "Revisar" },
  aviso: { Icono: CircleAlert, caja: "bg-amber-500/10 ring-amber-500/30", texto: "text-amber-800 dark:text-amber-300", etiqueta: "Ojo" },
  info: { Icono: Info, caja: "bg-sky-500/10 ring-sky-500/25", texto: "text-sky-800 dark:text-sky-300", etiqueta: "Dato" },
};

export function Senales({ lista, max }: { lista: Senal[]; max?: number }) {
  if (lista.length === 0) return null;
  // Solo el título a la vista: el detalle se despliega al tocar (las alertas vienen abiertas).
  return (
    <ul className="space-y-1.5">
      {lista.slice(0, max).map((s) => {
        const { Icono, caja, texto, etiqueta } = NIVEL[s.nivel];
        return (
          <li key={s.titulo} className={`rounded-xl ring-1 ${caja}`}>
            <details className="group" open={s.nivel === "alerta"}>
              <summary className={`flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden ${texto}`}>
                <Icono className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{s.titulo}</span>
                <span className="rounded-full bg-surface/70 px-1.5 py-px text-[10px] font-bold tracking-wide uppercase">{etiqueta}</span>
                <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="px-3 pb-2.5 text-xs text-foreground/80">{s.detalle}</p>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------------------------------------------------------- relaciones */

type Lista = { clave: keyof Relaciones; titulo: string; Icono: LucideIcon; acento: string };

function listasPara(tipo: Ficha["tipo"]): Lista[] {
  const e = tipo === "empresa";
  return [
    { clave: "entidades", titulo: e ? "Entidades que la contratan" : "Entidades que lo contratan", Icono: Landmark, acento: "text-sky-600" },
    { clave: "empresas", titulo: e ? "Contratistas que la tienen como representante" : "Empresas que representa", Icono: Building2, acento: "text-violet-600" },
    { clave: "entidadesViaEmpresas", titulo: "Entidades que contratan a sus empresas", Icono: Landmark, acento: "text-sky-600" },
    { clave: "representantes", titulo: "Representantes legales", Icono: User, acento: "text-fuchsia-600" },
    { clave: "relacionadas", titulo: "Otras empresas con el mismo representante", Icono: Users, acento: "text-pink-600" },
    { clave: "funcionarios", titulo: "Funcionarios de sus contratos", Icono: Users, acento: "text-amber-600" },
    { clave: "supervisados", titulo: "A quiénes contrata o supervisa", Icono: Users, acento: "text-emerald-600" },
  ];
}

function FilaVinculo({ v, navegar }: { v: Vinculo; navegar: Navegar }) {
  const partes = [v.documento ? formatoDocumento(v.documento) : "sin documento", v.n > 0 ? `${v.n} contrato${v.n === 1 ? "" : "s"} · ${pesosCorto(v.valor)}` : "sin contratos registrados"];
  if (v.detalle) partes.push(v.detalle);
  return (
    <li className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{titulo(v.nombre) || "Sin nombre"}</p>
        <p className="truncate text-[11px] text-muted-foreground">{partes.join(" · ")}</p>
      </div>
      {v.documento && (
        <button
          type="button"
          onClick={() => navegar(consultaDe(v.documento!))}
          aria-label={`Abrir la ficha de ${titulo(v.nombre)}`}
          title="Abrir su ficha"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-muted text-muted-foreground ring-1 ring-border transition hover:text-foreground hover:ring-emerald-500/50"
        >
          <Search className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

function TarjetaLista({ l, items, navegar }: { l: Lista; items: Vinculo[]; navegar: Navegar }) {
  const [todo, setTodo] = React.useState(false);
  const visibles = todo ? items : items.slice(0, 5);
  return (
    <section className={marco}>
      <h4 className={tituloSeccion}>
        <l.Icono className={`size-4 ${l.acento}`} aria-hidden="true" /> {l.titulo}
        <span className="ml-auto rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{items.length}</span>
      </h4>
      <ul className="mt-1 divide-y divide-border">
        {visibles.map((v) => (
          <FilaVinculo key={v.clave} v={v} navegar={navegar} />
        ))}
      </ul>
      {items.length > 5 && (
        <button type="button" onClick={() => setTodo((t) => !t)} className="mt-1 text-xs font-semibold text-brand hover:underline">
          {todo ? "Ver menos" : `Ver los ${items.length}`}
        </button>
      )}
    </section>
  );
}

function Relaciones_({ f, navegar }: { f: Ficha; navegar: Navegar }) {
  const listas = listasPara(f.tipo).filter((l) => f.relaciones[l.clave].length > 0);
  const entidad = f.comoEntidad;
  if (listas.length === 0 && !entidad) return null;
  return (
    <section className="space-y-3">
      <h4 className={tituloSeccion}>
        <Users className="size-4 text-brand" aria-hidden="true" /> Con quién se relaciona
      </h4>
      <ContratosGrafo f={f} navegar={navegar} />
      {entidad && (
        <div className={marco}>
          <h4 className={tituloSeccion}>
            <Landmark className="size-4 text-sky-600" aria-hidden="true" /> Como entidad contratante
          </h4>
          <p className="mt-1 text-sm">
            {entidad.nombres.length > 0 ? `${entidad.nombres.map(titulo).join("; ")}: ` : ""}
            <b>{entidad.n.toLocaleString("es-CO")}</b> contratos en SECOP II por <b>{pesosCorto(entidad.valor)}</b>.
          </p>
          {entidad.contratistas.length > 0 && (
            <>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Principales contratistas por valor</p>
              <ul className="divide-y divide-border">
                {entidad.contratistas.map((v) => (
                  <FilaVinculo key={v.clave} v={v} navegar={navegar} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
        {listas.map((l) => (
          <TarjetaLista key={l.clave} l={l} items={f.relaciones[l.clave]} navegar={navegar} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ contratos */

export const ESTADO: Record<ClaseEstado, { texto: string; clase: string }> = {
  vigente: { texto: "Vigente", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  por_cerrar: { texto: "Plazo vencido", clase: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  terminado: { texto: "Terminado", clase: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  no_firmado: { texto: "Sin firmar", clase: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  cancelado: { texto: "Cancelado", clase: "bg-red-500/10 text-red-700 dark:text-red-300" },
};

const ROL: Record<RolContrato, string | null> = {
  contratista: null,
  representante: "Representante legal",
  supervisor: "Supervisor",
  ordenador_gasto: "Ordenador del gasto",
  ordenador_pago: "Ordenador de pago",
};

function Persona({ rotulo, p }: { rotulo: string; p: { nombre: string; documento: string | null } | null }) {
  if (!p) return null;
  return (
    <p>
      <span className="text-muted-foreground">{rotulo}: </span>
      {titulo(p.nombre) || "—"}
      {p.documento ? ` (${formatoDocumento(p.documento)})` : ""}
    </p>
  );
}

function FilaContrato({ c }: { c: ContratoSecop }) {
  const e = ESTADO[c.clase];
  const roles = c.roles.map((r) => ROL[r]).filter(Boolean);
  return (
    <li className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.clase}`} title={`Estado que reporta la entidad: ${c.estado || "sin dato"}`}>
          {e.texto}
        </span>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">{c.fuente}</span>
        {roles.map((r) => (
          <span key={r} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
            {r}
          </span>
        ))}
        {c.nombreDistinto && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">A otro nombre</span>}
        <span className="text-[11px] text-muted-foreground">{fechaCorta(c.fechaFirma)}</span>
        <span className="ml-auto text-sm font-semibold tabular-nums">{c.valorAtipico ? <span className="text-amber-700 dark:text-amber-300">Valor no confiable</span> : c.valor === null ? "—" : pesos(c.valor)}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm">{c.objeto || "Sin objeto registrado"}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{[titulo(c.entidad), c.ubicacion].filter(Boolean).join(" · ")}</p>
      <details className="mt-1.5 text-xs">
        <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">Detalle</summary>
        <div className="mt-2 grid gap-x-6 gap-y-1 @xl:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Contratista: </span>
            {titulo(c.contratista.nombre) || "—"}
            {c.contratista.documento ? ` (${formatoDocumento(c.contratista.documento)})` : ""}
          </p>
          <Persona rotulo="Representante legal" p={c.representante} />
          <Persona rotulo="Ordenador del gasto" p={c.ordenadorGasto} />
          <Persona rotulo="Supervisor" p={c.supervisor} />
          <Persona rotulo="Ordenador de pago" p={c.ordenadorPago} />
          <p>
            <span className="text-muted-foreground">Tipo: </span>
            {c.tipo || "—"} · {c.modalidad || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Plazo: </span>
            {fechaCorta(c.fechaInicio)} → {fechaCorta(c.fechaFin)}
          </p>
          <p>
            <span className="text-muted-foreground">Estado reportado: </span>
            {c.estado || "—"}
          </p>
          {c.referencia && (
            <p>
              <span className="text-muted-foreground">Referencia: </span>
              {c.referencia}
            </p>
          )}
        </div>
        {c.objeto.length > 120 && <p className="mt-2">{c.objeto}</p>}
        {c.url && (
          <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
            Ver el proceso en el {c.fuente} <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </details>
    </li>
  );
}

type Vista = "contratista" | "representante" | "funcionario";
type FiltroEstado = "todos" | "vigentes" | "terminados" | "otros";

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${activo ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow" : "bg-surface-muted text-muted-foreground ring-1 ring-border hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

const POR_PAGINA = 12;
const VISTAS = [["resumen", "Resumen"], ["relaciones", "Relaciones"], ["contratos", "Contratos"]] as const;

const SIN_CONTRATOS: ContratoSecop[] = [];
const listaDe = (f: Ficha, v: Vista): ContratoSecop[] => (v === "contratista" ? f.contratos : v === "representante" ? f.comoRepresentante : f.comoFuncionario);
const ROTULO_VISTA: Record<Vista, string> = { contratista: "Como contratista", representante: "Como representante legal", funcionario: "Como supervisor u ordenador" };

function ListaContratos({ f }: { f: Ficha }) {
  const disponibles = (["contratista", "representante", "funcionario"] as const).filter((v) => listaDe(f, v).length > 0);

  const [vista, setVista] = React.useState<Vista>("contratista");
  const [estado, setEstado] = React.useState<FiltroEstado>("todos");
  const [orden, setOrden] = React.useState<"reciente" | "valor">("reciente");
  const [busqueda, setBusqueda] = React.useState("");
  const [limite, setLimite] = React.useState(POR_PAGINA);

  const activa = disponibles.includes(vista) ? vista : disponibles[0];
  const lista = activa ? listaDe(f, activa) : SIN_CONTRATOS;

  const filtrados = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const pasa = (c: ContratoSecop) =>
      (estado === "todos" ||
        (estado === "vigentes" && (c.clase === "vigente" || c.clase === "por_cerrar")) ||
        (estado === "terminados" && c.clase === "terminado") ||
        (estado === "otros" && (c.clase === "no_firmado" || c.clase === "cancelado"))) &&
      (!q || `${c.objeto} ${c.entidad} ${c.contratista.nombre} ${c.referencia}`.toLowerCase().includes(q));
    const l = lista.filter(pasa);
    return orden === "valor" ? [...l].sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1)) : l;
  }, [lista, estado, orden, busqueda]);

  if (disponibles.length === 0) return null;
  const cambiar = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setLimite(POR_PAGINA);
  };

  return (
    <section className="space-y-3">
      <h4 className={tituloSeccion}>
        <FileText className="size-4 text-brand" aria-hidden="true" /> Contratos
      </h4>
      <div className="flex flex-wrap gap-2">
        {disponibles.map((id) => (
          <Chip key={id} activo={activa === id} onClick={() => cambiar(setVista)(id)}>
            {ROTULO_VISTA[id]} ({listaDe(f, id).length}
            {f.tope[id] ? "+" : ""})
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["todos", "Todos"],
            ["vigentes", "Vigentes"],
            ["terminados", "Terminados"],
            ["otros", "Sin firmar o cancelados"],
          ] as const
        ).map(([id, rotulo]) => (
          <Chip key={id} activo={estado === id} onClick={() => cambiar(setEstado)(id)}>
            {rotulo}
          </Chip>
        ))}
        <input
          value={busqueda}
          onChange={(e) => cambiar(setBusqueda)(e.target.value)}
          placeholder="Buscar en objeto, entidad o contratista"
          aria-label="Buscar en los contratos"
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/40 @xl:max-w-xs"
        />
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as "reciente" | "valor")}
          aria-label="Ordenar contratos"
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/40"
        >
          <option value="reciente">Más recientes</option>
          <option value="valor">Mayor valor</option>
        </select>
      </div>
      {filtrados.length === 0 ? (
        <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted-foreground">Ningún contrato cumple este filtro.</p>
      ) : (
        <ul className="space-y-2">
          {filtrados.slice(0, limite).map((c) => (
            <FilaContrato key={`${c.fuente}:${c.id}:${c.roles.join()}`} c={c} />
          ))}
        </ul>
      )}
      {filtrados.length > limite && (
        <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)} className="w-full rounded-full border border-border py-1.5 text-xs font-semibold hover:bg-surface-muted">
          Ver más ({filtrados.length - limite} restantes)
        </button>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------------- ficha */

/** `sinCabecera`: en el expediente del aspirante su nombre ya está arriba. */
export function FichaContratos({ f, navegar, sinCabecera = false }: { f: Ficha; navegar: Navegar; sinCabecera?: boolean }) {
  const [vista, setVista] = React.useState<"resumen" | "relaciones" | "contratos">("resumen");
  const nRel = Object.values(f.relaciones).reduce((n, l) => n + l.length, 0) + (f.comoEntidad ? 1 : 0);
  const nCont = f.contratos.length + f.comoRepresentante.length + f.comoFuncionario.length;
  return (
    <div className="space-y-4">
      {!sinCabecera && <Cabecera f={f} />}
      <div role="tablist" aria-label="Qué ver" className="flex flex-wrap gap-2">
        {VISTAS.map(([id, rotulo]) => (
          <Chip key={id} activo={vista === id} onClick={() => setVista(id)}>
            {rotulo}
            {id === "relaciones" ? ` (${nRel})` : id === "contratos" ? ` (${nCont})` : ""}
          </Chip>
        ))}
      </div>
      {vista === "resumen" && (
        <div className="space-y-4">
          <Indicadores f={f} />
          <Senales lista={f.senales} />
        </div>
      )}
      {vista === "relaciones" && (nRel > 0 ? <Relaciones_ f={f} navegar={navegar} /> : <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted-foreground">No hay relaciones registradas para este documento.</p>)}
      {vista === "contratos" && (nCont > 0 ? <ListaContratos f={f} /> : <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted-foreground">No hay contratos registrados para este documento.</p>)}

      <details className="rounded-2xl border border-border p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-muted-foreground">Fuentes consultadas ({f.fuentes.length})</summary>
        <ul className="mt-2 space-y-1">
          {f.fuentes.map((s, i) => (
            <li key={`${s.id}-${i}`} className={s.ok ? "text-muted-foreground" : "text-red-700 dark:text-red-300"}>
              {s.ok ? "✓" : "✗"} {s.titulo}: {s.ok ? `${s.n} registro${s.n === 1 ? "" : "s"}${s.truncado ? " (tope de consulta)" : ""}` : s.error} · {s.ms} ms
            </li>
          ))}
        </ul>
      </details>

      <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Datos abiertos de contratación pública (SECOP I y II, Colombia Compra Eficiente, vía datos.gov.co), consultados el{" "}
        {new Date(f.generadoEn).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" })}. Los cargan las propias entidades y pueden traer errores de digitación,
        homónimos y valores mal escritos (los absurdos se descartan de los totales). No es un certificado ni prueba de ninguna inhabilidad: verifica cada contrato en el SECOP antes de decidir.
      </p>
    </div>
  );
}
