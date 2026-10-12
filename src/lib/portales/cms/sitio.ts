import "server-only";

import { cache } from "react";

import type { DatosCms } from "@/components/portales/marco";
import { portalPorEnlace, type Portal } from "../store";
import { elegirPorEspacio } from "./puro";
import type { EspacioId } from "./tematicas";
import { anunciosVigentes, articulosPublicados, leerAjustes } from "./store";
import type { AjustesPortal, ArticuloLista } from "./tipos";
import { separarEventos } from "../crm/puro";
import { paginasPublicadas } from "./paginas";
import type { Pagina } from "./paginas-tipos";
import { eventosPublicados } from "../crm/store";
import type { Evento } from "../crm/tipos";

/**
 * Lo que necesita el sitio público de un portal para armarse: el portal, sus ajustes, sus artículos más recientes y los anuncios
 * que tocan en esta visita. Se carga una sola vez por petición (el título de la página y la página misma lo comparten).
 * Si el centro de operaciones todavía no está creado en Supabase, el sitio sale igual: sin artículos ni anuncios.
 */

export type Sitio =
  | { estado: "pausado"; portal: Portal }
  | { estado: "en-linea"; portal: Portal; ajustes: AjustesPortal; recientes: ArticuloLista[]; /** Próximos eventos publicados. */ eventos: Evento[]; paginas: Pagina[]; datos: DatosCms };

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

  const [ajustes, recientes, anuncios, todosEventos, paginas] = await Promise.all([
    leerAjustes(portal.id),
    articulosPublicados(portal.id, { limite: 30 }).catch(() => [] as ArticuloLista[]),
    anunciosVigentes(portal.id).catch(() => []),
    // Sin las tablas del CRM, el portal sale igual: simplemente sin agenda.
    eventosPublicados(portal.id, { limite: 40 }).catch(() => [] as Evento[]),
    paginasPublicadas(portal.id).catch(() => [] as Pagina[]),
  ]);
  const { proximos } = separarEventos(todosEventos);
  const urlBase = `/p/${portal.slug}`;
  const datos: DatosCms = {
    urlBase,
    articulos: recientes.length > 0,
    eventos: todosEventos.length > 0,
    paginas: paginas.filter((p) => p.enMenu).map((p) => ({ slug: p.slug, titulo: p.titulo })),
    union: ajustes.union,
    editor: ajustes.editor,
    hrefUnete: `${urlBase}/unete`,
    hrefAnuncio: (id) => `${urlBase}/anuncio/${id}`,
    elegidos: elegirPorEspacio(anuncios, () => Math.random()),
  };
  return { estado: "en-linea", portal, ajustes, recientes, eventos: proximos, paginas, datos };
});
