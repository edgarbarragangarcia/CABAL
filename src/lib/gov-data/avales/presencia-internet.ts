import "server-only";

import { unstable_cache } from "next/cache";

import { buscarNoticias, type Noticia } from "@/lib/informe/fuentes";

/**
 * Rastreo en prensa por tema. Las redes sociales no se pueden leer sin
 * credenciales (X/Facebook/Instagram exigen sesión y prohíben la automatización),
 * así que lo automático y verificable es Google Noticias (RSS público), que
 * además indexa notas que citan trinos y publicaciones. Cada tema es una
 * consulta distinta sobre el mismo nombre exacto. No hay temas de «cercanía con la izquierda/derecha»:
 * una búsqueda con nombres de partidos trae también las notas donde la persona los critica, y contarlas como cercanía era engañoso;
 * la orientación la infiere el análisis de IA con evidencia.
 */

export type TemaId = "general" | "cabal" | "polemicas" | "redes";

export const TEMAS: { id: TemaId; titulo: string; consulta: (n: string) => string }[] = [
  { id: "general", titulo: "Menciones generales", consulta: (n) => `"${n}"` },
  { id: "cabal", titulo: "Relación con María Fernanda Cabal", consulta: (n) => `"${n}" ("María Fernanda Cabal" OR Cabal)` },
  {
    id: "polemicas",
    titulo: "Denuncias y polémicas",
    consulta: (n) => `"${n}" (denuncia OR investigación OR escándalo OR corrupción OR condena OR sanción OR polémica)`,
  },
  { id: "redes", titulo: "En redes sociales", consulta: (n) => `"${n}" (trino OR tuit OR Twitter OR Instagram OR Facebook OR TikTok OR viral OR "redes sociales")` },
];

export type Tema = { id: TemaId; titulo: string; noticias: Noticia[]; error?: string };

export type PresenciaInternet = {
  /** Menciones generales (compatibilidad con la fila de indicadores). */
  noticias: Noticia[];
  temas: Tema[];
  /** Titulares que nombran a la persona y a Cabal a la vez. */
  mencionesCabal: Noticia[];
  consultadoEn: string;
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** El titular nombra a la persona (al menos apellido y un nombre) y a Cabal. */
export function nombraAmbos(titulo: string, nombre: string) {
  const t = sinTildes(titulo);
  const partes = sinTildes(nombre).split(/\s+/).filter((p) => p.length > 2);
  const coincide = partes.filter((p) => t.includes(p)).length;
  return t.includes("cabal") && coincide >= Math.min(2, partes.length);
}

async function buscar(nombre: string): Promise<PresenciaInternet> {
  const resultados = await Promise.allSettled(TEMAS.map((t) => buscarNoticias(t.consulta(nombre), 40)));
  const temas: Tema[] = TEMAS.map((t, i) => {
    const r = resultados[i];
    return r.status === "fulfilled"
      ? { id: t.id, titulo: t.titulo, noticias: r.value }
      : { id: t.id, titulo: t.titulo, noticias: [], error: r.reason instanceof Error ? r.reason.message : "Sin respuesta" };
  });
  const cabal = temas.find((t) => t.id === "cabal")?.noticias ?? [];
  return {
    noticias: (temas.find((t) => t.id === "general")?.noticias ?? []).slice(0, 15),
    temas,
    mencionesCabal: cabal.filter((n) => nombraAmbos(n.titulo, nombre)),
    consultadoEn: new Date().toISOString(),
  };
}

export const getPresenciaInternet = unstable_cache(buscar, ["presencia-internet-v3"], { revalidate: 3600 });
