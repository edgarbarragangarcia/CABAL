"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowLeft, Building2, FileText, IdCard, Landmark, Loader2, ScrollText, Search, User, Users } from "lucide-react";

import { entradaDocumento, formatoDocumento } from "@/lib/gov-data/secop/documento";
import type { Candidato, RespuestaBusqueda, RolContrato } from "@/lib/gov-data/secop/tipos";
import { consultaDe, type Consulta, type Navegar } from "./contratos-comun";
import { FichaContratos } from "./contratos-ficha";
import { KpiCard } from "./kpi-card";
import { titulo } from "./nombres";
import { usePeticion } from "./peticion";

const marco = "rounded-2xl border border-border bg-surface p-4 shadow-sm";

const MODOS: { id: Consulta["modo"]; rotulo: string; placeholder: string; Icono: LucideIcon }[] = [
  { id: "cedula", rotulo: "Cédula", placeholder: "Número de cédula", Icono: IdCard },
  { id: "nit", rotulo: "NIT", placeholder: "NIT, con o sin dígito de verificación", Icono: Building2 },
  { id: "nombre", rotulo: "Nombre", placeholder: "Nombre de la persona o de la empresa", Icono: User },
];

/** Lo que cubre la consulta: se muestra en colores vivos antes de buscar a alguien. */
const QUE_INCLUYE: { label: string; value: string; sub: string; icon: LucideIcon; card: string; glow: string }[] = [
  { label: "SECOP II", value: "Contratos", sub: "electrónicos · 2015 → hoy", icon: FileText, card: "from-sky-500 to-indigo-600", glow: "shadow-sky-500/30" },
  { label: "SECOP I", value: "Procesos", sub: "compra pública · histórico", icon: ScrollText, card: "from-amber-400 to-orange-600", glow: "shadow-orange-500/30" },
  { label: "Proveedores", value: "Registro", sub: "quién representa a quién", icon: Building2, card: "from-violet-500 to-fuchsia-600", glow: "shadow-fuchsia-500/30" },
  { label: "Relaciones", value: "Red", sub: "empresas, entidades, funcionarios", icon: Users, card: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/30" },
];

const ROL_TEXTO: Record<RolContrato, string> = {
  contratista: "contratista",
  representante: "representante legal",
  supervisor: "supervisor",
  ordenador_gasto: "ordenador del gasto",
  ordenador_pago: "ordenador de pago",
};

/* --------------------------------------------------------------- candidatos */

function Candidatos({ r, navegar }: { r: Extract<RespuestaBusqueda, { tipo: "candidatos" }>; navegar: Navegar }) {
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {r.candidatos.length === 0 ? "Nadie con ese nombre en el SECOP." : `${r.candidatos.length} coincidencia${r.candidatos.length === 1 ? "" : "s"} con «${r.consulta}».`}{" "}
        <span className="text-muted-foreground">Un nombre no identifica a nadie (hay homónimos y errores de digitación): elige el documento correcto para abrir su ficha.</span>
      </p>
      {r.candidatos.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {r.candidatos.map((c) => (
            <TarjetaCandidato key={c.clave} c={c} navegar={navegar} />
          ))}
        </ul>
      )}
      {r.fuentes.some((f) => !f.ok) && (
        <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-300">
          No respondieron: {r.fuentes.filter((f) => !f.ok).map((f) => f.titulo).join("; ")}. La lista puede estar incompleta: vuelve a buscar.
        </p>
      )}
      {!r.completa && r.candidatos.length > 0 && <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted-foreground">Hay más coincidencias que las mostradas. Agrega el segundo nombre o el segundo apellido para acotar, o busca directamente por cédula o NIT.</p>}
      <p className="text-[11px] text-muted-foreground">Los números son apariciones dentro de una muestra de los registros, no el total de contratos: el total está en la ficha.</p>
    </div>
  );
}

