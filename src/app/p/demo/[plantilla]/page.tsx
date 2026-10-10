import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalView } from "@/components/portales/portal-view";
import { PLANTILLAS, configPorDefecto, plantillaPorId } from "@/lib/portales/plantillas";

/** Las cuatro plantillas se publican como páginas estáticas de demostración: no necesitan base de datos. */
export const dynamicParams = false;
export const generateStaticParams = () => PLANTILLAS.map((p) => ({ plantilla: p.id }));

type Props = { params: Promise<{ plantilla: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = plantillaPorId((await params).plantilla);
  return { title: p ? `Demostración · ${p.nombre}` : "Demostración", robots: { index: false, follow: false } };
}

export default async function DemoPlantillaPage({ params }: Props) {
  const p = plantillaPorId((await params).plantilla);
  if (!p) notFound();
  return (
    <main className="min-h-dvh bg-white">
      <PortalView plantilla={p.id} config={configPorDefecto(p.id)} idBase="demo" />
    </main>
  );
}
