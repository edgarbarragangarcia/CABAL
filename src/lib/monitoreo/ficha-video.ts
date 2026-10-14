import "server-only";

/**
 * La ficha de un video de YouTube leída de su página pública (sin clave): fecha exacta, vistas, me gusta, suscriptores del canal,
 * duración, categoría y descripción. La búsqueda pública solo da «hace 2 m» y las vistas; aquí está lo completo.
 */
export type FichaVideo = {
  id: string;
  titulo: string;
  canal: string;
  canalId: string | null;
  suscriptores: number | null;
  segundos: number | null;
  vistas: number | null;
  likes: number | null;
  descripcion: string;
  categoria: string | null;
  /** Fecha y hora exactas de publicación (ISO). */
  publicado: string | null;
  enVivo: boolean;
  /** Lo que escribe la gente: los comentarios más relevantes con su tono. */
  comentarios?: ComentarioFicha[];
  /** Ya se intentó leer los comentarios (aunque estén desactivados). */
  comentariosLeidos?: boolean;
};

export type ComentarioFicha = { texto: string; autor: string; likes: number; tono: "positivo" | "neutral" | "negativo"; ia?: boolean };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CATEGORIAS: Record<string, string> = {
  "News & Politics": "Noticias y política", "Film & Animation": "Cine y animación", "People & Blogs": "Gente y blogs", Entertainment: "Entretenimiento",
  Education: "Educación", Comedy: "Comedia", "Howto & Style": "Estilo y consejos", "Science & Technology": "Ciencia y tecnología",
  "Nonprofits & Activism": "Activismo", Music: "Música", Sports: "Deportes", Gaming: "Videojuegos", "Travel & Events": "Viajes y eventos",
  "Autos & Vehicles": "Autos", "Pets & Animals": "Mascotas",
};

import { tonoDeTexto } from "./tono";

type Nodo = Record<string, unknown>;
const nodo = (x: unknown): Nodo => (x && typeof x === "object" ? (x as Nodo) : {});
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v !== null && v !== undefined ? n : null;
};

/** «89.3 mil suscriptores», «1,2 M de suscriptores», «15 k» → número. */
export function suscriptoresDeTexto(t: string | null | undefined): number | null {
  const m = t?.toLowerCase().match(/([\d.,]+)\s*(mil millones|millones|millón|mil|m|k)?/);
  if (!m) return null;
  const n = Number(m[1].replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const f = m[2] === "mil millones" ? 1e9 : m[2] === "millones" || m[2] === "millón" || m[2] === "m" ? 1e6 : m[2] === "mil" || m[2] === "k" ? 1e3 : 1;
  return Math.round(n * f);
}

const memoria = new Map<string, { en: number; ficha: FichaVideo | null }>();
const VIGENCIA_MS = 6 * 3_600_000;

async function leerFicha(id: string): Promise<FichaVideo | null> {
  const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, {
    headers: { "User-Agent": UA, "Accept-Language": "es-CO,es;q=0.9" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`YouTube respondió ${res.status}`);
  const html = await res.text();
  const p = html.match(/var ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});\s*(?:var|<\/script>)/);
  if (!p) return null;
  let jugador: Nodo;
  try {
    jugador = JSON.parse(p[1]) as Nodo;
  } catch {
    return null;
  }
  const v = nodo(jugador.videoDetails);
  const mf = nodo(nodo(jugador.microformat).playerMicroformatRenderer);
  if (typeof v.title !== "string") return null;

  // Suscriptores del canal: están en los datos de la página (no en los del reproductor).
  let subs: number | null = null;
  const d = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/);
  if (d) {
    try {
      const buscar = (x: unknown): void => {
        if (subs !== null || !x || typeof x !== "object") return;
        if (Array.isArray(x)) return x.forEach(buscar);
        const o = x as Nodo;
        if ("subscriberCountText" in o) {
          const t = nodo(o.subscriberCountText);
          subs = suscriptoresDeTexto(String(nodo(nodo(t.accessibility).accessibilityData).label ?? t.simpleText ?? ""));
          if (subs !== null) return;
        }
        Object.values(o).forEach(buscar);
      };
      buscar(JSON.parse(d[1]));
    } catch {
      /* sin suscriptores */
    }
  }
  const comentarios = await leerComentarios(html, d ? d[1] : null);
  const cat = typeof mf.category === "string" ? mf.category : null;
  return {
    id,
    titulo: v.title,
    canal: String(v.author ?? ""),
    canalId: typeof v.channelId === "string" ? v.channelId : null,
    suscriptores: subs,
    segundos: num(v.lengthSeconds),
    vistas: num(v.viewCount),
    likes: num(mf.likeCount),
    descripcion: String(v.shortDescription ?? "").slice(0, 600),
    categoria: cat ? (CATEGORIAS[cat] ?? cat) : null,
    publicado: typeof mf.publishDate === "string" && !Number.isNaN(Date.parse(mf.publishDate)) ? new Date(mf.publishDate).toISOString() : null,
    enVivo: v.isLiveContent === true,
    comentarios,
    comentariosLeidos: true,
  };
}

