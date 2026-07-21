import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Conoce la misión, visión y equipo detrás de la Fundación Escuela Libertad.",
};

export default function NosotrosPage() {
  return (
    <Container as="section" className="py-32">
      <Reveal as="div" className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Nosotros</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          La Fundación Escuela Libertad nace del convencimiento de que la educación
          es la herramienta más poderosa para transformar comunidades. Trabajamos de
          la mano con familias, líderes locales y aliados estratégicos para construir
          programas educativos y sociales sostenibles en todo el territorio colombiano.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-8 sm:grid-cols-2">
        <Reveal className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="text-xl font-semibold">Misión</h2>
          <p className="mt-3 text-muted-foreground">
            Ampliar el acceso a educación de calidad y oportunidades de desarrollo
            para niños, jóvenes y familias en situación de vulnerabilidad.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="text-xl font-semibold">Visión</h2>
          <p className="mt-3 text-muted-foreground">
            Ser la fundación de referencia en Colombia por el impacto medible y
            sostenido de nuestros programas educativos y comunitarios.
          </p>
        </Reveal>
      </div>
    </Container>
  );
}
