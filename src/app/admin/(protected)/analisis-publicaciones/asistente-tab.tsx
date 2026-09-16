"use client";

import * as React from "react";
import { AlertTriangle, Bot, Database, Loader2, Send, User } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "¿Cuántas publicaciones hay por plataforma?",
  "¿Qué tabla usarías para guardar las menciones reales?",
  "Explícame cómo conectarías esta pantalla a datos reales.",
];

export function AsistenteTab() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "No se pudo obtener respuesta.");
        return;
      }
      setMessages([...next, { role: "assistant", content: data.reply ?? "" }]);
    } catch {
      setError("No se pudo conectar con el asistente. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[70vh] min-h-[480px] flex-col rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="size-4 text-brand" aria-hidden="true" />
          Asistente técnico (Claude + Supabase)
        </p>
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
          <Database className="size-3" aria-hidden="true" />
          query_supabase
        </span>
      </div>

      <p className="border-b border-border bg-surface-muted px-4 py-2 text-[11px] text-muted-foreground">
        Pregúntale a Claude sobre los datos del proyecto. Cuando la pregunta necesite cifras reales,
        usa su herramienta para consultar Supabase directamente y responde en un tono técnico
        (nombres de columna, conteos, consultas). Si Supabase o la API key de Anthropic no están
        configuradas, te lo va a decir en vez de inventar datos.
      </p>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Bot className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="max-w-xs text-xs text-muted-foreground">
              Escribe una pregunta técnica, o prueba una de estas:
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                m.role === "user" ? "bg-brand text-brand-foreground" : "bg-brand-soft text-brand"
              }`}
            >
              {m.role === "user" ? (
                <User className="size-3.5" aria-hidden="true" />
              ) : (
                <Bot className="size-3.5" aria-hidden="true" />
              )}
            </span>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-brand text-brand-foreground"
                  : "border border-border bg-surface-muted text-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Consultando...
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregúntale algo técnico a Claude..."
          disabled={loading}
          className="h-10 flex-1 rounded-full border border-border bg-background px-4 text-sm outline-none focus:border-brand disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-opacity disabled:opacity-40"
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
