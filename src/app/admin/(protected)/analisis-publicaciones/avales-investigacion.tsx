"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink, Globe, Loader2, MessageSquareQuote, Newspaper, ShieldAlert, Sparkles } from "lucide-react";

import type { PresenciaInternet, Tema } from "@/lib/gov-data/avales/presencia-internet";
import type { Analisis, ResumenIa } from "@/lib/gov-data/avales/resumen-ia";
import type { Noticia } from "@/lib/informe/fuentes";
import { Markdown } from "./markdown-ia";

type Peticion<T> = { estado: "cargando" } | { estado: "error"; error: string } | { estado: "listo"; data: T };
type EstadoIa = { estado: "inicial" } | { estado: "buscando" } | { estado: "listo"; data: ResumenIa } | { estado: "error"; error: string };

const sub = "flex items-center gap-1.5 text-xs font-semibold text-muted-foreground";
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

function enlacesRedes(nombre: string) {
  const q = encodeURIComponent(nombre);
  return [
    { plataforma: "Google", url: `https://www.google.com/search?q=${q}` },
    { plataforma: "X / Twitter", url: `https://twitter.com/search?q=${q}&f=live` },
    { plataforma: "Facebook", url: `https://www.facebook.com/search/top?q=${q}` },
    { plataforma: "Instagram", url: `https://www.instagram.com/explore/search/keyword/?q=${q}` },
    { plataforma: "TikTok", url: `https://www.tiktok.com/search?q=${q}` },
    { plataforma: "YouTube", url: `https://www.youtube.com/results?search_query=${q}` },
    { plataforma: "LinkedIn", url: `https://www.linkedin.com/search/results/all/?keywords=${q}` },
    { plataforma: "Google: dijo de Cabal", url: `https://www.google.com/search?q=${encodeURIComponent(`"${nombre}" "María Fernanda Cabal"`)}` },
  ];
}

function Titulares({ lista, max = 8 }: { lista: Noticia[]; max?: number }) {
  const [todas, setTodas] = React.useState(false);
  const visibles = todas ? lista : lista.slice(0, max);
  return (
    <>
      <ul className="space-y-1.5 text-sm">
        {visibles.map((n, i) => (
          <li key={i}>
            <a href={n.enlace} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">
              {n.titulo}
            </a>
            <span className="block text-xs text-muted-foreground">
              {n.medio} · {fecha(n.fecha)}
            </span>
          </li>
        ))}
      </ul>
      {lista.length > max && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="mt-2 text-xs font-semibold text-brand hover:underline">
          {todas ? "Ver menos" : `Ver las ${lista.length}`}
        </button>
      )}
    </>
  );
}

const ESCALA = ["izquierda", "centro-izquierda", "centro", "centro-derecha", "derecha"];

