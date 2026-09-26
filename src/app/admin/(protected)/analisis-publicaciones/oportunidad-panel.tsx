"use client";

import * as React from "react";
import { Loader2, Sparkles, Target } from "lucide-react";

import { SEGMENTO_NOMBRE, type Oportunidad, type Segmento } from "@/lib/gov-data/elecciones/oportunidad";
import { Markdown } from "./markdown-ia";
import { titulo } from "./nombres";

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const pct = (n: number) => `${(n * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;

type Respuesta = {
  total: number;
  pendientes: number;
  demasiados: boolean;
  oportunidad: Oportunidad;
};

const SEGMENTOS: Record<Segmento, { clase: string; ayuda: string }> = {
  bastion: { clase: "bg-emerald-600", ayuda: "Cuota y participación altas: conservar." },
  movilizar: { clase: "bg-amber-500", ayuda: "Lo votan bien pero se vota poco: llevar a los suyos a las urnas." },
  persuadir: { clase: "bg-sky-600", ayuda: "Se vota mucho pero le va mal: convencer a quien ya vota." },
  dificil: { clase: "bg-slate-500", ayuda: "Poca cuota y poca participación: menor prioridad." },
};

const RONDAS = 12;

/** Pide la oportunidad por tandas: cada llamada completa los puestos que faltan (los demás ya están en caché). */
function useOportunidad(url: string | null) {
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

export function OportunidadPanel({ params, nombre, lugar }: { params: Record<string, string>; nombre: string; lugar: string }) {
  const [pedida, setPedida] = React.useState(false);
  const [ia, setIa] = React.useState<{ texto?: string; error?: string; cargando?: boolean }>({});
  const url = pedida ? `/api/admin/elecciones/oportunidad?${new URLSearchParams(params)}` : null;
  const { data, error, faltan, loading, retry } = useOportunidad(url);
  const o = data?.oportunidad;

  const explicar = () => {
    setIa({ cargando: true });
    fetch("/api/admin/elecciones/analisis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, oportunidad: "1" }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        setIa({ texto: body.analisis });
      })
      .catch((err: Error) => setIa({ error: err.message }));
  };

  return (
    <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/10 via-surface to-emerald-500/5 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Target className="size-4 text-amber-600" aria-hidden="true" />
            Oportunidad por puesto de votación
          </p>
          <p className="text-xs text-muted-foreground">
            Dónde {titulo(nombre)} tiene más votos por ganar en {lugar}, según la abstención de cada puesto.
          </p>
        </div>
        {!pedida && (
          <button
            type="button"
            onClick={() => setPedida(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow"
          >
            <Target className="size-3.5" aria-hidden="true" />
            Calcular oportunidad
          </button>
        )}
      </div>

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Consultando los puestos de votación
          {data ? ` (${fmt(data.total - data.pendientes)} de ${fmt(data.total)})` : "…"}
        </p>
      )}
      {(error || faltan > 0) && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-red-700 dark:text-red-300">
          {error ?? `La Registraduría no respondió por ${fmt(faltan)} puestos; puede estar limitando las consultas.`}
          <button type="button" onClick={retry} className="rounded-full border border-border bg-surface px-2.5 py-0.5 font-medium text-foreground">
            Reintentar
          </button>
        </p>
      )}
      {data?.demasiados && (
        <p className="mt-3 text-xs text-muted-foreground">
          {lugar} tiene {fmt(data.total)} puestos: elige un municipio, una localidad o una zona más pequeña.
        </p>
      )}

      {o && o.puestos.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Puestos analizados", fmt(o.puestos.length)],
              ["Participación media", pct(o.participacionMedia)],
              ["Cuota media del candidato", pct(o.cuotaMedia)],
              ["Votos por ganar", fmt(o.potencialTotal)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface p-3 ring-1 ring-border">
                <p className="text-[11px] text-muted-foreground">{k}</p>
                <p className="text-lg font-bold tabular-nums">{v}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {o.segmentos.map((s) => (
              <div key={s.segmento} className="rounded-xl bg-surface p-3 ring-1 ring-border" title={SEGMENTOS[s.segmento].ayuda}>
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className={`size-2.5 rounded-full ${SEGMENTOS[s.segmento].clase}`} />
                  {SEGMENTO_NOMBRE[s.segmento]}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums">{fmt(s.puestos)} puestos</p>
                <p className="text-[11px] text-muted-foreground">{fmt(s.potencial)} votos por ganar</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl ring-1 ring-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-surface-muted/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Puesto</th>
                  <th className="px-3 py-2 text-right font-medium">Votos</th>
                  <th className="px-3 py-2 text-right font-medium">Cuota</th>
                  <th className="px-3 py-2 text-right font-medium">Participación</th>
                  <th className="px-3 py-2 text-right font-medium">Abstención</th>
                  <th className="px-3 py-2 text-right font-medium">Por ganar</th>
                  <th className="px-3 py-2 font-medium">Perfil</th>
                </tr>
              </thead>
              <tbody>
                {o.puestos.slice(0, 15).map((p) => (
                  <tr key={p.codigo} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span className="font-medium">{titulo(p.nombre)}</span>
                      {p.zona && <span className="block text-[11px] text-muted-foreground">{titulo(p.zona)}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(p.votos)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(p.cuota)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(p.participacion)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(p.abstencion)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(p.potencial)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${SEGMENTOS[p.segmento].clase}`}>
                        {SEGMENTO_NOMBRE[p.segmento]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Por ganar = abstencionistas que quedarían si el puesto votara como el promedio del territorio, por la cuota del
            candidato en ese puesto. Es aritmética sobre el preconteo, no una proyección.
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
        </div>
      )}
    </div>
  );
}
