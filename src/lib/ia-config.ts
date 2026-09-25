import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";
import { cookies } from "next/headers";

/**
 * Proveedor de IA del panel (Claude, Gemini u OpenAI), elegido en
 * /admin/configuracion. Las claves se guardan cifradas (AES-GCM, con una
 * llave derivada de ADMIN_SESSION_SECRET) en Upstash Redis o, si no está
 * configurado, en una cookie httpOnly cifrada de este navegador. Nunca vuelven
 * en claro al navegador. Sin configuración guardada, se usa ANTHROPIC_API_KEY.
 */

export type Proveedor = "anthropic" | "gemini" | "openai";

export const PROVEEDORES: Record<Proveedor, { nombre: string; modelo: string }> = {
  anthropic: { nombre: "Claude (Anthropic)", modelo: "claude-opus-5-5" },
  gemini: { nombre: "Gemini (Google)", modelo: "gemini-3.1-pro-preview" },
  openai: { nombre: "OpenAI", modelo: "gpt-5" },
};

type Guardada = { proveedor: Proveedor; modelo: string; claves: Partial<Record<Proveedor, string>> };

const CLAVE_REDIS = "el-admin:ia-config";

function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

const COOKIE = "el_admin_ia";

async function llave() {
  const secreto = process.env.ADMIN_SESSION_SECRET ?? "escuela-libertad-admin-dev-secret-cambiar-en-produccion";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ia-config:${secreto}`));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function cifrar(texto: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await llave(), new TextEncoder().encode(texto));
  return `${Buffer.from(iv).toString("base64")}.${Buffer.from(datos).toString("base64")}`;
}

async function descifrar(valor: string) {
  const [iv, datos] = valor.split(".").map((p) => Buffer.from(p, "base64"));
  const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await llave(), datos);
  return new TextDecoder().decode(plano);
}

async function leer(): Promise<Guardada | null> {
  const r = redis();
  if (r) return (await r.get<Guardada>(CLAVE_REDIS)) ?? null;
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return null;
  try {
    return JSON.parse(await descifrar(valor)) as Guardada;
  } catch {
    return null;
  }
}

/** Lo que ve la página: nunca la clave, solo sus últimos 4 caracteres. */
export async function resumenConfig() {
  const g = await leer();
  const claves: Partial<Record<Proveedor, string>> = {};
  for (const p of Object.keys(g?.claves ?? {}) as Proveedor[]) {
    try {
      claves[p] = `••••${(await descifrar(g!.claves[p]!)).slice(-4)}`;
    } catch {
      claves[p] = "no se pudo leer (cambió ADMIN_SESSION_SECRET)";
    }
  }
  return {
    /** "redis" (compartida) o "cookie" (solo este navegador). */
    almacen: redis() ? "redis" : "cookie",
    proveedor: g?.proveedor ?? "anthropic",
    modelo: g?.modelo ?? PROVEEDORES.anthropic.modelo,
    claves,
    anthropicEnv: !!process.env.ANTHROPIC_API_KEY,
  };
}

export async function guardarConfig(proveedor: Proveedor, modelo: string, clave?: string) {
  const r = redis();
  const g: Guardada = (await leer()) ?? { proveedor, modelo, claves: {} };
  g.proveedor = proveedor;
  g.modelo = modelo.trim() || PROVEEDORES[proveedor].modelo;
  if (clave?.trim()) g.claves[proveedor] = await cifrar(clave.trim());
  if (r) await r.set(CLAVE_REDIS, g);
  else {
    (await cookies()).set(COOKIE, await cifrar(JSON.stringify(g)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/admin",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
}

/** Genera texto con el proveedor configurado. */
export async function generarTexto({ system, user, maxTokens }: { system: string; user: string; maxTokens: number }) {
  const g = await leer();
  const proveedor = g?.proveedor ?? "anthropic";
  const modelo = g?.modelo || PROVEEDORES[proveedor].modelo;
  const guardada = g?.claves[proveedor] ? await descifrar(g.claves[proveedor]!) : undefined;
  const clave = guardada ?? (proveedor === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined);
  if (!clave) throw new Error(`Falta la clave API de ${PROVEEDORES[proveedor].nombre}. Agrégala en Configuración.`);

  if (proveedor === "anthropic") {
    const res = await new Anthropic({ apiKey: clave }).messages.create({
      model: modelo,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
  }
  if (proveedor === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Gemini respondió: ${body.error?.message ?? res.status}`);
    return (body.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("\n");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
    body: JSON.stringify({
      model: modelo,
      max_completion_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OpenAI respondió: ${body.error?.message ?? res.status}`);
  return body.choices?.[0]?.message?.content ?? "";
}

/** Clave del proveedor: la escrita ahora, la guardada o (Anthropic) la variable de entorno. */
async function claveDe(proveedor: Proveedor, escrita?: string) {
  if (escrita?.trim()) return escrita.trim();
  const g = await leer();
  if (g?.claves[proveedor]) return descifrar(g.claves[proveedor]!);
  return proveedor === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined;
}

/** Modelos de texto que ofrece el proveedor a esta clave, consultados en su API. */
export async function listarModelos(proveedor: Proveedor, escrita?: string): Promise<string[]> {
  const clave = await claveDe(proveedor, escrita);
  if (!clave) throw new Error("Escribe la clave API para ver los modelos.");
  if (proveedor === "gemini") {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
      headers: { "x-goog-api-key": clave },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Gemini respondió: ${body.error?.message ?? res.status}`);
    return (body.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: { name: string }) => m.name.replace(/^models\//, ""));
  }
  if (proveedor === "openai") {
    const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${clave}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`OpenAI respondió: ${body.error?.message ?? res.status}`);
    return (body.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => /^(gpt|o\d)/.test(id))
      .sort();
  }
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": clave, "anthropic-version": "2023-06-01" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Anthropic respondió: ${body.error?.message ?? res.status}`);
  return (body.data ?? []).map((m: { id: string }) => m.id);
}
