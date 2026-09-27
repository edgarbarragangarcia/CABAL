"use client";

import * as React from "react";
import { FlaskConical, Loader2, Sparkles, UsersRound } from "lucide-react";

import { demoSnapshot } from "@/lib/crm/demo";
import type { CrmSnapshot, RedCrmResponse } from "@/lib/crm/types";
import { ESTADO_NOMBRE, contarContactos, cruzar, type Estado } from "@/lib/crm/votos";
import type { VotosCandidato } from "@/lib/gov-data/elecciones/resultados";
import { Markdown } from "./markdown-ia";
import { titulo } from "./nombres";

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;

const ESTILO: Record<Estado, string> = {
  "base-sin-votos": "bg-amber-500",
  "votos-sin-base": "bg-fuchsia-600",
  "sin-base": "bg-slate-500",
  equilibrado: "bg-emerald-600",
};
const AYUDA: Record<Estado, string> = {
  "base-sin-votos": "Tienes contactos pero pocos votos: hay a quién movilizar.",
  "votos-sin-base": "Hay votos pero pocos contactos: construir presencia propia.",
  "sin-base": "Hay votos y ningún contacto del CRM.",
  equilibrado: "Contactos y votos van parejos.",
};

const RONDAS = 8;

/** Votos del candidato en cada territorio hijo; si quedan sin consultar, se piden otra vez por tandas. */
function useVotos(url: string | null) {
  const [state, setState] = React.useState<{ url: string; data?: VotosCandidato; error?: string; agotado?: boolean } | null>(null);
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
          (err: Error) => !cancelled && setState((prev) => ({ url, data: prev?.url === url ? prev.data : undefined, error: err.message }))
        );
    };
    pedir(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [url]);
  const actual = url && state?.url === url ? state : null;
  return {
    data: actual?.data,
    error: actual?.error,
    loading: !!url && !actual?.error && !actual?.agotado && (!actual?.data || actual.data.pendientes > 0),
  };
}

/** Contactos del CRM (o los de ejemplo si Bitrix24 no está conectado). */
function useCrm(activo: boolean) {
  const [state, setState] = React.useState<{ snapshot?: CrmSnapshot; demo?: boolean; error?: string } | null>(null);
  React.useEffect(() => {
    if (!activo) return;
    let cancelled = false;
    fetch("/api/admin/red-crm", { cache: "no-store" })
      .then((r) => r.json() as Promise<RedCrmResponse>)
      .then((body) => {
        if (cancelled) return;
        if (body.status === "ok") setState({ snapshot: body.snapshot });
        else if (body.status === "configurar") setState({ snapshot: demoSnapshot(), demo: true });
        else setState({ error: body.message });
      })
      .catch(() => !cancelled && setState({ error: "No fue posible leer el CRM." }));
    return () => {
      cancelled = true;
    };
  }, [activo]);
  return { ...state, loading: activo && !state };
}

