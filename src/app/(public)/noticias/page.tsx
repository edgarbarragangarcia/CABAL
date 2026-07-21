import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

export const metadata: Metadata = {
  title: "Noticias",
  description: "Actualidad y avances de los programas de la Fundación Escuela Libertad.",
};

export default function NoticiasPage() {
  return (
    <Container as="section" className="py-32">
      <Reveal className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Noticias</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Próximamente conectaremos esta sección a nuestro gestor de contenido para
          publicar actualizaciones periódicas sobre nuestros programas y aliados.
        </p>
      </Reveal>
    </Container>
  );
}
