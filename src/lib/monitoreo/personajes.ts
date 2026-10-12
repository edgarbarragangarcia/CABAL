import "server-only";

import { claveRed } from "@/lib/ia-config";
import { buscarNoticias, type Noticia } from "@/lib/informe/fuentes";
import type { PublicacionRed } from "./redes";

/**
 * Lo que publican en X otros personajes políticos y lo que dice de ellos la prensa. La lista es la base acordada; las
 * publicaciones salen de la API oficial de X con el token de Configuración (sin token, solo prensa: nunca se inventa nada).
 */
export type Personaje = { id: string; nombre: string; x: string; bando: "oposicion" | "derecha" | "centro" };

export const PERSONAJES: Personaje[] = [
  { id: "petro", nombre: "Gustavo Petro", x: "petrogustavo", bando: "oposicion" },
  { id: "cepeda", nombre: "Iván Cepeda", x: "IvanCepedaCast", bando: "oposicion" },
  { id: "uribe", nombre: "Álvaro Uribe", x: "AlvaroUribeVel", bando: "derecha" },
  { id: "espriella", nombre: "Abelardo de la Espriella", x: "ABDELAESPRIELLA", bando: "derecha" },
  { id: "paloma", nombre: "Paloma Valencia", x: "PalomaValenciaL", bando: "derecha" },
  { id: "fajardo", nombre: "Sergio Fajardo", x: "sergio_fajardo", bando: "centro" },
];

export type DatosPersonaje = {
  id: string;
  nombre: string;
  x: string;
  bando: Personaje["bando"];
  publicaciones: { estado: "sin_clave" } | { estado: "error"; error: string } | { estado: "ok"; items: PublicacionRed[] };
  prensa: Noticia[];
};
export type RespuestaPersonajes = { generadoEn: string; personajes: DatosPersonaje[] };

type Tweet = { id: string; text: string; created_at: string; public_metrics?: Record<string, number> };

async function publicacionesDeX(token: string, usuario: string): Promise<PublicacionRed[]> {
  const q = new URLSearchParams({ query: `from:${usuario} -is:retweet`, max_results: "10", "tweet.fields": "created_at,public_metrics" });
  const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${q}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const j = (await res.json().catch(() => null)) as { data?: Tweet[]; title?: string; detail?: string } | null;
  if (!res.ok) throw new Error(j?.detail ?? j?.title ?? `HTTP ${res.status}`);
  const n = (v: unknown) => Number(v) || 0;
  return (j?.data ?? []).map((t) => ({
    id: t.id,
    texto: t.text,
    autor: `@${usuario}`,
    fecha: t.created_at,
    me_gusta: n(t.public_metrics?.like_count),
    respuestas: n(t.public_metrics?.reply_count),
    compartidos: n(t.public_metrics?.retweet_count) + n(t.public_metrics?.quote_count),
    enlace: `https://x.com/${usuario}/status/${t.id}`,
  }));
}

let memoria: { en: number; datos: RespuestaPersonajes } | null = null;
const TTL = 30 * 60_000;

/** Se guarda 30 minutos en memoria: cada consulta a X gasta cuota del plan. */
export async function personajes(forzar = false): Promise<RespuestaPersonajes> {
  if (!forzar && memoria && Date.now() - memoria.en < TTL) return memoria.datos;
  const token = await claveRed("x");
  const datos = await Promise.all(
    PERSONAJES.map(async (p): Promise<DatosPersonaje> => {
      const [pub, prensa] = await Promise.all([
        token
          ? publicacionesDeX(token, p.x).then((items) => ({ estado: "ok" as const, items }), (e) => ({ estado: "error" as const, error: e instanceof Error ? e.message : "Error de X" }))
          : Promise.resolve({ estado: "sin_clave" as const }),
        buscarNoticias(`"${p.nombre}" when:7d`, 6).catch(() => [] as Noticia[]),
      ]);
      return { ...p, publicaciones: pub, prensa };
    })
  );
  const respuesta = { generadoEn: new Date().toISOString(), personajes: datos };
  memoria = { en: Date.now(), datos: respuesta };
  return respuesta;
}
