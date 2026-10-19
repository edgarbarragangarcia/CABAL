import { z } from "zod";

import { claveParaVectores } from "@/lib/ia-config";

export const runtime = "nodejs";
export const maxDuration = 30;

/** PCM de 16 bits a 24 kHz (lo que entrega Gemini) envuelto en un WAV que cualquier navegador reproduce. */
function aWav(pcm: Buffer, hz = 24_000): Buffer {
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0); cab.writeUInt32LE(36 + pcm.length, 4); cab.write("WAVE", 8); cab.write("fmt ", 12);
  cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(1, 22); cab.writeUInt32LE(hz, 24); cab.writeUInt32LE(hz * 2, 28);
  cab.writeUInt16LE(2, 32); cab.writeUInt16LE(16, 34); cab.write("data", 36); cab.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([cab, pcm]);
}

const MODELOS_TTS_GEMINI = ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts"];

async function conGemini(texto: string, clave: string): Promise<Buffer | null> {
  for (const modelo of MODELOS_TTS_GEMINI) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Di con naturalidad, en español de Colombia, con un tono cálido y sereno: ${texto}` }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
      const b64 = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (b64) return aWav(Buffer.from(b64, "base64"));
    } catch {
      /* se prueba el siguiente modelo */
    }
  }
  return null;
}

async function conOpenAI(texto: string, clave: string): Promise<Buffer | null> {
  try {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "nova", input: texto, instructions: "Español de Colombia, tono cálido, sereno y natural.", response_format: "mp3" }),
      signal: AbortSignal.timeout(25_000),
    });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/**
 * POST { texto } → audio con una voz natural, con la clave de Gemini u OpenAI de Configuración. Sin clave o si falla: 204, y el
 * navegador habla con la voz del sistema.
 */
export async function POST(req: Request) {
  const p = z.object({ texto: z.string().trim().min(1).max(700) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return new Response(null, { status: 422 });
  for (const proveedor of ["gemini", "openai"] as const) {
    const k = await claveParaVectores(proveedor).catch(() => null);
    if (!k) continue;
    const audio = proveedor === "gemini" ? await conGemini(p.data.texto, k.clave) : await conOpenAI(p.data.texto, k.clave);
    if (audio) return new Response(new Uint8Array(audio), { headers: { "Content-Type": proveedor === "gemini" ? "audio/wav" : "audio/mpeg", "Cache-Control": "private, no-store" } });
  }
  return new Response(null, { status: 204 });
}
