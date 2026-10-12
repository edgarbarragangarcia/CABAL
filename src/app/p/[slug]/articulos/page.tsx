import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { VistaListado } from "@/components/portales/cms";
import { MarcoPortal, construirAmbiente } from "@/components/portales/marco";
import { anunciosMostrados, cargarSitio } from "@/lib/portales/cms/sitio";
import { articulosPublicados, esBot, registrarEvento } from "@/lib/portales/cms/store";
import { tematicaDe } from "@/lib/portales/cms/tematicas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ categoria?: string; etiqueta?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sitio = await cargarSitio((await params).slug);
  if (!sitio || sitio.estado !== "en-linea") return { title: "Artículos", robots: { index: false, follow: false } };
  const seccion = tematicaDe(sitio.portal.plantilla).seccion;
  return {
    title: `${seccion.nombre} · ${sitio.portal.nombre}`,
    description: seccion.descripcion,
    robots: { index: sitio.ajustes.buscadores, follow: sitio.ajustes.buscadores },
  };
}

/** Listado de artículos publicados del portal, con sus categorías. */
export default async function ArticulosPage({ params, searchParams }: Props) {
  const sitio = await cargarSitio((await params).slug);
  if (!sitio || sitio.estado !== "en-linea") notFound();
  const { portal, ajustes, datos, recientes } = sitio;
  const q = await searchParams;
  const categoria = q.categoria?.slice(0, 40) ?? "";
  const etiqueta = q.etiqueta?.slice(0, 30) ?? "";
  const articulos = categoria || etiqueta ? await articulosPublicados(portal.id, { categoria: categoria || undefined, etiqueta: etiqueta || undefined, limite: 60 }).catch(() => []) : recientes;

  if (!esBot((await headers()).get("user-agent"))) registrarEvento(portal.id, "vista", { anuncioIds: anunciosMostrados(datos, "listado") });
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: true, idBase: "portal", cms: datos });
  const categorias = [...new Set(recientes.map((r) => r.categoria).filter(Boolean))];
  return (
    <main className="min-h-dvh bg-[#0c1017]">
      <MarcoPortal a={a} vars={vars} secciones={[]} accion={{ href: datos.hrefUnete, texto: ajustes.union.boton }}>
        <VistaListado a={a} articulos={articulos} categorias={categorias} actual={categoria} etiqueta={etiqueta} />
      </MarcoPortal>
    </main>
  );
}
