"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowLeft, Building2, ChevronUp, IdCard, Loader2, Search, User } from "lucide-react";

import { entradaDocumento, formatoDocumento } from "@/lib/gov-data/secop/documento";
import type { Candidato, RespuestaBusqueda, RolContrato } from "@/lib/gov-data/secop/tipos";
import { consultaDe, type Consulta, type Navegar } from "./contratos-comun";
import { FichaContratos } from "./contratos-ficha";
import { titulo } from "./nombres";
import { usePeticion } from "./peticion";

const marco = "rounded-2xl border border-border bg-surface p-4 shadow-sm";
const chip =
  "inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border transition hover:text-foreground";

const MODOS: { id: Consulta["modo"]; rotulo: string; placeholder: string; Icono: LucideIcon }[] = [
  { id: "cedula", rotulo: "Cédula", placeholder: "Número de cédula", Icono: IdCard },
  { id: "nit", rotulo: "NIT", placeholder: "NIT, con o sin dígito de verificación", Icono: Building2 },
  { id: "nombre", rotulo: "Nombre", placeholder: "Nombre de la persona o de la empresa", Icono: User },
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
        <ul className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
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
    // En espacios angostos el nombre completo importa (hay homónimos): se muestra entero y el botón baja a su fila.
    <li className={`${marco} flex flex-wrap items-center gap-3 @xl:flex-nowrap`}>
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
          className="w-full shrink-0 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:opacity-90 @xl:w-auto"
        >
          Abrir ficha
        </button>
      ) : (
        <span className="shrink-0 text-[11px] text-muted-foreground">No se puede abrir</span>
      )}
    </li>
  );
}

/* ----------------------------------------------------------------- explorador */

/**
 * La contratación pública de quien se está verificando, dentro de su expediente de Avales: la ficha completa
 * (contratos, señales y red de relaciones) y, desde cualquiera de sus vínculos, la de otra persona o empresa.
 * También busca por cédula, NIT o nombre para seguir una pista sin salir de Avales. «Volver» deshace cada salto.
 */
export function ContratosExplorador({ inicial, onCerrar }: { inicial: Consulta; onCerrar: () => void }) {
  const [modo, setModo] = React.useState<Consulta["modo"]>(inicial.modo);
  const [texto, setTexto] = React.useState(inicial.q);
  const [pila, setPila] = React.useState<Consulta[]>([inicial]);
  const [intento, setIntento] = React.useState(0);

  const actual = pila[pila.length - 1];
  const url = `/api/admin/secop?${new URLSearchParams({ modo: actual.modo, q: actual.q, ...(actual.nombre ? { nombre: actual.nombre } : {}), ...(intento ? { r: String(intento) } : {}) })}`;
  const respuesta = usePeticion<RespuestaBusqueda>(url);

  const numerico = modo !== "nombre";
  const valido = modo === "nombre" ? texto.trim().length >= 3 : !!entradaDocumento(texto, modo);
  const mostrarAyuda = texto.trim().length > 0 && !valido;

  const navegar: Navegar = (c) => {
    setPila((p) => [...p, c]);
    setModo(c.modo);
    setTexto(c.q);
    setIntento(0);
  };
  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    const q = texto.trim();
    // La misma consulta otra vez no apila nada: solo vuelve a pedirla.
    if (actual.modo === modo && actual.q === q) setIntento((n) => n + 1);
    else navegar({ modo, q });
  };
  const volver = () => {
    const resto = pila.slice(0, -1);
    setPila(resto);
    const anterior = resto[resto.length - 1];
    setModo(anterior.modo);
    setTexto(anterior.q);
    setIntento(0);
  };

  return (
    // `@container`: la ficha se acomoda al ancho de este espacio (la columna del expediente), no al de la pantalla.
    <div className="@container mt-3 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onCerrar} className={chip}>
          <ChevronUp className="size-3.5" aria-hidden="true" /> Ver solo el resumen
        </button>
        {pila.length > 1 && (
          <button type="button" onClick={volver} className={chip}>
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Volver
          </button>
        )}
      </div>

      <details className="group rounded-2xl border border-border bg-surface-muted/50 p-3">
        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <Search className="size-3.5" aria-hidden="true" /> Buscar otra persona o empresa (cédula, NIT o nombre)
        </summary>
        <div role="group" aria-label="Buscar por" className="mt-2 flex flex-wrap gap-1.5">
          {MODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={modo === m.id}
              onClick={() => {
                setModo(m.id);
                setTexto("");
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${modo === m.id ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow" : "bg-surface text-muted-foreground ring-1 ring-border hover:text-foreground"}`}
            >
              <m.Icono className="size-3.5" aria-hidden="true" />
              {m.rotulo}
            </button>
          ))}
        </div>
        <form onSubmit={buscar} className="mt-2 flex flex-wrap gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(numerico ? e.target.value.replace(/[^\d.\-\s]/g, "") : e.target.value)}
            inputMode={numerico ? "numeric" : "text"}
            placeholder={MODOS.find((m) => m.id === modo)?.placeholder}
            aria-label={MODOS.find((m) => m.id === modo)?.placeholder}
            maxLength={numerico ? 20 : 100}
            className="min-w-0 flex-1 basis-48 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="submit"
            disabled={!valido}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search className="size-3.5" aria-hidden="true" /> Buscar
          </button>
        </form>
        {mostrarAyuda && (
          <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-300">{modo === "nombre" ? "Escribe al menos 3 letras." : "Escribe solo el número (con o sin puntos). Para el NIT sirve con o sin dígito de verificación."}</p>
        )}
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          Son datos abiertos que cargan las propias entidades: pueden traer errores de digitación y homónimos. No son un certificado ni prueban ninguna inhabilidad.
        </p>
      </details>

      {respuesta.estado === "cargando" ? (
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Consultando SECOP I y II…
          </p>
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
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
        <FichaContratos key={`${respuesta.data.ficha.modo}:${respuesta.data.ficha.numero}`} f={respuesta.data.ficha} navegar={navegar} sinCabecera={pila.length === 1} />
      )}
    </div>
  );
}
