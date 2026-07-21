import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";
import { FeedEmptyState } from "@/components/sections/feed-empty-state";

export const metadata: Metadata = {
  title: "Opinión",
  description: "Columnas de opinión de colaboradores de la Fundación Escuela Libertad.",
};

export default function OpinionPage() {
  return (
    <>
      <PageHeader
        eyebrow="Voces"
        title="Opinión"
        description="Columnas y análisis firmados por nuestro equipo y colaboradores invitados sobre la actualidad nacional."
      />
      <FeedEmptyState message="Estamos migrando nuestras columnas de opinión a esta plataforma. Vuelve pronto." />
    </>
  );
}
