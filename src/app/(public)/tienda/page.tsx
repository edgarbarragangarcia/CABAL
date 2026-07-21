import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";
import { FeedEmptyState } from "@/components/sections/feed-empty-state";

export const metadata: Metadata = {
  title: "Tienda",
  description: "Material y merchandising de la Fundación Escuela Libertad.",
};

export default function TiendaPage() {
  return (
    <>
      <PageHeader
        eyebrow="Apoya la causa"
        title="Tienda"
        description="El catálogo de material y merchandising de la fundación se conectará en la siguiente fase de integración con la pasarela de pagos."
      />
      <FeedEmptyState message="La tienda estará disponible próximamente." />
    </>
  );
}
