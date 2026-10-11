import "server-only";

import { cache } from "react";

import type { DatosCms } from "@/components/portales/marco";
import { portalPorEnlace, type Portal } from "../store";
import { elegirPorEspacio } from "./puro";
import type { EspacioId } from "./tematicas";
import { anunciosVigentes, articulosPublicados, leerAjustes } from "./store";
import type { AjustesPortal, ArticuloLista } from "./tipos";

/**
 * Lo que necesita el sitio público de un portal para armarse: el portal, sus ajustes, sus artículos más recientes y los anuncios
 * que tocan en esta visita. Se carga una sola vez por petición (el título de la página y la página misma lo comparten).
 * Si el centro de operaciones todavía no está creado en Supabase, el sitio sale igual: sin artículos ni anuncios.
 */

export type Sitio =
  | { estado: "pausado"; portal: Portal }
  | { estado: "en-linea"; portal: Portal; ajustes: AjustesPortal; recientes: ArticuloLista[]; datos: DatosCms };

/** Los espacios que dibuja cada página: solo los anuncios de esos espacios cuentan una impresión en esa visita. */
const ESPACIOS_DE = {
  inicio: ["cabecera", "pie"],
  listado: ["cabecera", "lateral", "pie"],
  articulo: ["cabecera", "lateral", "articulo", "pie"],
} as const satisfies Record<string, readonly EspacioId[]>;

export function anunciosMostrados(datos: DatosCms, pagina: keyof typeof ESPACIOS_DE): string[] {
  return ESPACIOS_DE[pagina].flatMap((e) => {
    const a = datos.elegidos[e];
    return a ? [a.id] : [];
  });
}

export const cargarSitio = cache(async (slug: string): Promise<Sitio | null> => {
  const portal = await portalPorEnlace(slug);
  if (!portal || portal.estado === "borrador") return null;
  if (portal.estado === "pausado") return { estado: "pausado", portal };

  const [ajustes, recientes, anuncios] = await Promise.all([
    leerAjustes(portal.id),
    articulosPublicados(portal.id, { limite: 30 }).catch(() => [] as ArticuloLista[]),
    anunciosVigentes(portal.id).catch(() => []),
  ]);
  const urlBase = `/p/${portal.slug}`;
  const datos: DatosCms = {
    urlBase,
    articulos: recientes.length > 0,
    union: ajustes.union,
    editor: ajustes.editor,
    hrefUnete: `${urlBase}/unete`,
    hrefAnuncio: (id) => `${urlBase}/anuncio/${id}`,
    elegidos: elegirPorEspacio(anuncios, () => Math.random()),
  };
  return { estado: "en-linea", portal, ajustes, recientes, datos };
});
