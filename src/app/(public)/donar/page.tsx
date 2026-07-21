import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Donar",
  description: "Apoya los programas de la Fundación Escuela Libertad con tu donación.",
};

export default function DonarPage() {
  return (
    <Container as="section" className="py-32">
      <Reveal className="mx-auto max-w-xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Donar</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          La pasarela de pagos (Wompi / Bold) se conectará en la siguiente fase de
          integración, una vez se disponga de las credenciales del comercio. Mientras
          tanto, escríbenos para coordinar tu aporte o alianza.
        </p>
        <Button asChild size="lg" variant="accent" className="mt-8">
          <a href="mailto:contacto@fundacionescuelalibertad.com.co">Contactar a la fundación</a>
        </Button>
      </Reveal>
    </Container>
  );
}
