import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export const maxDuration = 60;

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `Eres el asistente técnico interno del panel administrativo de la Fundación
Escuela Libertad. Quien te habla es parte del equipo (no un visitante público), así que responde
siempre en un tono TÉCNICO Y PRECISO: cita nombres de columnas, tipos de dato, conteos exactos y
consultas cuando aplique, en vez de resúmenes vagos.

Tienes una herramienta \`query_supabase\` para leer datos reales de la base de datos del proyecto.
Úsala cuando la pregunta requiera datos concretos (cifras, registros, conteos). Si la herramienta
devuelve un error de "no configurado", explícale al usuario claramente que este proyecto todavía no
tiene una base de datos Supabase conectada (faltan las variables de entorno SUPABASE_URL y
SUPABASE_SERVICE_ROLE_KEY) — no inventes datos para rellenar el hueco.

No hagas escrituras ni cambios de esquema: solo lectura.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "query_supabase",
    description:
      "Ejecuta un SELECT de solo lectura contra una tabla de Supabase (Postgres) y devuelve las filas. Usa esto para responder con datos reales en vez de suposiciones.",
    input_schema: {
      type: "object",
      properties: {
        table: { type: "string", description: "Nombre de la tabla a consultar." },
        select: {
          type: "string",
          description: "Columnas a seleccionar, formato PostgREST (por defecto '*').",
        },
        limit: {
          type: "number",
          description: "Máximo de filas a devolver (por defecto 20, máximo 100).",
        },
      },
      required: ["table"],
    },
  },
];

async function runQuerySupabase(input: { table: string; select?: string; limit?: number }) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      error:
        "No configurado: este proyecto no tiene una base de datos Supabase conectada todavía (faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en las variables de entorno).",
    };
  }

  const limit = Math.min(input.limit ?? 20, 100);
  const { data, error } = await supabase
    .from(input.table)
    .select(input.select ?? "*")
    .limit(limit);

  if (error) return { error: error.message };
  return { rows: data, count: data?.length ?? 0 };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "No configurado: falta ANTHROPIC_API_KEY en las variables de entorno del servidor. Consíguela en console.anthropic.com y agrégala en Vercel (Project Settings → Environment Variables), luego vuelve a desplegar.",
      },
      { status: 500 }
    );
  }

  let body: { messages?: { role: "user" | "assistant"; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "Falta el mensaje." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const conversation: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Bucle de uso de herramientas: hasta 4 idas y vueltas con la
    // herramienta de Supabase antes de forzar una respuesta final.
    for (let step = 0; step < 5; step++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1536,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: conversation,
      });

      const toolUses = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n\n");
        return NextResponse.json({ reply: text });
      }

      conversation.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const result =
          toolUse.name === "query_supabase"
            ? await runQuerySupabase(toolUse.input as { table: string; select?: string; limit?: number })
            : { error: `Herramienta desconocida: ${toolUse.name}` };
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
      conversation.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({ reply: "No se pudo completar la respuesta (demasiadas consultas)." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido.";
    return NextResponse.json({ error: `Error al consultar a Claude: ${message}` }, { status: 502 });
  }
}
