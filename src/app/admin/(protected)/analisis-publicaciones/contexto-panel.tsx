"use client";

import * as React from "react";
import { Loader2, Sparkles, Users } from "lucide-react";

import type { Grupo, Indicadores, PerfilCandidato } from "@/lib/dane/contexto";
import { Markdown } from "./markdown-ia";
import { titulo } from "./nombres";

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const pct = (n: number) => `${n.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
const dec = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

type Respuesta = {
  ambito: { nombre: string; nivel: number };
  anio: number;
  fuente: string;
  contexto: Indicadores | null;
  votos: number;
  perfil: PerfilCandidato;
  total: number;
  pendientes: number;
};

const RONDAS = 10;

function useContexto(url: string | null) {
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

function Tabla({ titulo: t, grupos }: { titulo: string; grupos: Grupo[] }) {
  const max = Math.max(0.0001, ...grupos.map((g) => g.votosPorMilAdultos));
  return (
    <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
      <p className="text-xs font-semibold">{t}</p>
      <ul className="mt-2 space-y-2">
        {grupos.map((g) => (
          <li key={g.etiqueta} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate">{g.etiqueta}</span>
              <span className="shrink-0 font-semibold tabular-nums">{g.territorios ? `${dec(g.votosPorMilAdultos)} por mil` : "—"}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-border/60">
              <div className="h-full rounded-full bg-violet-500" style={{ width: `${(g.votosPorMilAdultos / max) * 100}%` }} />
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {fmt(g.territorios)} {g.territorios === 1 ? "territorio" : "territorios"} · {fmt(g.votos)} votos · {pct(g.pctDeSusVotos)} de sus votos
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContextoPanel({ nombre, params, nivel, lugar }: { nombre: string; params: Record<string, string>; nivel: 1 | 2; lugar: string }) {
  const [pedida, setPedida] = React.useState(false);
  const [ia, setIa] = React.useState<{ texto?: string; error?: string; cargando?: boolean }>({});
  const { data, error, faltan, loading, retry } = useContexto(pedida ? `/api/admin/elecciones/contexto?${new URLSearchParams(params)}` : null);
  const p = data?.perfil;
  const unidad = nivel === 1 ? "departamentos" : "municipios";
  const c = data?.contexto;

  const explicar = () => {
    if (!data) return;
    setIa({ cargando: true });
    fetch("/api/admin/elecciones/analisis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        e: params.e, c: params.c, p: params.p, k: params.k, a: params.a, circ: params.circ,
        contexto: JSON.stringify({ lugar, unidad, anio: data.anio, ambito: data.contexto, votos: data.votos, perfil: data.perfil }),
      }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        setIa({ texto: body.analisis });
      })
      .catch((err: Error) => setIa({ error: err.message }));
  };

  return (
    <div className="rounded-2xl border border-teal-400/40 bg-gradient-to-br from-teal-500/10 via-surface to-violet-500/5 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4 text-teal-600" aria-hidden="true" />
            Contexto demográfico (DANE)
          </p>
          <p className="text-xs text-muted-foreground">
            Población, ruralidad y edades de {lugar}, y en qué tipo de {unidad} le va mejor a {titulo(nombre)}.
          </p>
        </div>
        {!pedida && (
          <button
            type="button"
            onClick={() => setPedida(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-teal-600 to-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow"
          >
            <Users className="size-3.5" aria-hidden="true" />
            Ver contexto
          </button>
        )}
      </div>

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Consultando los votos por {nivel === 1 ? "departamento" : "municipio"}
          {data ? ` (faltan ${fmt(data.pendientes)} de ${fmt(data.total)})` : "…"}
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

      {data && p && !loading && (
        <div className="mt-4 space-y-4">
          {c && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                [`Población ${data.anio}`, fmt(c.total)],
                ["Rural", pct(c.pctRural)],
                ["Edad de votar (18+)", pct(c.pctAdultos)],
                ["Jóvenes 18–29", pct(c.pct18a29)],
                ["Mayores de 60", pct(c.pct60)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface p-3 ring-1 ring-border">
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                  <p className="text-lg font-bold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
          )}

          {p.territorios === 0 ? (
            <p className="text-sm text-muted-foreground">No hay {unidad} con población del DANE para comparar.</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <Tabla titulo={`Votos por mil adultos, según la ruralidad del ${nivel === 1 ? "departamento" : "municipio"}`} grupos={p.porRuralidad} />
                <Tabla titulo={`Votos por mil adultos, según el tamaño del ${nivel === 1 ? "departamento" : "municipio"}`} grupos={p.porTamano} />
              </div>

              <div className="rounded-xl bg-surface p-3 ring-1 ring-border">
                <p className="text-xs font-semibold">
                  Qué se asocia con más votos por adulto ({fmt(p.territorios)} {unidad})
                </p>
                {p.correlaciones.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {p.correlaciones.map((k) => (
                      <li key={k.factor} className="flex flex-wrap items-baseline justify-between gap-2">
                        <span>
                          <b>{k.factor}:</b> {k.lectura}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {k.fuerza} (r = {k.r.toLocaleString("es-CO", { maximumFractionDigits: 2 })})
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Hay muy pocos {unidad} para medir relaciones con fiabilidad.</p>
                )}
              </div>
            </>
          )}
          {p.sinDatos > 0 && <p className="text-[11px] text-muted-foreground">{fmt(p.sinDatos)} sin población del DANE (por ejemplo, el voto en el exterior).</p>}
          <p className="text-[11px] text-muted-foreground">
            Es la población del territorio, no la de quienes votaron: ninguna fuente oficial publica la edad de los votantes. Que a un candidato le vaya
            mejor en cierto tipo de municipios no dice cómo vota cada persona. Fuente: {data.fuente}.
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
        </div>
      )}
    </div>
  );
}
