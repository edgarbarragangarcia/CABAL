import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";
import { FeedEmptyState } from "@/components/sections/feed-empty-state";

export const metadata: Metadata = {
  title: "Publicaciones",
  description: "Investigación y análisis producidos por la Fundación Escuela Libertad.",
};

export default function PublicacionesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Academia"
        title="Publicaciones"
        description="Documentos de investigación, análisis y estudios elaborados por nuestro equipo académico."
      />
      <FeedEmptyState message="Estamos migrando nuestro archivo de publicaciones a esta nueva plataforma. Vuelve pronto." />
    </>
  );
}
