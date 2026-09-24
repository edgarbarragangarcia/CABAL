import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { MAFE_SYSTEM_PROMPT } from "@/lib/mafe/system-prompt";

export const maxDuration = 60;

const MODEL = "claude-opus-5";

/** Límites para un chat público (el proxy además limita a 10 mensajes por minuto por IP). */
const MAX_MESSAGES = 12;
const MAX_USER_CHARS = 1000;
const MAX_ASSISTANT_CHARS = 3000;

const REFUSAL_TEXT =
  "Prefiero no responder a eso. ¿Te ayudo con algo sobre la Fundación, sus cursos o sus observatorios?";

/** Deja solo los últimos turnos válidos, recortados, empezando y terminando con el visitante. */
function sanitize(body: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  const raw = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw)) return null;

  const messages: Anthropic.Beta.BetaMessageParam[] = raw
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== ""
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, m.role === "user" ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS),
    }));

  while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

function errorResponse(err: unknown) {
  // Sin credenciales el SDK falla antes de llamar a la API: AnthropicError que no es APIError.
  const notConfigured =
    err instanceof Anthropic.AuthenticationError ||
    (err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError));
  if (notConfigured) {
    return NextResponse.json(
      { error: "MaFe no está configurada todavía: revisa ANTHROPIC_API_KEY en el servidor." },
      { status: 503 }
    );
  }
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json(
      { error: "MaFe está atendiendo muchas conversaciones. Intenta de nuevo en un momento." },
      { status: 429 }
    );
  }
  return NextResponse.json(
    { error: "MaFe no pudo responder ahora mismo. Intenta de nuevo." },
    { status: 502 }
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const messages = sanitize(body);
  if (!messages) {
    return NextResponse.json({ error: "Falta el mensaje." }, { status: 400 });
  }

  const client = new Anthropic();
  const stream = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 4096,
      // Si el modelo declina por política, la API reintenta con otro en la misma llamada.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // Conversación de chat: poco razonamiento basta y responde más rápido.
      output_config: { effort: "low" },
      // Cachea instrucciones + historial: cada turno reutiliza lo ya enviado.
      cache_control: { type: "ephemeral" },
      system: MAFE_SYSTEM_PROMPT,
      messages,
    },
    { signal: req.signal }
  );

  // Esperar el primer evento antes de responder: así los errores de
  // configuración o de límites llegan como JSON con su código, no a mitad del texto.
  const events = stream[Symbol.asyncIterator]();
  let first: IteratorResult<Anthropic.Beta.BetaRawMessageStreamEvent>;
  try {
    first = await events.next();
  } catch (err) {
    return errorResponse(err);
  }

  const encoder = new TextEncoder();
  const text = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: Anthropic.Beta.BetaRawMessageStreamEvent) => {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      };
      try {
        for (let r = first; !r.done; r = await events.next()) push(r.value);
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode(REFUSAL_TEXT));
      } catch {
        controller.enqueue(encoder.encode("\n\n(Se cortó la respuesta. Intenta de nuevo.)"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
