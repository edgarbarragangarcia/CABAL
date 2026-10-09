"use client";

import * as React from "react";
import { Building2, ChevronDown, Landmark, Loader2 } from "lucide-react";

import { formatoDocumento } from "@/lib/gov-data/secop/documento";
import { fechaCorta, pesos, pesosCorto } from "@/lib/gov-data/secop/formato";
import type { Ficha, RespuestaBusqueda } from "@/lib/gov-data/secop/tipos";
import { ContratosExplorador } from "./contratos-explorador";
import { ESTADO, Senales } from "./contratos-ficha";
import { titulo } from "./nombres";
import type { Peticion } from "./peticion";

const tituloSeccion = "flex items-center gap-1.5 text-sm font-bold tracking-wide uppercase";

/** La ficha de contratación de un aspirante, ya consultada por cédula: lo que Avales necesita de un vistazo. */
export const fichaDeSecop = (p: Peticion<RespuestaBusqueda>): Ficha | null => (p.estado === "listo" && p.data.tipo === "ficha" ? p.data.ficha : null);

function Resumen({ f, onAbrir }: { f: Ficha; onAbrir: () => void }) {
  const { contratista: c, representante: r } = f.resumen;
  const hay = f.contratos.length + f.comoRepresentante.length + f.comoFuncionario.length + f.registros.length > 0;
  const masC = f.tope.contratista ? "al menos " : "";
  const masR = f.tope.representante ? "al menos " : "";
  const empresas = f.relaciones.empresas.slice(0, 4);
  const recientes = f.contratos.slice(0, 3);
  const entidades = f.relaciones.entidades.slice(0, 4);
  const maxEntidad = Math.max(1, ...entidades.map((e) => e.n));

  return (
    <div className="mt-2 space-y-3">
      {/* Sin contratos no se muestra una palomita verde: no haber contratado en el SECOP no es un certificado; la señal de abajo lo explica. */}
      {hay && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [`${masC ? "≥ " : ""}${c.n}`, "contratos propios"],
            [pesosCorto(c.valor), "valor total"],
            [String(c.vigentes), "vigentes hoy"],
            [r.n > 0 ? `${masR ? "≥ " : ""}${r.n}` : "0", "como representante de empresas"],
          ].map(([valor, rotulo]) => (
            <div key={rotulo} className="rounded-xl bg-surface-muted/70 px-3 py-2 ring-1 ring-border">
              <dd className="text-base font-bold tabular-nums">{valor}</dd>
              <dt className="text-[11px] leading-tight text-muted-foreground">{rotulo}</dt>
            </div>
          ))}
        </dl>
      )}

      <Senales lista={f.senales} max={4} />

      {entidades.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Con quién contrata</p>
          <ul className="mt-1 space-y-1.5">
            {entidades.map((e) => (
              <li key={e.clave} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{titulo(e.nombre)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{e.n} · {pesosCorto(e.valor)}</span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${Math.max(6, (e.n / maxEntidad) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {empresas.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Empresas que representa</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {empresas.map((e) => (
              <li key={e.clave} className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-800 dark:text-violet-300">
                <Building2 className="size-3" aria-hidden="true" />
                {titulo(e.nombre)}
                {e.documento ? ` (${formatoDocumento(e.documento)})` : ""}
                {e.n > 0 ? ` · ${e.n}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recientes.length > 0 && (
        // [contain:inline-size]: la entidad va en una sola línea (truncate); sin esto, un nombre largo ensanchaba toda la página en el celular.
        <ul className="divide-y divide-border rounded-xl border border-border [contain:inline-size]">
          {recientes.map((k) => (
            <li key={`${k.fuente}:${k.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO[k.clase].clase}`}>{ESTADO[k.clase].texto}</span>
              <span className="text-muted-foreground">{fechaCorta(k.fechaFirma)}</span>
              <span className="min-w-0 flex-1 truncate">{titulo(k.entidad)}</span>
              <span className="font-semibold tabular-nums">{k.valorAtipico ? "valor no confiable" : k.valor === null ? "—" : pesos(k.valor)}</span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        aria-expanded={false}
        onClick={onAbrir}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:opacity-90"
      >
        {hay ? "Ver todos los contratos y relaciones" : "Buscar por cédula, NIT o nombre"} <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * La contratación pública del aspirante, dentro de su expediente: primero el resumen y, con un clic, la ficha completa
 * con el mapa de relaciones y el buscador (el resumen se cambia por ella, no se duplica).
 */
export function SeccionContratosAval({ secop, cedula, nombre }: { secop: Peticion<RespuestaBusqueda>; cedula: string; nombre: string }) {
  const [abierto, setAbierto] = React.useState(false);
  return (
    <section>
      <h4 className={tituloSeccion}>
        <Landmark className="size-4 text-brand" aria-hidden="true" /> Contratación pública (SECOP I y II)
      </h4>
      {abierto ? (
        <ContratosExplorador inicial={{ modo: "cedula", q: cedula, nombre }} onCerrar={() => setAbierto(false)} />
      ) : secop.estado === "cargando" ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Buscando contratos en SECOP I y II…
        </p>
      ) : secop.estado === "error" ? (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{secop.error}</p>
      ) : secop.data.tipo === "ficha" ? (
        <Resumen f={secop.data.ficha} onAbrir={() => setAbierto(true)} />
      ) : null}
    </section>
  );
}
