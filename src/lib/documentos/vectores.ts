import "server-only";

import { claveParaVectores } from "@/lib/ia-config";

/**
 * Vectores (embeddings) de los textos de los documentos. Todos son de 768 dimensiones, así caben en la misma columna sea cual sea
 * el proveedor: Gemini (gemini-embedding-001) u OpenAI (text-embedding-3-small), con la clave de Configuración. Los vectores de
 * distintos modelos no se pueden comparar entre sí: cada fragmento guarda con qué modelo se vectorizó y la búsqueda usa el mismo.
 */

export const DIMENSIONES = 768;

export const MODELOS = {
  gemini: "gemini-embedding-001",
  openai: "text-embedding-3-small",
  prueba: "prueba-hash-768",
} as const;

export type ProveedorVectores = { proveedor: keyof typeof MODELOS; clave: string; modelo: string };

/** Vectores falsos, solo para probar en desarrollo sin gastar una clave: las palabras en común se parecen. Nunca en producción. */
const pruebaPermitida = () => process.env.VECTORES_DE_PRUEBA === "1" && process.env.NODE_ENV !== "production";

/** Con qué se vectoriza ahora: la clave de Gemini u OpenAI de Configuración. `null`: no hay ninguna. */
export async function proveedorDeVectores(preferido?: "gemini" | "openai"): Promise<ProveedorVectores | null> {
  if (pruebaPermitida()) return { proveedor: "prueba", clave: "", modelo: MODELOS.prueba };
  const c = await claveParaVectores(preferido);
  return c ? { proveedor: c.proveedor, clave: c.clave, modelo: MODELOS[c.proveedor] } : null;
}

/** El proveedor con el que se vectorizó algo (por el nombre del modelo), para vectorizar la consulta con el mismo. */
export async function proveedorDelModelo(modelo: string): Promise<ProveedorVectores | null> {
  if (modelo === MODELOS.prueba) return pruebaPermitida() ? { proveedor: "prueba", clave: "", modelo } : null;
  const proveedor = modelo === MODELOS.gemini ? "gemini" : modelo === MODELOS.openai ? "openai" : null;
  return proveedor ? proveedorDeVectores(proveedor) : null;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizar(v: number[]): number[] {
  const norma = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norma);
}

/** Vector de prueba: cada palabra (sin tildes) cae en una posición de 768 con signo fijo. */
function vectorDePrueba(texto: string): number[] {
  const v = new Array<number>(DIMENSIONES).fill(0);
  const palabras = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((p) => p.length >= 3);
  for (const p of palabras) {
    let h = 2166136261;
    for (let i = 0; i < p.length; i++) h = Math.imul(h ^ p.charCodeAt(i), 16777619);
    v[Math.abs(h) % DIMENSIONES] += h % 2 === 0 ? 1 : -1;
  }
  return normalizar(v);
}

/** Cuántos textos caben en una petición a cada proveedor. */
export const LOTE_VECTORES: Record<keyof typeof MODELOS, number> = { gemini: 100, openai: 96, prueba: 100 };

async function conReintentos(nombre: string, pedir: () => Promise<Response>): Promise<unknown> {
  let ultimo = "sin respuesta";
  for (let intento = 1; intento <= 4; intento++) {
    try {
      const res = await pedir();
      const cuerpo = await res.json().catch(() => ({}));
      if (res.ok) return cuerpo;
      const detalle = (cuerpo as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
      ultimo = detalle;
      // Cuota agotada o servicio saturado: se reintenta; una clave o una petición mala, no.
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) {
      ultimo = e instanceof Error ? e.message : "sin respuesta";
    }
    await esperar(1_200 * intento);
  }
  throw new Error(`${nombre} respondió: ${ultimo}`);
}

/** Vectoriza hasta `LOTE_VECTORES` textos de una vez. `tipo`: lo que se guarda (documento) o lo que se busca (consulta). */
export async function vectorizar(textos: string[], tipo: "documento" | "consulta", p: ProveedorVectores): Promise<number[][]> {
  if (textos.length === 0) return [];
  if (p.proveedor === "prueba") return textos.map(vectorDePrueba);

  if (p.proveedor === "gemini") {
    const cuerpo = (await conReintentos("Gemini", () =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${p.modelo}:batchEmbedContents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": p.clave },
        body: JSON.stringify({
          requests: textos.map((texto) => ({
            model: `models/${p.modelo}`,
            content: { parts: [{ text: texto }] },
            taskType: tipo === "documento" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY",
            outputDimensionality: DIMENSIONES,
          })),
        }),
      })
    )) as { embeddings?: { values: number[] }[] };
    const v = cuerpo.embeddings ?? [];
    if (v.length !== textos.length || v.some((e) => e.values?.length !== DIMENSIONES)) throw new Error("Gemini devolvió vectores incompletos.");
    return v.map((e) => normalizar(e.values));
  }

  const cuerpo = (await conReintentos("OpenAI", () =>
    fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.clave}` },
      body: JSON.stringify({ model: p.modelo, input: textos, dimensions: DIMENSIONES }),
    })
  )) as { data?: { index: number; embedding: number[] }[] };
  const v = [...(cuerpo.data ?? [])].sort((a, b) => a.index - b.index);
  if (v.length !== textos.length || v.some((e) => e.embedding?.length !== DIMENSIONES)) throw new Error("OpenAI devolvió vectores incompletos.");
  return v.map((e) => normalizar(e.embedding));
}