export function CrmVotosPanel({
  nombre,
  params,
  nivel,
  lugar,
}: {
  nombre: string;
  /** e, c, a, circ, p, k del candidato en el territorio visible. */
  params: Record<string, string>;
  /** 1 = país (por departamento), 2 = departamento (por municipio). */
  nivel: 1 | 2;
  lugar: string;
}) {
  const [pedida, setPedida] = React.useState(false);
  const [ia, setIa] = React.useState<{ texto?: string; error?: string; cargando?: boolean }>({});
  const crm = useCrm(pedida);
  const votos = useVotos(pedida ? `/api/admin/elecciones/candidato?${new URLSearchParams(params)}` : null);

  const cruce = React.useMemo(() => {
    if (!crm.snapshot || !votos.data) return null;
    const conteo = contarContactos(crm.snapshot, nivel === 1 ? "departamento" : "municipio", nivel === 2 ? votos.data.ambito.nombre : undefined);
    const territorios = votos.data.hijos.filter((h) => h.votos !== null).map((h) => ({ clave: h.codigo, nombre: h.nombre, votos: h.votos ?? 0 }));
    return { conteo, cruce: cruzar(territorios, conteo) };
  }, [crm.snapshot, votos.data, nivel]);

  const explicar = () => {
    if (!cruce) return;
    setIa({ cargando: true });
    const filas = cruce.cruce.filas.slice(0, 25).map((f) => ({ n: f.nombre, v: f.votos, c: f.contactos, e: ESTADO_NOMBRE[f.estado] }));
    fetch("/api/admin/elecciones/analisis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        e: params.e, c: params.c, p: params.p, k: params.k, a: params.a, circ: params.circ,
        crm: JSON.stringify({ lugar, nivel, demo: !!crm.demo, sinUbicar: cruce.conteo.sinUbicar, sinEmparejar: cruce.cruce.sinEmparejar, filas }),
      }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        setIa({ texto: body.analisis });
      })
      .catch((err: Error) => setIa({ error: err.message }));
  };

  const cargando = crm.loading || votos.loading;
  const unidad = nivel === 1 ? "departamento" : "municipio";

  return (
    <div className="rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-500/10 via-surface to-amber-400/5 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <UsersRound className="size-4 text-violet-600" aria-hidden="true" />
            Base del CRM contra votos
          </p>
          <p className="text-xs text-muted-foreground">
            Contactos del CRM por {unidad} frente a los votos de {titulo(nombre)} en {lugar}. Solo cifras agregadas por territorio.
          </p>
        </div>
        {!pedida && (
          <button
            type="button"
            onClick={() => setPedida(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow"
          >
            <UsersRound className="size-3.5" aria-hidden="true" />
            Cruzar con el CRM
          </button>
        )}
      </div>

      {crm.demo && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-800 dark:text-amber-300">
          <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Bitrix24 aún no está conectado: se usan los 360 contactos de ejemplo de la pestaña Red Cabal. Las conclusiones no son reales.
        </p>
      )}
      {cargando && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {crm.loading ? "Leyendo el CRM…" : `Consultando los votos por ${unidad}${votos.data ? ` (faltan ${fmt(votos.data.pendientes)})` : "…"}`}
        </p>
      )}
      {(crm.error || votos.error) && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{crm.error ?? votos.error}</p>}

      {cruce && !cargando && (
        <div className="mt-4 space-y-4">
          {!cruce.conteo.hayCampo ? (
            <p className="text-sm text-muted-foreground">
              El CRM no tiene un campo de {nivel === 1 ? "departamento" : "ciudad o municipio"}, así que no se puede ubicar a los contactos.
              Revisa «Campos del CRM» en la pestaña Red Cabal.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ["Contactos ubicados", fmt(cruce.cruce.contactos)],
                  ["Votos del candidato", fmt(cruce.cruce.votos)],
                  ["Contactos por mil votos", cruce.cruce.votos ? (1000 * cruce.cruce.contactos / cruce.cruce.votos).toLocaleString("es-CO", { maximumFractionDigits: 1 }) : "—"],
                  ["Sin ubicar", fmt(cruce.conteo.sinUbicar + cruce.cruce.sinEmparejar)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-surface p-3 ring-1 ring-border">
                    <p className="text-[11px] text-muted-foreground">{k}</p>
                    <p className="text-lg font-bold tabular-nums">{v}</p>
                  </div>
                ))}
              </div>
              {cruce.cruce.contactos < 20 && (
                <p className="text-xs text-muted-foreground">Hay muy pocos contactos ubicados; las conclusiones por territorio son poco fiables.</p>
              )}

              <div className="overflow-x-auto rounded-xl ring-1 ring-border">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="bg-surface-muted/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{nivel === 1 ? "Departamento" : "Municipio"}</th>
                      <th className="px-3 py-2 text-right font-medium">Votos</th>
                      <th className="px-3 py-2 text-right font-medium">Contactos</th>
                      <th className="px-3 py-2 text-right font-medium">% votos → % contactos</th>
                      <th className="px-3 py-2 font-medium">Lectura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cruce.cruce.filas.slice(0, 20).map((f) => (
                      <tr key={f.clave} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{titulo(f.nombre)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(f.votos)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(f.contactos)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                          {pct(f.cuotaVotos)} → {pct(f.cuotaContactos)}
                        </td>
                        <td className="px-3 py-2">
                          <span title={AYUDA[f.estado]} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${ESTILO[f.estado]}`}>
                            {ESTADO_NOMBRE[f.estado]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                «Base sin votos» = tu parte de contactos es al menos 1,5 veces tu parte de votos; «Votos sin base», al revés. Los contactos se ubican por el
                nombre de la ciudad o del departamento; los que no coinciden con ningún territorio salen como «sin ubicar».
              </p>

              <div>
                <button
                  type="button"
                  onClick={explicar}
                  disabled={ia.cargando}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-600 to-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-60"
                >
                  {ia.cargando ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
                  {ia.texto ? "Volver a explicar" : "Explicar con IA"}
                </button>
                {ia.error && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{ia.error}</p>}
                {ia.texto && (
                  <div className="mt-3 rounded-xl bg-surface p-3 ring-1 ring-border">
                    <Markdown texto={ia.texto} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
