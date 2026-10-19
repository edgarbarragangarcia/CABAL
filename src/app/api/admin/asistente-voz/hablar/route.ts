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

const MODELOS_TTS_GEMINI = ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts", "gemini-2.5-pro-preview-tts"];

/** Los modelos de voz que ofrece esta clave (por si el nombre cambió): los que tienen «tts» y generan contenido. */
async function modelosDeVoz(clave: string): Promise<string[]> {
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": clave }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return [];
    const j = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    return (j.models ?? []).filter((m) => /tts/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m) => m.name.replace(/^models\//, ""));
  } catch {
    return [];
  }
}

type Resultado = { audio: Buffer | null; motivo?: string };

let modeloQueSirve: string | null = null;

async function conGemini(texto: string, clave: string): Promise<Resultado> {
  let motivo = "";
  // Rápido: primero el modelo que ya funcionó o los conocidos; solo si todos fallan se consulta la lista de la clave (tarda).
  const rapidos = [...new Set([...(modeloQueSirve ? [modeloQueSirve] : []), ...MODELOS_TTS_GEMINI])];
  for (const fase of [0, 1]) {
    const candidatos = fase === 0 ? rapidos : (await modelosDeVoz(clave)).filter((m) => !rapidos.includes(m));
    const r = await intentarModelos(candidatos, texto, clave);
    if (r.audio) return r;
    motivo = r.motivo ?? motivo;
  }
  return { audio: null, motivo: motivo || "Gemini no ofrece voz con esta clave" };
}

async function intentarModelos(candidatos: string[], texto: string, clave: string): Promise<Resultado> {
  let motivo = "";
  for (const modelo of candidatos) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Habla como una dirigente política colombiana apasionada, en español de Colombia: con firmeza, convicción y calidez, con sentimiento real. Pon énfasis en las palabras clave, haz pausas con intención y deja que la entonación suba y baje según la emoción de lo que dices (indignación, orgullo, cariño). Jamás suenes monótona ni como locutora de noticias. Texto: ${texto}` }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string }; candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
      if (!r.ok) {
        motivo = `${modelo}: ${j.error?.message ?? r.status}`;
        continue;
      }
      const b64 = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (b64) { modeloQueSirve = modelo; return { audio: aWav(Buffer.from(b64, "base64")) }; }
      motivo = `${modelo}: respondió sin audio`;
    } catch (e) {
      motivo = `${modelo}: ${e instanceof Error ? e.message : "sin respuesta"}`;
    }
  }
  return { audio: null, motivo };
}

async function conOpenAI(texto: string, clave: string): Promise<Resultado> {
  try {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "nova", input: texto, instructions: "Español de Colombia. Dirigente política apasionada: firme, cálida, con énfasis y emoción real en lo que dice; nada monótona ni de locutora.", response_format: "mp3" }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!r.ok) return { audio: null, motivo: `OpenAI ${r.status}` };
    return { audio: Buffer.from(await r.arrayBuffer()) };
  } catch (e) {
    return { audio: null, motivo: `OpenAI: ${e instanceof Error ? e.message : "sin respuesta"}` };
  }
}

/**
 * POST { texto } → audio con una voz natural, con la clave de Gemini u OpenAI de Configuración. Sin clave o si falla: 204, y el
 * navegador habla con la voz del sistema.
 */
export async function POST(req: Request) {
  const p = z.object({ texto: z.string().trim().min(1).max(700) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return new Response(null, { status: 422 });
  const motivos: string[] = [];
  for (const proveedor of ["gemini", "openai"] as const) {
    const k = await claveParaVectores(proveedor).catch(() => null);
    if (!k) { motivos.push(`sin clave de ${proveedor}`); continue; }
    const r = proveedor === "gemini" ? await conGemini(p.data.texto, k.clave) : await conOpenAI(p.data.texto, k.clave);
    if (r.audio) return new Response(new Uint8Array(r.audio), { headers: { "Content-Type": proveedor === "gemini" ? "audio/wav" : "audio/mpeg", "Cache-Control": "private, no-store", "X-Voz": proveedor } });
    if (r.motivo) motivos.push(r.motivo);
  }
  // Sin voz natural: el navegador habla con la voz del sistema. El motivo viaja en una cabecera para mostrarlo.
  return new Response(null, { status: 204, headers: { "X-Voz-Motivo": encodeURIComponent(motivos.join(" · ").slice(0, 300)) } });
}
