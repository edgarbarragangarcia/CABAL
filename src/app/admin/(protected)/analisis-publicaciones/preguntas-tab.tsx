"use client";

import * as React from "react";
import { ChevronDown, Loader2, MessageSquareText, Send, Sparkles } from "lucide-react";

import { Markdown } from "./markdown-ia";

type Hecha = { descripcion: string; ok: boolean; datos: string };
type Intercambio = { pregunta: string; respuesta?: string; consultas?: Hecha[]; error?: string };

const EJEMPLOS = [
  "¿Cuántos votos sacó María Fernanda Cabal en Bogotá en el Senado 2022?",
  "Compara a Paloma Valencia entre el Senado 2022 y el de 2026 en Antioquia",
  "¿Qué partidos ganaron en Valle del Cauca en el Senado 2026?",
  "¿En qué municipios de Antioquia le fue mejor a Álvaro Uribe Vélez en el Senado 2018?",
];

/**
 * Preguntas en lenguaje natural sobre los resultados electorales oficiales
 * (2018 a 2026). La IA planea las consultas, el servidor las ejecuta con los datos
 * de la Registraduría y la IA redacta la respuesta; debajo de cada una se ven las
 * consultas hechas, para verificar las cifras.
 */
export function PreguntasTab() {
  const [pregunta, setPregunta] = React.useState("");
  const [lista, setLista] = React.useState<Intercambio[]>([]);
  const [cargando, setCargando] = React.useState(false);
  const fin = React.useRef<HTMLDivElement>(null);

  const enviar = (texto: string) => {
    const q = texto.trim();
    if (q.length < 5 || cargando) return;
    setPregunta("");
    setCargando(true);
    setLista((l) => [...l, { pregunta: q }]);
    fetch("/api/admin/preguntar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta: q }) })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        return { respuesta: body.respuesta as string, consultas: body.consultas as Hecha[] };
      })
      .catch((err: Error) => ({ error: err.message }))
      .then((resultado) => {
        setLista((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, ...resultado } : x)));
        setCargando(false);
        requestAnimationFrame(() => fin.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
      });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <p className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <MessageSquareText className="size-5 text-brand" aria-hidden="true" />
          Pregúntale a los datos
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Resultados oficiales de la Registraduría de 2018 a 2026: resultados por territorio, votos de un candidato y cambio entre dos
          elecciones. Las cifras salen de los datos, no de la memoria de la IA; debajo de cada respuesta puedes ver las consultas que hizo.
        </p>
        {lista.length === 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {EJEMPLOS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => enviar(e)}
                className="rounded-full border border-border px-3 py-1.5 text-left text-xs transition hover:bg-surface-muted"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {lista.map((x, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-brand px-4 py-2 text-sm text-brand-foreground">{x.pregunta}</p>
            <div className="rounded-2xl rounded-bl-md border border-border bg-surface p-4 shadow-sm">
              {!x.respuesta && !x.error ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Consultando los datos oficiales… (puede tardar hasta un minuto)
                </p>
              ) : x.error ? (
                <p className="text-sm text-red-700 dark:text-red-300">{x.error}</p>
              ) : (
                <>
                  <Markdown texto={x.respuesta!} />
                  {x.consultas && x.consultas.length > 0 && (
                    <details className="group mt-3 rounded-xl bg-surface-muted/60 p-3 text-xs">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium">
                        <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
                        {x.consultas.length === 1 ? "1 consulta hecha" : `${x.consultas.length} consultas hechas`}
                        <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {x.consultas.map((c, k) => (
                          <li key={k}>
                            <p className={`font-semibold ${c.ok ? "" : "text-red-700 dark:text-red-300"}`}>{c.descripcion}</p>
                            <pre className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{c.datos}</pre>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={fin} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(pregunta);
        }}
        className="sticky bottom-4 mt-4 flex gap-2 rounded-full border border-border bg-surface p-1.5 shadow-lg"
      >
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          maxLength={500}
          placeholder="Pregunta sobre los resultados electorales…"
          aria-label="Tu pregunta"
          className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={cargando || pregunta.trim().length < 5}
          aria-label="Enviar la pregunta"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground disabled:opacity-50"
        >
          {cargando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}
