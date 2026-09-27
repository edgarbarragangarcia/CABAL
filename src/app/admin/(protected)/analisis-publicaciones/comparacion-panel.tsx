"use client";

import * as React from "react";
import { ArrowRight, GitCompareArrows, Loader2, Sparkles } from "lucide-react";

import { ELECCIONES } from "@/lib/gov-data/elecciones/catalogo";
import type { Transferencia } from "@/lib/gov-data/elecciones/comparacion";
import { Markdown } from "./markdown-ia";
import { titulo } from "./nombres";

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const signo = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
const pp = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("es-CO", { maximumFractionDigits: 1 })} pp`;
const plural = (n: number, uno: string, varios: string) => `${fmt(n)} ${Math.round(n) === 1 ? uno : varios}`;
const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;

type Respuesta = {
  ambito: { nombre: string; nivel: number };
  /** Antes (la elección más antigua) y ahora (la más reciente). */
  a: { nombre?: string; partido?: string; clave: string };
  b: { nombre?: string; partido?: string; clave: string };
  total: number;
  pendientes: number;
  noSoportado: boolean;
  transferencia: Transferencia;
};

/** Cargos comparables: los que eligen personas (no consultas ni curules de paz). */
const OPCIONES = ELECCIONES.flatMap((e) =>
  e.corporaciones
    .filter((c) => c.tipo !== "consulta" && c.sigla !== "CT")
    .map((c) => ({
      clave: `${e.id}|${c.sigla}`,
      eleccion: e.id,
      sigla: c.sigla,
      etiqueta: c.sigla === "PR" ? e.nombre : `${c.nombre} ${e.fecha.slice(0, 4)}`,
    }))
);

const RONDAS = 12;

function useComparacion(url: string | null) {
  const [state, setState] = React.useState<{ url: string; data?: Respuesta; error?: string; agotado?: boolean } | null>(null);
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
          return body as Respuesta;
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
  }, [url, intento]);
  const actual = url && state?.url === url ? state : null;
  return {
    data: actual?.data,
    error: actual?.error,
    faltan: actual?.agotado ? (actual.data?.pendientes ?? 0) : 0,
    loading: !!url && !actual?.error && !actual?.agotado && (!actual?.data || actual.data.pendientes > 0),
    retry: () => setIntento((n) => n + 1),
  };
}

export function ComparacionPanel({
  nombre,
  actual,
  ambito,
  lugar,
}: {
  nombre: string;
  /** Elección y cargo que se están viendo. */
  actual: { eleccion: string; sigla: string };
  /** Código del ámbito en la elección actual. */
  ambito: string;
  lugar: string;
}) {
  const otras = OPCIONES.filter((o) => o.clave !== `${actual.eleccion}|${actual.sigla}`);
  // Por defecto, el mismo cargo en otro año.
  const inicial = otras.find((o) => o.sigla === actual.sigla) ?? otras[0];
  const [base, setBase] = React.useState(inicial?.clave ?? "");
  const [pedida, setPedida] = React.useState(false);
  const [ver, setVer] = React.useState<"caidas" | "crecimientos">("caidas");
  const [ia, setIa] = React.useState<{ texto?: string; error?: string; cargando?: boolean }>({});
  const [b0, b1] = base.split("|");
  const params = { ea: b0, ca: b1, eb: actual.eleccion, cb: actual.sigla, a: ambito, persona: nombre };
  const url = pedida ? `/api/admin/elecciones/comparacion?${new URLSearchParams(params)}` : null;
  const { data, error, faltan, loading, retry } = useComparacion(url);
  const t = data?.transferencia;
  const etiqueta = (clave: string) => OPCIONES.find((o) => o.clave === clave)?.etiqueta ?? clave;
  const etiquetaActual = OPCIONES.find((o) => o.clave === `${actual.eleccion}|${actual.sigla}`)?.etiqueta ?? "";

  const explicar = () => {
    setIa({ cargando: true });
    fetch("/api/admin/elecciones/analisis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, comparar: "1", e: actual.eleccion, c: actual.sigla, p: "-", k: "-" }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        setIa({ texto: body.analisis });
      })
      .catch((err: Error) => setIa({ error: err.message }));
  };

  const filas = t ? (ver === "caidas" ? t.filas.filter((f) => f.delta < 0) : [...t.filas].reverse().filter((f) => f.delta > 0)) : [];

  return (
    <div className="rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/10 via-surface to-sky-500/5 p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <GitCompareArrows className="size-4 text-emerald-600" aria-hidden="true" />
        Cambio entre elecciones
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Compara los votos de {titulo(nombre)} en {lugar} con otra elección, territorio por territorio.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Comparar {etiquetaActual} con</span>
          <select
            value={base}
            onChange={(e) => {
              setBase(e.target.value);
              setPedida(false);
              setIa({});
            }}
            className="rounded-lg border border-border bg-surface px-2 py-1"
          >
            {otras.map((o) => (
              <option key={o.clave} value={o.clave}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        </label>
        {!pedida && (
          <button
            type="button"
            onClick={() => setPedida(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-sky-600 px-4 py-1.5 font-semibold text-white shadow"
          >
            <GitCompareArrows className="size-3.5" aria-hidden="true" />
            Comparar
          </button>
        )}
      </div>

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Consultando los territorios en las dos elecciones
          {data ? ` (${fmt(data.total - data.pendientes)} de ${fmt(data.total)})` : "…"}
        </p>
      )}
      {(error || faltan > 0) && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-red-700 dark:text-red-300">
          {error ?? `La Registraduría no respondió por ${fmt(faltan)} territorios; puede estar limitando las consultas.`}
          <button type="button" onClick={retry} className="rounded-full border border-border bg-surface px-2.5 py-0.5 font-medium text-foreground">
            Reintentar
          </button>
        </p>
      )}
      {data?.noSoportado && (
        <p className="mt-3 text-xs text-muted-foreground">
          La comparación funciona para el país, un departamento o un municipio. Sube en el lienzo a uno de esos niveles.
        </p>
      )}

      {data && t && !data.noSoportado && (
        <div className="mt-4 space-y-4">
          {t.votosA === 0 && t.votosB === 0 ? (
            <p className="text-sm text-muted-foreground">
              No aparece con ese nombre en las dos elecciones. La comparación busca a la misma persona por nombre completo.
            </p>
          ) : (
            <>
              <p className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface p-2 text-xs ring-1 ring-border">
                <span>
                  <b>{titulo(data.a.nombre ?? "sin datos")}</b>
                  {data.a.partido && <> · {titulo(data.a.partido)}</>} ({etiqueta(data.a.clave)})
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>
                  <b>{titulo(data.b.nombre ?? "sin datos")}</b>
                  {data.b.partido && <> · {titulo(data.b.partido)}</>} ({etiqueta(data.b.clave)})
                </span>
                <span className="basis-full text-[11px] text-muted-foreground">Verifica que sea la misma persona.</span>
              </p>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  [`Votos en ${etiqueta(data.a.clave)}`, fmt(t.votosA), pct(t.cuotaA) + " de los válidos"],
                  [`Votos en ${etiqueta(data.b.clave)}`, fmt(t.votosB), pct(t.cuotaB) + " de los válidos"],
                  ["Cambio", signo(t.delta), t.votosA ? `${signo((100 * t.delta) / t.votosA)}%` : "sin base"],
                  ["Cuota", pp(t.cuotaB - t.cuotaA), "puntos de los válidos"],
                ].map(([k, v, h]) => (
                  <div key={k} className="rounded-xl bg-surface p-3 ring-1 ring-border">
                    <p className="text-[11px] text-muted-foreground">{k}</p>
                    <p className="text-lg font-bold tabular-nums">{v}</p>
                    <p className="text-[11px] text-muted-foreground">{h}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300">Donde cayó</p>
                  <p className="text-lg font-bold tabular-nums">{plural(t.fugas.territorios, "territorio", "territorios")}</p>
                  <p className="text-[11px] text-muted-foreground">{plural(t.fugas.votosPerdidos, "voto menos", "votos menos")}</p>
                </div>
                <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Donde creció</p>
                  <p className="text-lg font-bold tabular-nums">{plural(t.crecimiento.territorios, "territorio", "territorios")}</p>
                  <p className="text-[11px] text-muted-foreground">{plural(t.crecimiento.votosGanados, "voto más", "votos más")}</p>
                </div>
              </div>

              {t.herederos.length > 0 && (
                <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
                  <p className="text-xs font-semibold">Quién ganó donde perdió</p>
                  <p className="text-[11px] text-muted-foreground">
                    Partidos que más votos sumaron en los {plural(t.fugas.territorios, "territorio", "territorios")} donde bajó.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {t.herederos.map((h) => (
                      <li key={h.partido} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate">
                          {titulo(h.partido)}
                          {h.esPropio && <span className="ml-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">su partido</span>}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          +{plural(h.ganados, "voto", "votos")} · {plural(h.territorios, "territorio", "territorios")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="mb-2 flex gap-1.5">
                  {(["caidas", "crecimientos"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVer(v)}
                      aria-pressed={ver === v}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${ver === v ? "bg-emerald-600 text-white" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}
                    >
                      {v === "caidas" ? "Mayores caídas" : "Mayores crecimientos"}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-xl ring-1 ring-border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="bg-surface-muted/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Territorio</th>
                        <th className="px-3 py-2 text-right font-medium">{etiqueta(data.a.clave)}</th>
                        <th className="px-3 py-2 text-right font-medium">{etiqueta(data.b.clave)}</th>
                        <th className="px-3 py-2 text-right font-medium">Cambio</th>
                        <th className="px-3 py-2 text-right font-medium">Cuota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.slice(0, 15).map((f) => (
                        <tr key={f.clave} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{titulo(f.nombre)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(f.a.votos)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(f.b.votos)}</td>
                          <td className={`px-3 py-2 text-right font-semibold tabular-nums ${f.delta < 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                            {signo(f.delta)}
                          </td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                            {pct(f.cuotaA)} → {pct(f.cuotaB)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Es el cambio entre territorios, no un flujo de electores: con resultados agregados no se puede saber a quién votó cada
                persona en la otra elección. Además, la participación y el número de candidatos cambian entre elecciones.
              </p>

              <div>
                <button
                  type="button"
                  onClick={explicar}
                  disabled={ia.cargando || loading}
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
