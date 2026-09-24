"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { MafeAvatar } from "./mafe-avatar";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Mensajes que no se envían a la API: el saludo y los avisos de error. */
  local?: boolean;
  error?: boolean;
};

const GREETING: ChatMessage = {
  role: "assistant",
  local: true,
  content:
    "¡Hola! Soy **MaFe**, la asistente virtual de la Fundación Escuela Libertad. Te cuento de los cursos, los observatorios y todo lo que quieras saber de la Fundación. ¿Por dónde empezamos?",
};

const SUGGESTIONS = [
  "¿Qué cursos ofrece la Academia?",
  "¿Qué es la libertad económica?",
  "¿Quién es María Fernanda Cabal?",
  "¿Cómo puedo apoyar a la Fundación?",
];

const MAX_CHARS = 1000;
const INTRO_KEY = "mafe-intro-dismissed";

/** **negrita**, rutas del sitio (/cursos) y enlaces externos dentro de las respuestas. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+|(?<![\w/.])\/[a-z0-9-]+(?:\/[a-z0-9-]+)*(?:#[a-z0-9-]+)?)/gi);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (/^https?:\/\//i.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline underline-offset-2">
              {part.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          );
        }
        if (/^\/[a-z0-9-]/i.test(part)) {
          return (
            <Link key={i} href={part} className="font-medium text-brand underline underline-offset-2">
              {part}
            </Link>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="MaFe está escribiendo">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export function MafeChat() {
  const [open, setOpen] = React.useState(false);
  const [showIntro, setShowIntro] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Burbuja de saludo una vez por sesión, un par de segundos después de cargar.
  React.useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {}
    if (dismissed) return;
    const timer = window.setTimeout(() => setShowIntro(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const dismissIntro = React.useCallback(() => {
    setShowIntro(false);
    try {
      window.sessionStorage.setItem(INTRO_KEY, "1");
    } catch {}
  }, []);

  React.useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, open]);

  React.useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  function openChat() {
    dismissIntro();
    setOpen(true);
  }

  function reset() {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages([GREETING]);
    setInput("");
  }

  async function send(raw: string) {
    const content = raw.trim().slice(0, MAX_CHARS);
    if (!content || streaming) return;

    const history = [...messages.filter((m) => !m.local && !m.error), { role: "user" as const, content }];
    setMessages((prev) => [...prev, { role: "user", content }, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const appendToLast = (update: (last: ChatMessage) => ChatMessage) =>
      setMessages((prev) => [...prev.slice(0, -1), update(prev[prev.length - 1])]);

    try {
      const res = await fetch("/api/mafe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "MaFe no pudo responder ahora mismo. Intenta de nuevo.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        appendToLast((last) => ({ ...last, content: last.content + chunk }));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      appendToLast((last) => ({
        role: "assistant",
        error: true,
        content: last.content || (err instanceof Error ? err.message : "Algo salió mal."),
      }));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setStreaming(false);
      }
    }
  }

  const last = messages[messages.length - 1];
  const waiting = streaming && last.role === "assistant" && last.content === "";
  const talking = streaming && !waiting;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Chat con MaFe"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-3 bottom-3 top-20 z-[60] flex origin-bottom-right flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-[var(--shadow-3)] sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:max-h-[calc(100dvh-8rem)] sm:w-[390px]"
          >
            {/* Encabezado */}
            <div className="relative flex items-center gap-3 overflow-hidden bg-[linear-gradient(135deg,#0a4f37_0%,#1f9d6c_60%,#7ee2b8_100%)] px-4 py-3.5 text-white">
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.6)_1px,transparent_0)] [background-size:14px_14px] [mask-image:linear-gradient(to_left,black,transparent)]"
              />
              <span className="relative">
                <MafeAvatar talking={talking} className="size-12 drop-shadow-md" />
                <span className="absolute bottom-0.5 right-0.5 size-3 rounded-full border-2 border-[#1f9d6c] bg-lime-300" />
              </span>
              <div className="relative min-w-0 flex-1">
                <p className="font-display text-lg leading-tight">MaFe</p>
                <p className="truncate text-xs text-white/80">
                  {talking ? "Escribiendo…" : "Asistente virtual con IA · Escuela Libertad"}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="relative flex size-8 items-center justify-center rounded-full text-white/85 transition hover:bg-white/15 hover:text-white"
                aria-label="Nueva conversación"
                title="Nueva conversación"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="relative flex size-8 items-center justify-center rounded-full text-white/85 transition hover:bg-white/15 hover:text-white"
                aria-label="Cerrar chat"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Conversación */}
            <div
              ref={listRef}
              data-lenis-prevent
              aria-live="polite"
              className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
            >
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-sm text-brand-foreground">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="flex items-end gap-2">
                    <MafeAvatar
                      talking={talking && i === messages.length - 1}
                      className="size-7 shrink-0"
                      title="MaFe"
                    />
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed",
                        m.error
                          ? "border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                          : "bg-surface-muted text-foreground"
                      )}
                    >
                      {m.content ? <RichText text={m.content} /> : <TypingDots />}
                    </div>
                  </div>
                )
              )}

              {messages.length === 1 && (
                <div className="flex flex-wrap gap-2 pl-9 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-left text-xs font-medium text-brand transition hover:border-brand hover:bg-brand hover:text-brand-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Escribir */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-border p-3"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-muted px-3 py-2 focus-within:border-brand/60">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Escríbele a MaFe…"
                  aria-label="Mensaje para MaFe"
                  className="max-h-28 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none [field-sizing:content] placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition hover:opacity-90 disabled:opacity-40"
                  aria-label="Enviar"
                >
                  <ArrowUp className="size-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-[10.5px] leading-snug text-muted-foreground">
                MaFe es una IA inspirada en María Fernanda Cabal: puede equivocarse y no habla en su
                nombre.
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lanzador */}
      <div className={cn("fixed bottom-5 right-5 z-[60] flex items-end gap-3 sm:right-6", open && "max-sm:hidden")}>
        <AnimatePresence>
          {showIntro && !open && (
            <motion.div
              initial={{ opacity: 0, x: 12, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.95 }}
              className="relative mb-3 max-w-[220px] rounded-2xl rounded-br-md border border-border bg-surface px-4 py-3 text-sm shadow-[var(--shadow-2)]"
            >
              <button
                type="button"
                onClick={dismissIntro}
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm hover:text-foreground"
                aria-label="Cerrar saludo"
              >
                <X className="size-3" />
              </button>
              <button type="button" onClick={openChat} className="text-left">
                <span className="font-semibold">¡Hola! Soy MaFe 👋</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  ¿Te ayudo a encontrar un curso o a conocer la Fundación?
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openChat())}
          aria-expanded={open}
          aria-label={open ? "Cerrar chat con MaFe" : "Abrir chat con MaFe"}
          className="group relative flex size-16 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-3)] ring-2 ring-accent/60 transition hover:scale-105 hover:ring-accent"
        >
          {!open && (
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-ping rounded-full bg-accent/30 [animation-duration:2.5s]"
            />
          )}
          {open ? (
            <X className="size-6 text-foreground" />
          ) : (
            <MafeAvatar className="relative size-16" />
          )}
        </button>
      </div>
    </>
  );
}
