import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";
import { FeedEmptyState } from "@/components/sections/feed-empty-state";

export const metadata: Metadata = {
  title: "Boletín de Derechos Humanos",
  description: "Reportes periódicos sobre la situación de derechos humanos en Colombia.",
};

export default function BoletinDerechosHumanosPage() {
  return (
    <>
      <PageHeader
        eyebrow="Academia"
        title="Boletín de Derechos Humanos"
        description="Nuestro observatorio publica reportes periódicos sobre la situación de derechos humanos en el país, con especial atención a líderes sociales y comunidades afectadas por la violencia."
      />
      <FeedEmptyState message="El boletín se está migrando a esta plataforma. Vuelve pronto." />
    </>
  );
}
