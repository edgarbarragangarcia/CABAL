import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";
import { FeedEmptyState } from "@/components/sections/feed-empty-state";

export const metadata: Metadata = {
  title: "Estatutos",
  description: "Estatutos y documentos constitutivos de la Fundación Escuela Libertad.",
};

export default function EstatutosPage() {
  return (
    <>
      <PageHeader
        eyebrow="Transparencia"
        title="Estatutos"
        description="Documentos constitutivos y de gobierno corporativo de la fundación, disponibles para consulta pública."
      />
      <FeedEmptyState message="Los documentos estatutarios se publicarán en esta sección próximamente." />
    </>
  );
}