function TarjetaCandidato({ c, navegar }: { c: Candidato; navegar: Navegar }) {
  const esNit = c.tipoDoc === "nit";
  const roles = c.roles.map((r) => `${ROL_TEXTO[r.rol]} (${r.n})`).join(" · ");
  return (
    // En pantallas angostas el nombre completo importa (hay homónimos): se muestra entero y el botón baja a su fila.
    <li className={`${marco} flex flex-wrap items-center gap-3 sm:flex-nowrap`}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-muted-foreground ring-1 ring-border">{esNit ? <Building2 className="size-5" aria-hidden="true" /> : <User className="size-5" aria-hidden="true" />}</span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          <span className="[overflow-wrap:anywhere]">{titulo(c.nombre)}</span>
          {c.exacta && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Nombre exacto</span>}
        </p>
        <p className="text-xs text-muted-foreground">{c.documento ? `${esNit ? "NIT" : "C.C."} ${formatoDocumento(c.documento, esNit)}` : "Sin documento en el SECOP"}</p>
        <p className="line-clamp-2 text-[11px] text-muted-foreground">{[roles, c.entidades[0] && titulo(c.entidades[0])].filter(Boolean).join(" · ")}</p>
      </div>
      {c.documento ? (
        <button
          type="button"
          onClick={() => navegar(c.tipoDoc === "nit" ? { modo: "nit", q: c.documento! } : consultaDe(c.documento!))}
          className="w-full shrink-0 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:opacity-90 sm:w-auto"
        >
          Abrir ficha
        </button>
      ) : (
        <span className="shrink-0 text-[11px] text-muted-foreground">No se puede abrir</span>
      )}
    </li>
  );
}

/* ---------------------------------------------------------------------- tab */

