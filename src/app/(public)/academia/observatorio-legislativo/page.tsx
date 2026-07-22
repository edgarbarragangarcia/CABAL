import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";
import { FeedEmptyState } from "@/components/sections/feed-empty-state";
import { LegislativeStats } from "@/components/sections/legislative-stats";

export const metadata: Metadata = {
  title: "Observatorio Legislativo",
  description: "Seguimiento al trámite de proyectos de ley relevantes para la fundación.",
};

export default function ObservatorioLegislativoPage() {
  return (
    <>
      <PageHeader
        eyebrow="Academia"
        title="Observatorio Legislativo"
        description="Hacemos seguimiento al trámite de iniciativas legislativas en el Congreso que impactan la libertad, la propiedad privada y la institucionalidad."
      />
      <LegislativeStats />
      <FeedEmptyState message="El detalle proyecto a proyecto se está migrando a esta plataforma. Vuelve pronto." />
    </>
  );
}
