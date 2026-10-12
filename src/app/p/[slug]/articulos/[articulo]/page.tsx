import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { VistaArticulo } from "@/components/portales/cms";
import { MarcoPortal, construirAmbiente } from "@/components/portales/marco";
import { anunciosMostrados, cargarSitio } from "@/lib/portales/cms/sitio";
import { articuloPublicado, esBot, registrarEvento } from "@/lib/portales/cms/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; articulo: string }> };

const buscar = cache(async (slug: string, articulo: string) => {
  const sitio = await cargarSitio(slug);
  if (!sitio || sitio.estado !== "en-linea" || !/^[a-z0-9-]{3,90}$/.test(articulo)) return null;
  const art = await articuloPublicado(sitio.portal.id, articulo);
  return art ? { sitio, art } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, articulo } = await params;
  const hallado = await buscar(slug, articulo);
  if (!hallado) return { title: "Artículo", robots: { index: false, follow: false } };
  const { sitio, art } = hallado;
  const indexar = sitio.ajustes.buscadores;
  const descripcion = art.seoDescripcion || art.resumen;
  return {
    title: `${art.titulo} · ${sitio.portal.nombre}`,
    description: descripcion,
    robots: { index: indexar, follow: indexar },
    openGraph: { title: art.titulo, description: descripcion, type: "article", publishedTime: art.publicadoEn ?? undefined, siteName: sitio.portal.nombre },
  };
}

/** Un artículo publicado del portal. */
export default async function ArticuloPage({ params }: Props) {
  const { slug, articulo } = await params;
  const hallado = await buscar(slug, articulo);
  if (!hallado) notFound();
  const { sitio, art } = hallado;
  const { portal, ajustes, datos, recientes } = sitio;

  if (!esBot((await headers()).get("user-agent"))) {
    registrarEvento(portal.id, "vista", { articuloId: art.id, anuncioIds: anunciosMostrados(datos, "articulo") });
  }
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: true, idBase: "portal", cms: datos });
  const otros = recientes.filter((r) => r.id !== art.id);
  // «Sigue leyendo»: primero los de su categoría y, si faltan, los más recientes.
  const relacionados = [...otros.filter((r) => art.categoria && r.categoria === art.categoria), ...otros.filter((r) => !art.categoria || r.categoria !== art.categoria)].slice(0, 3);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: art.titulo,
    description: art.seoDescripcion || art.resumen,
    datePublished: art.publicadoEn ?? undefined,
    dateModified: art.actualizadoEn,
    author: { "@type": "Person", name: art.autor || portal.nombre },
    publisher: { "@type": "Organization", name: portal.nombre },
    ...(art.portadaUrl ? { image: [art.portadaUrl] } : {}),
    keywords: art.etiquetas.join(", ") || undefined,
  };
  return (
    <main className="min-h-dvh bg-[#0c1017]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <MarcoPortal a={a} vars={vars} secciones={[]} accion={{ href: datos.hrefUnete, texto: ajustes.union.boton }}>
        <VistaArticulo a={a} articulo={art} relacionados={relacionados} lateral={otros.slice(0, 5)} />
      </MarcoPortal>
    </main>
  );
}