/** Los comentarios más relevantes (hasta 25) por la misma ruta que usa la página: sin clave. Vacío si están desactivados. */
async function leerComentarios(html: string, datosPagina: string | null): Promise<ComentarioFicha[]> {
  try {
    if (!datosPagina) return [];
    let token: string | null = null;
    const buscar = (x: unknown): void => {
      if (token || !x || typeof x !== "object") return;
      if (Array.isArray(x)) return x.forEach(buscar);
      const o = x as Nodo;
      if (nodo(o.itemSectionRenderer).sectionIdentifier === "comment-item-section") {
        token = JSON.stringify(o).match(/"token":"([^"]+)"/)?.[1] ?? null;
        return;
      }
      Object.values(o).forEach(buscar);
    };
    buscar(JSON.parse(datosPagina));
    if (!token) return [];
    const clave = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
    const res = await fetch(`https://www.youtube.com/youtubei/v1/next?prettyPrint=false${clave ? `&key=${clave}` : ""}`, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/json", "Accept-Language": "es-CO,es;q=0.9" },
      body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20240801.00.00", hl: "es", gl: "CO" } }, continuation: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as Nodo;
    const muts = (nodo(nodo(j.frameworkUpdates).entityBatchUpdate).mutations as unknown[]) ?? [];
    const lista: ComentarioFicha[] = [];
    for (const m of muts) {
      const c = nodo(nodo(nodo(m).payload).commentEntityPayload);
      const texto = String(nodo(nodo(c.properties).content).content ?? "").replace(/\s+/g, " ").trim();
      if (!texto) continue;
      const likes = Number(String(nodo(c.toolbar).likeCountNotliked ?? "0").replace(/\D/g, "")) || 0;
      lista.push({ texto: texto.slice(0, 300), autor: String(nodo(c.author).displayName ?? ""), likes, tono: tonoDeTexto(texto).tono });
    }
    return lista.slice(0, 25);
  } catch {
    return [];
  }
}

/** Las fichas de varios videos (con memoria de seis horas y pocas peticiones a la vez). Los que no se pueden leer no aparecen. */
export async function fichasDeVideos(ids: string[]): Promise<Record<string, FichaVideo>> {
  const ahora = Date.now();
  const salida: Record<string, FichaVideo> = {};
  const pendientes: string[] = [];
  for (const id of new Set(ids)) {
    const m = memoria.get(id);
    if (m && ahora - m.en < VIGENCIA_MS) {
      if (m.ficha) salida[id] = m.ficha;
    } else pendientes.push(id);
  }
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (pendientes.length) {
        const id = pendientes.shift()!;
        try {
          const ficha = await leerFicha(id);
          memoria.set(id, { en: Date.now(), ficha });
          if (ficha) salida[id] = ficha;
        } catch {
          /* se vuelve a intentar en la próxima consulta */
        }
      }
    })
  );
  return salida;
}