function Orientacion({ o }: { o: Analisis["orientacion"] }) {
  const i = ESCALA.indexOf(o.etiqueta.toLowerCase());
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className={sub}>Orientación política (inferida)</p>
      <div className="mt-3 flex items-center gap-1">
        {ESCALA.map((e, k) => (
          <div key={e} className="flex-1 text-center">
            <div className={`h-2 rounded-full ${i === k ? "bg-brand" : "bg-border"}`} />
            <p className={`mt-1 text-[10px] ${i === k ? "font-bold text-foreground" : "text-muted-foreground"}`}>{e}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold capitalize">
        {o.etiqueta} <span className="text-xs font-normal text-muted-foreground">· confianza {o.confianza}</span>
      </p>
      {o.justificacion && <p className="mt-1 text-sm">{o.justificacion}</p>}
      {o.evidencia.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {o.evidencia.map((e, k) => (
            <li key={k}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const colorRiesgo: Record<string, string> = {
  bajo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  medio: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  alto: "bg-red-500/15 text-red-700 dark:text-red-300",
};

function Informe({ a }: { a: Analisis }) {
  const habla = a.cabal.hablaDeCabal.toLowerCase();
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-surface-muted p-4">
        <p className="text-sm">{a.resumen}</p>
        {a.homonimos && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {a.homonimos}
          </p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Orientacion o={a.orientacion} />

        <div className="rounded-2xl border border-border p-4">
          <p className={sub}>
            <MessageSquareQuote className="size-3.5" aria-hidden="true" /> ¿Ha hablado de María Fernanda Cabal?
          </p>
          <p className="mt-2 text-sm font-bold uppercase">
            <span className={habla === "si" || habla === "sí" ? "text-amber-600" : ""}>{a.cabal.hablaDeCabal}</span>
          </p>
          {a.cabal.detalle && <p className="mt-1 text-sm">{a.cabal.detalle}</p>}
          {a.cabal.citas.length > 0 && (
            <ul className="mt-2 space-y-1 border-l-2 border-brand/40 pl-3 text-xs italic text-muted-foreground">
              {a.cabal.citas.map((c, k) => (
                <li key={k}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {a.redes.length > 0 && (
        <div className="rounded-2xl border border-border p-4">
          <p className={sub}>Redes sociales encontradas por la IA</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3">Red</th>
                  <th className="pr-3">Cuenta</th>
                  <th className="pr-3">Seguidores</th>
                  <th>Actividad</th>
                </tr>
              </thead>
              <tbody>
                {a.redes.map((r, k) => (
                  <tr key={k} className="border-t border-border align-top">
                    <td className="py-1.5 pr-3 font-semibold">{r.red}</td>
                    <td className="pr-3">{r.usuario}</td>
                    <td className="pr-3">{r.seguidores}</td>
                    <td>{r.actividad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {a.controversias.length > 0 && (
          <div className="rounded-2xl border border-border p-4">
            <p className={sub}>Controversias y denuncias</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {a.controversias.map((c, k) => (
                <li key={k}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {a.trayectoria && (
          <div className="rounded-2xl border border-border p-4">
            <p className={sub}>Trayectoria</p>
            <p className="mt-2 text-sm">{a.trayectoria}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border p-4">
        <p className={sub}>
          <ShieldAlert className="size-3.5" aria-hidden="true" /> Riesgo para la Fundación
        </p>
        <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${colorRiesgo[a.riesgo.nivel.toLowerCase()] ?? colorRiesgo.medio}`}>
          {a.riesgo.nivel}
        </span>
        {a.riesgo.motivos.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {a.riesgo.motivos.map((m, k) => (
              <li key={k}>{m}</li>
            ))}
          </ul>
        )}
        {a.recomendacion && <p className="mt-3 border-t border-border pt-2 text-sm font-medium">{a.recomendacion}</p>}
      </div>
    </div>
  );
}

function Tarjetas({ temas }: { temas: Tema[] }) {
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const actual = temas.find((t) => t.id === abierto);
  return (
    <>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {temas.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAbierto(abierto === t.id ? null : t.id)}
            className={`rounded-xl border p-3 text-left transition ${abierto === t.id ? "border-brand bg-brand/10" : "border-border hover:border-brand/50"}`}
          >
            <span className="block text-xl font-bold">{t.error ? "—" : t.noticias.length}</span>
            <span className="block text-[11px] leading-tight text-muted-foreground">{t.titulo}</span>
          </button>
        ))}
      </div>
      {actual && (
        <div className="mt-3 rounded-2xl border border-border p-4">
          <p className={sub}>{actual.titulo}</p>
          <div className="mt-2">
            {actual.error ? (
              <p className="text-sm text-red-700 dark:text-red-300">{actual.error}</p>
            ) : actual.noticias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin titulares para este tema.</p>
            ) : (
              <Titulares lista={actual.noticias} max={10} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function InvestigacionAval({ nombre, datos }: { nombre: string; datos: Peticion<PresenciaInternet> }) {
  const [ia, setIa] = React.useState<EstadoIa>({ estado: "inicial" });

  const investigar = () => {
    setIa({ estado: "buscando" });
    fetch("/api/admin/avales/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        return body as ResumenIa;
      })
      .then((data) => setIa({ estado: "listo", data }))
      .catch((err: Error) => setIa({ estado: "error", error: err.message }));
  };

  return (
    <section>
      <h4 className="flex items-center gap-1.5 text-sm font-bold tracking-wide uppercase">
        <Globe className="size-4 text-brand" aria-hidden="true" /> Investigación a fondo
      </h4>

      <div className="mt-2 rounded-2xl border border-brand/30 bg-brand/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm">
            La IA busca en internet su discurso, su orientación política, si alguna vez habló de María Fernanda Cabal, sus redes y sus controversias,
            partiendo de los titulares reales de abajo.
          </p>
          <button
            type="button"
            onClick={investigar}
            disabled={ia.estado === "buscando"}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {ia.estado === "buscando" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
            {ia.estado === "buscando" ? "Investigando…" : ia.estado === "listo" ? "Investigar de nuevo" : "Investigar a fondo"}
          </button>
        </div>
        {ia.estado === "buscando" && <p className="mt-2 text-xs text-muted-foreground">Puede tardar uno o dos minutos: hace varias búsquedas en la web.</p>}
        {ia.estado === "error" && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{ia.error}</p>}
      </div>

      {ia.estado === "listo" && (
        <div className="mt-3">
          {ia.data.analisis ? <Informe a={ia.data.analisis} /> : <Markdown texto={ia.data.texto} />}
          {ia.data.fuentes.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-semibold text-muted-foreground">Fuentes consultadas por la IA ({ia.data.fuentes.length})</summary>
              <ul className="mt-2 space-y-1">
                {ia.data.fuentes.map((f, i) => (
                  <li key={i}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline dark:text-emerald-300">
                      {f.titulo}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Análisis generado por IA a partir de fuentes públicas: la orientación es una inferencia y puede fallar. Verifica los enlaces antes de decidir.
          </p>
        </div>
      )}

      <p className={`${sub} mt-5`}>
        <Newspaper className="size-3.5" aria-hidden="true" /> Rastreo en prensa (Google Noticias, titulares reales)
      </p>
      {datos.estado === "cargando" ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Rastreando seis temas en la prensa…
        </p>
      ) : datos.estado === "error" ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{datos.error}</p>
      ) : (
        <>
          <div className="mt-2 rounded-2xl border border-border p-4">
            <p className={sub}>
              <MessageSquareQuote className="size-3.5" aria-hidden="true" /> Titulares que nombran a esta persona y a Cabal
            </p>
            {datos.data.mencionesCabal.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Ningún titular los nombra juntos. Es una señal parcial: solo se lee el titular, no el cuerpo de la nota ni lo que dijo en redes.
              </p>
            ) : (
              <div className="mt-2">
                <Titulares lista={datos.data.mencionesCabal} />
              </div>
            )}
          </div>
          <Tarjetas temas={datos.data.temas} />
        </>
      )}

      <p className={`${sub} mt-5`}>Revisión manual en redes</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {enlacesRedes(nombre).map((e) => (
          <a
            key={e.plataforma}
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold ring-1 ring-border transition hover:ring-emerald-500/50"
          >
            {e.plataforma} <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          </a>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        X, Facebook, Instagram y TikTok no se pueden leer automáticamente sin las credenciales de una cuenta: son búsquedas listas para abrir.
      </p>
    </section>
  );
}
