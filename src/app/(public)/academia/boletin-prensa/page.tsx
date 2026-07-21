import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";
import { FeedEmptyState } from "@/components/sections/feed-empty-state";

export const metadata: Metadata = {
  title: "Boletín de Prensa",
  description: "Comunicados y posiciones oficiales de la Fundación Escuela Libertad.",
};

export default function BoletinPrensaPage() {
  return (
    <>
      <PageHeader
        eyebrow="Academia"
        title="Boletín de Prensa"
        description="Comunicados oficiales y posiciones públicas de la fundación frente a la coyuntura nacional."
      />
      <FeedEmptyState message="Los comunicados se están migrando a esta plataforma. Vuelve pronto." />
    </>
  );
}
