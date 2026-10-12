import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { VistaAgenda } from "@/components/portales/cms";
import { MarcoPortal, construirAmbiente } from "@/components/portales/marco";
import { anunciosMostrados, cargarSitio } from "@/lib/portales/cms/sitio";
import { esBot, registrarEvento } from "@/lib/portales/cms/store";
import { separarEventos } from "@/lib/portales/crm/puro";
import { eventosPublicados } from "@/lib/portales/crm/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sitio = await cargarSitio((await params).slug);
  if (!sitio || sitio.estado !== "en-linea") return { title: "Eventos", robots: { index: false, follow: false } };
  return { title: `Eventos · ${sitio.portal.nombre}`, description: `Agenda de encuentros de ${sitio.portal.nombre}.`, robots: { index: sitio.ajustes.buscadores, follow: sitio.ajustes.buscadores } };
}

/** La agenda del portal: sus próximos eventos y los ya realizados. */
export default async function AgendaPage({ params }: Props) {
  const sitio = await cargarSitio((await params).slug);
  if (!sitio || sitio.estado !== "en-linea") notFound();
  const { portal, ajustes, datos } = sitio;
  const todos = await eventosPublicados(portal.id, { limite: 60 }).catch(() => []);
  const { proximos, pasados } = separarEventos(todos);

  if (!esBot((await headers()).get("user-agent"))) registrarEvento(portal.id, "vista", { anuncioIds: anunciosMostrados(datos, "listado") });
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: true, idBase: "portal", cms: datos });
  return (
    <main className="min-h-dvh bg-[#0c1017]">
      <MarcoPortal a={a} vars={vars} secciones={[]} accion={{ href: datos.hrefUnete, texto: ajustes.union.boton }}>
        <VistaAgenda a={a} proximos={proximos} pasados={pasados} />
      </MarcoPortal>
    </main>
  );
}
