import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PortalView } from "@/components/portales/portal-view";
import { anunciosMostrados, cargarSitio } from "@/lib/portales/cms/sitio";
import { esBot, registrarEvento } from "@/lib/portales/cms/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Un portal solo aparece en buscadores si su equipo lo permite en los ajustes (por defecto no). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sitio = await cargarSitio((await params).slug);
  if (!sitio) return { title: "Portal", robots: { index: false, follow: false } };
  const { config, nombre } = sitio.portal;
  const indexar = sitio.estado === "en-linea" && sitio.ajustes.buscadores;
  return {
    title: `${nombre}${config.ciudad ? ` · ${config.ciudad}` : ""}`,
    description: config.eslogan,
    robots: { index: indexar, follow: indexar },
    openGraph: { title: nombre, description: config.eslogan, type: "website" },
  };
}

/** Portal desplegado: se ve en /p/<enlace> mientras su estado sea «publicado». */
export default async function PortalPublicoPage({ params }: Props) {
  const sitio = await cargarSitio((await params).slug);
  if (!sitio) notFound();
  if (sitio.estado === "pausado")
    return (
      <main className="grid min-h-dvh place-items-center bg-white px-6 text-center text-[#1b2430]">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-black/40 uppercase">{sitio.portal.config.nombre}</p>
          <h1 className="mt-3 font-display text-4xl font-light">Este portal está en pausa</h1>
          <p className="mx-auto mt-3 max-w-md text-black/60">Volverá a estar disponible pronto. Gracias por tu paciencia.</p>
        </div>
      </main>
    );

  if (!sitio.datos.vista && !esBot((await headers()).get("user-agent"))) {
    registrarEvento(sitio.portal.id, "vista", { anuncioIds: anunciosMostrados(sitio.datos, "inicio") });
  }
  return (
    <main className="min-h-dvh bg-[#0c1017]">
      <PortalView plantilla={sitio.portal.plantilla} config={sitio.portal.config} demo={false} idBase="portal" cms={{ datos: sitio.datos, ajustes: sitio.ajustes, articulos: sitio.recientes, eventos: sitio.eventos }} />
    </main>
  );
}