export function ContratosTab({ inicial }: { inicial?: Consulta | null }) {
  const [modo, setModo] = React.useState<Consulta["modo"]>(inicial?.modo ?? "cedula");
  const [texto, setTexto] = React.useState(inicial?.q ?? "");
  const [pila, setPila] = React.useState<Consulta[]>(inicial ? [inicial] : []);
  const [intento, setIntento] = React.useState(0);

  const actual = pila.length ? pila[pila.length - 1] : null;
  const url = actual
    ? `/api/admin/secop?${new URLSearchParams({ modo: actual.modo, q: actual.q, ...(actual.nombre ? { nombre: actual.nombre } : {}), ...(intento ? { r: String(intento) } : {}) })}`
    : null;
  const respuesta = usePeticion<RespuestaBusqueda>(url);

  const numerico = modo !== "nombre";
  const valido = modo === "nombre" ? texto.trim().length >= 3 : !!entradaDocumento(texto, modo);
  const mostrarAyuda = texto.trim().length > 0 && !valido;

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    setPila([{ modo, q: texto.trim() }]);
    setIntento(0);
  };
  const navegar: Navegar = (c) => {
    setPila((p) => [...p, c]);
    setModo(c.modo);
    setTexto(c.q);
    setIntento(0);
  };
  const volver = () => {
    const resto = pila.slice(0, -1);
    setPila(resto);
    const anterior = resto[resto.length - 1];
    if (anterior) {
      setModo(anterior.modo);
      setTexto(anterior.q);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-xl shadow-indigo-900/5 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="cabal-blob absolute -top-24 -left-16 size-72 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="cabal-blob absolute -top-10 right-0 size-64 rounded-full bg-cyan-400/20 blur-3xl [animation-delay:-4s]" />
        <div className="cabal-blob absolute bottom-0 left-1/3 size-80 rounded-full bg-fuchsia-400/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <div className="relative space-y-4">
        <div className="relative rounded-2xl bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-600 p-5 text-white shadow-lg shadow-indigo-700/25">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute -right-10 -bottom-16 size-48 rounded-full bg-white/10" />
            <div className="absolute right-24 -top-12 size-28 rounded-full bg-amber-300/25 blur-xl" />
          </div>
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide backdrop-blur">
              <Landmark className="size-3.5" aria-hidden="true" />
              Contratación pública · SECOP I y II
            </p>
            <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Contratos y relaciones</p>
            <p className="mt-1 max-w-3xl text-xs text-white/85 sm:text-sm">
              Busca los contratos de una persona o empresa por cédula, NIT o nombre, y descubre con quién se relaciona: las empresas que representa, las entidades que la contratan y los funcionarios que firman y supervisan.
            </p>

            <div role="group" aria-label="Buscar por" className="mt-4 inline-flex rounded-full bg-white/15 p-1 backdrop-blur">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={modo === m.id}
                  onClick={() => {
                    setModo(m.id);
                    setTexto("");
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${modo === m.id ? "bg-white text-indigo-900 shadow" : "text-white/90 hover:bg-white/10"}`}
                >
                  <m.Icono className="size-3.5" aria-hidden="true" />
                  {m.rotulo}
                </button>
              ))}
            </div>

            <form onSubmit={buscar} className="mt-3 flex flex-wrap gap-2">
              <input
                value={texto}
                onChange={(e) => setTexto(numerico ? e.target.value.replace(/[^\d.\-\s]/g, "") : e.target.value)}
                inputMode={numerico ? "numeric" : "text"}
                placeholder={MODOS.find((m) => m.id === modo)?.placeholder}
                aria-label={MODOS.find((m) => m.id === modo)?.placeholder}
                maxLength={numerico ? 20 : 100}
                className="w-full rounded-full border border-white/30 bg-white/95 px-4 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-amber-300 sm:min-w-0 sm:flex-1"
              />
              <button
                type="submit"
                disabled={!valido}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-300 px-5 py-2 text-sm font-bold text-amber-950 shadow-md shadow-amber-900/20 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/80 disabled:shadow-none sm:w-auto"
              >
                <Search className="size-4" aria-hidden="true" /> Buscar
              </button>
            </form>
            {mostrarAyuda && (
              <p className="mt-1.5 text-[11px] text-amber-100">{modo === "nombre" ? "Escribe al menos 3 letras." : "Escribe solo el número (con o sin puntos). Para el NIT sirve con o sin dígito de verificación."}</p>
            )}

            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-300/20 p-2.5 text-[11px] text-amber-50 ring-1 ring-amber-200/30">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Son datos abiertos que cargan las propias entidades: pueden traer errores de digitación y homónimos. No son un certificado ni prueban ninguna inhabilidad.
            </p>
          </div>
        </div>

        {pila.length > 1 && (
          <button type="button" onClick={volver} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border transition hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Volver
          </button>
        )}

        {!actual ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {QUE_INCLUYE.map((c, i) => (
                <KpiCard key={c.label} label={c.label} value={c.value} sub={c.sub} icon={c.icon} card={c.card} glow={c.glow} delay={i * 80} />
              ))}
            </div>
            <ul className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <li className={marco}>
                <p className="font-semibold">Por cédula o NIT</p>
                <p className="mt-1 text-xs text-muted-foreground">Todos sus contratos en SECOP I y II, los de las empresas que representa y los que firma o supervisa como funcionario. Encuentra el documento aunque esté escrito con puntos o con dígito de verificación.</p>
              </li>
              <li className={marco}>
                <p className="font-semibold">Por nombre</p>
                <p className="mt-1 text-xs text-muted-foreground">Lista a quienes se llaman así, con su documento, para elegir al correcto: nunca atribuye contratos solo por el nombre.</p>
              </li>
              <li className={marco}>
                <p className="font-semibold">Relaciones</p>
                <p className="mt-1 text-xs text-muted-foreground">Un mapa de con quién se relaciona. Con un clic en cualquier empresa, entidad o funcionario saltas a su ficha y sigues la cadena.</p>
              </li>
            </ul>
          </>
        ) : respuesta.estado === "cargando" ? (
          <div className="space-y-3" role="status" aria-live="polite">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Consultando SECOP I y II…
            </p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
              ))}
            </div>
            <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
          </div>
        ) : respuesta.estado === "error" ? (
          <div className={`${marco} flex flex-wrap items-center gap-3 text-sm text-red-700 dark:text-red-300`}>
            <span className="min-w-0 flex-1">{respuesta.error}</span>
            <button type="button" onClick={() => setIntento((n) => n + 1)} className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-border hover:ring-emerald-500/50">
              Reintentar
            </button>
          </div>
        ) : respuesta.data.tipo === "candidatos" ? (
          <Candidatos r={respuesta.data} navegar={navegar} />
        ) : (
          <FichaContratos key={`${respuesta.data.ficha.modo}:${respuesta.data.ficha.numero}`} f={respuesta.data.ficha} navegar={navegar} />
        )}
      </div>
    </div>
  );
}
