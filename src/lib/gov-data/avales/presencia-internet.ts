import "server-only";

import { unstable_cache } from "next/cache";

import { buscarNoticias, type Noticia } from "@/lib/informe/fuentes";

/**
 * No hay un API oficial que busque redes sociales por nombre, y raspar
 * Twitter/Instagram/Facebook/LinkedIn directamente incumple sus términos de
 * uso (requieren sesión, bloquean automatización) — el mismo motivo por el
 * que antecedentes judiciales quedó en el checklist manual. Esos enlaces de
 * búsqueda se arman en la UI (avales-tab.tsx), sin depender de ninguna
 * consulta: aquí solo va lo que sí se automatiza sin claves ni scraping,
 * Google Noticias (RSS público).
 */

export type PresenciaInternet = { noticias: Noticia[] };

async function buscar(nombre: string): Promise<PresenciaInternet> {
  return { noticias: await buscarNoticias(`"${nombre}"`, 15) };
}

/** Las noticias cambian a diario: una hora de caché alcanza para no repetir la consulta en cada clic. */
export const getPresenciaInternet = unstable_cache(buscar, ["presencia-internet-v1"], { revalidate: 3600 });
