import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { VistaEvento } from "@/components/portales/cms";
import { MarcoPortal, construirAmbiente } from "@/components/portales/marco";
import { anunciosMostrados, cargarSitio } from "@/lib/portales/cms/sitio";
import { esBot, registrarEvento } from "@/lib/portales/cms/store";
import { eventoTerminado } from "@/lib/portales/crm/puro";
import { eventoPublicado } from "@/lib/portales/crm/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; evento: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, evento: es } = await params;
  const sitio = await cargarSitio(slug);
  if (!sitio || sitio.estado !== "en-linea") return { title: "Evento", robots: { index: false, follow: false } };
  const ev = /^[a-z0-9-]{3,90}$/.test(es) ? await eventoPublicado(sitio.portal.id, es).catch(() => null) : null;
  if (!ev) return { title: "Evento", robots: { index: false, follow: false } };
  return { title: `${ev.titulo} · ${sitio.portal.nombre}`, description: ev.descripcion.slice(0, 160), robots: { index: sitio.ajustes.buscadores, follow: sitio.ajustes.buscadores } };
}

/** Un evento del portal, con su formulario de inscripción. */
export default async function EventoPage({ params }: Props) {
  const { slug, evento: enlace } = await params;
  const sitio = await cargarSitio(slug);
  if (!sitio || sitio.estado !== "en-linea" || !/^[a-z0-9-]{3,90}$/.test(enlace)) notFound();
  const { portal, datos } = sitio;
  const evento = await eventoPublicado(portal.id, enlace).catch(() => null);
  if (!evento) notFound();
  const terminado = eventoTerminado(evento);

  if (!esBot((await headers()).get("user-agent"))) registrarEvento(portal.id, "vista", { anuncioIds: anunciosMostrados(datos, "listado") });
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: true, idBase: "portal", cms: datos });
  return (
    <main className="min-h-dvh bg-[#0c1017]">
      <MarcoPortal a={a} vars={vars} secciones={[]} accion={{ href: datos.hrefUnete, texto: sitio.ajustes.union.boton }}>
        <VistaEvento a={a} evento={evento} terminado={terminado} />
      </MarcoPortal>
    </main>
  );
}
