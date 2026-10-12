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

  if (!datos.vista && !esBot((await headers()).get("user-agent"))) registrarEvento(portal.id, "vista", { anuncioIds: anunciosMostrados(datos, "listado") });
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: true, idBase: "portal", cms: datos });
  const ld = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evento.titulo,
    description: evento.descripcion.slice(0, 500) || undefined,
    startDate: evento.iniciaEn,
    endDate: evento.terminaEn ?? undefined,
    eventStatus: evento.estado === "cancelado" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: evento.modalidad === "virtual" ? "https://schema.org/OnlineEventAttendanceMode" : evento.modalidad === "mixta" ? "https://schema.org/MixedEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: evento.modalidad === "virtual" ? { "@type": "VirtualLocation", url: `/p/${portal.slug}/eventos/${evento.slug}` } : { "@type": "Place", name: evento.lugar || evento.ciudad, address: evento.ciudad || undefined },
    organizer: { "@type": "Organization", name: portal.nombre },
  };
  return (
    <main className="min-h-dvh bg-[#0c1017]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <MarcoPortal a={a} vars={vars} secciones={[]} accion={{ href: datos.hrefUnete, texto: sitio.ajustes.union.boton }}>
        <VistaEvento a={a} evento={evento} terminado={terminado} />
      </MarcoPortal>
    </main>
  );
}
