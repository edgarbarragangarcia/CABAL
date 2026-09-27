"use client";

import * as React from "react";
import { CalendarClock, Check, Circle, Loader2, Send } from "lucide-react";

type Estado = { telegram: boolean; cron: boolean; ia: boolean };

/** Informe semanal por Telegram: qué falta configurar, y botones para verlo o enviarlo ahora. */
export function InformeSemanal() {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [accion, setAccion] = React.useState<{ cargando?: "vista" | "enviar"; texto?: string; enviado?: boolean; conIA?: boolean; error?: string }>({});

  React.useEffect(() => {
    fetch("/api/admin/informe", { cache: "no-store" })
      .then((r) => r.json())
      .then(setEstado)
      .catch(() => setEstado(null));
  }, []);

  const correr = (que: "vista" | "enviar") => {
    setAccion({ cargando: que });
    fetch("/api/admin/informe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: que }) })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "No se pudo generar el informe.");
        setAccion({ texto: body.texto, enviado: body.enviado, conIA: body.conIA });
      })
      .catch((err: Error) => setAccion({ error: err.message }));
  };

  const pasos: { hecho: boolean; titulo: string; detalle: React.ReactNode }[] = [
    {
      hecho: !!estado?.telegram,
      titulo: "Crea el bot de Telegram",
      detalle: (
        <>
          En Telegram abre <b>@BotFather</b>, escribe <code>/newbot</code> y copia el token. Luego escríbele cualquier mensaje a tu bot (o
          agrégalo a un grupo) y abre <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code>: el número que sale en{" "}
          <code>&quot;chat&quot;:&#123;&quot;id&quot;:…</code> es tu chat. En Vercel crea <code>TELEGRAM_BOT_TOKEN</code> y{" "}
          <code>TELEGRAM_CHAT_ID</code>. El token es como una contraseña: no lo compartas.
        </>
      ),
    },
    {
      hecho: !!estado?.cron,
      titulo: "Activa el envío automático",
      detalle: (
        <>
          En Vercel crea <code>CRON_SECRET</code> con una frase larga al azar y vuelve a desplegar. Con eso Vercel lanza el informe solo, cada lunes a las 7:00 a. m.
          (hora de Colombia).
        </>
      ),
    },
    {
      hecho: !!estado?.ia,
      titulo: "Lectura con IA (opcional)",
      detalle: (
        <>
          El informe puede incluir una lectura de la semana escrita por IA. Necesita una clave de IA guardada en la sección de arriba o{" "}
          <code>ANTHROPIC_API_KEY</code> en Vercel. Sin ella, el informe sale igual, sin esa parte.
        </>
      ),
    },
  ];

  return (
    <section className="mt-8 max-w-3xl rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <CalendarClock className="size-5 text-brand" aria-hidden="true" />
        Informe semanal por Telegram
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada lunes a las 7:00 a. m. (hora de Colombia): noticias de la semana frente a la anterior, videos de SoyCabalTV, visitas a Wikipedia y
        una lectura con IA.
      </p>

      <ol className="mt-4 space-y-3">
        {pasos.map((p, i) => (
          <li key={p.titulo} className="flex gap-3 rounded-xl border border-border p-3 text-sm">
            {p.hecho ? (
              <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-label="Listo" />
            ) : (
              <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-label="Pendiente" />
            )}
            <div className="min-w-0 [&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px] [&_code]:break-all">
              <p className="font-semibold">
                {i + 1}. {p.titulo}
              </p>
              {!p.hecho && <p className="mt-1 leading-relaxed text-muted-foreground">{p.detalle}</p>}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => correr("vista")}
          disabled={!!accion.cargando}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
        >
          {accion.cargando === "vista" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Ver el informe de esta semana
        </button>
        <button
          type="button"
          onClick={() => correr("enviar")}
          disabled={!!accion.cargando || !estado?.telegram}
          title={estado?.telegram ? undefined : "Primero configura el bot de Telegram"}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
        >
          {accion.cargando === "enviar" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          Enviarlo ahora a Telegram
        </button>
      </div>

      {accion.error && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{accion.error}</p>}
      {accion.texto && (
        <div className="mt-3">
          {accion.enviado && (
            <p className="mb-2 flex items-center gap-1 text-sm text-brand">
              <Check className="size-4" aria-hidden="true" /> Enviado a Telegram.
            </p>
          )}
          {!accion.conIA && <p className="mb-2 text-xs text-muted-foreground">Sin lectura con IA: no hay una clave configurada.</p>}
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl bg-surface-muted p-3 text-xs leading-relaxed">{accion.texto}</pre>
        </div>
      )}
    </section>
  );
}
