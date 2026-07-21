import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";
import { FeedEmptyState } from "@/components/sections/feed-empty-state";

export const metadata: Metadata = {
  title: "Eventos",
  description: "Agenda de eventos, foros y actividades de la Fundación Escuela Libertad.",
};

export default function EventosPage() {
  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title="Eventos"
        description="Foros, conversatorios y actividades de formación abiertos a la comunidad."
      />
      <FeedEmptyState message="Aún no hay eventos programados. Síguenos en redes para enterarte de la próxima convocatoria." />
    </>
  );
}
