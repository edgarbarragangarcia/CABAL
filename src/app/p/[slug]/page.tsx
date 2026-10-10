import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalView } from "@/components/portales/portal-view";
import { portalPorEnlace } from "@/lib/portales/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Los portales de demostración no deben aparecer en buscadores. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const portal = await portalPorEnlace(slug);
  return { title: portal ? `${portal.config.nombre}${portal.config.ciudad ? ` · ${portal.config.ciudad}` : ""}` : "Portal", description: portal?.config.eslogan, robots: { index: false, follow: false } };
}

/** Portal desplegado: se ve en /p/<enlace> mientras su estado sea «publicado». */
export default async function PortalPublicoPage({ params }: Props) {
  const { slug } = await params;
  const portal = await portalPorEnlace(slug);
  if (!portal || portal.estado === "borrador") notFound();
  if (portal.estado === "pausado")
    return (
      <main className="grid min-h-dvh place-items-center bg-white px-6 text-center text-[#1b2430]">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-black/40 uppercase">{portal.config.nombre}</p>
          <h1 className="mt-3 font-display text-4xl font-light">Este portal está en pausa</h1>
          <p className="mx-auto mt-3 max-w-md text-black/60">Volverá a estar disponible pronto. Gracias por tu paciencia.</p>
        </div>
      </main>
    );
  return (
    <main className="min-h-dvh bg-white">
      <PortalView plantilla={portal.plantilla} config={portal.config} idBase="portal" />
    </main>
  );
}
