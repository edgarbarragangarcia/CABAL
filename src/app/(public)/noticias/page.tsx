import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";

export const metadata: Metadata = {
  title: "Noticias",
  description:
    "Actualidad y avances de los programas de la Fundación Escuela Libertad.",
};

export default function NoticiasPage() {
  return (
    <>
      <PageHeader
        eyebrow="Actualidad"
        title="Noticias"
        description="Próximamente conectaremos esta sección a nuestro gestor de contenido para publicar actualizaciones periódicas sobre nuestros programas y aliados."
      />
      <div className="pb-32" />
    </>
  );
}
