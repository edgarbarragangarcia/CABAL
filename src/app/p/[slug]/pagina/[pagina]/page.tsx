import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { VistaPagina } from "@/components/portales/cms";
import { MarcoPortal, construirAmbiente } from "@/components/portales/marco";
import { anunciosMostrados, cargarSitio } from "@/lib/portales/cms/sitio";
import { esBot, registrarEvento } from "@/lib/portales/cms/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; pagina: string }> };

async function buscar(slug: string, enlace: string) {
  const sitio = await cargarSitio(slug);
  if (!sitio || sitio.estado !== "en-linea" || !/^[a-z0-9-]{3,60}$/.test(enlace)) return null;
  const pagina = sitio.paginas.find((p) => p.slug === enlace);
  return pagina ? { sitio, pagina } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, pagina: enlace } = await params;
  const h = await buscar(slug, enlace);
  if (!h) return { title: "Página", robots: { index: false, follow: false } };
  const indexar = h.sitio.ajustes.buscadores;
  return { title: `${h.pagina.titulo} · ${h.sitio.portal.nombre}`, description: h.pagina.resumen || undefined, robots: { index: indexar, follow: indexar } };
}

/** Una página fija publicada del portal. */
export default async function PaginaPublica({ params }: Props) {
  const { slug, pagina: enlace } = await params;
  const h = await buscar(slug, enlace);
  if (!h) notFound();
  const { sitio, pagina } = h;
  const { portal, ajustes, datos } = sitio;
  if (!datos.vista && !esBot((await headers()).get("user-agent"))) registrarEvento(portal.id, "vista", { anuncioIds: anunciosMostrados(datos, "listado") });
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: true, idBase: "portal", cms: datos });
  return (
    <main className="min-h-dvh bg-[#0c1017]">
      <MarcoPortal a={a} vars={vars} secciones={[]} accion={{ href: datos.hrefUnete, texto: ajustes.union.boton }}>
        <VistaPagina a={a} pagina={pagina} />
      </MarcoPortal>
    </main>
  );
}
