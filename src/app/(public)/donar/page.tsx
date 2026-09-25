import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/animations/reveal";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Donar",
  description:
    "Apoya los programas de la Fundación Escuela Libertad con tu donación.",
};

export default function DonarPage() {
  return (
    <>
      <PageHeader
        eyebrow="Apoya"
        title="Donar"
        description="La pasarela de pagos (Wompi / Bold) se conectará en la siguiente fase de integración, una vez se disponga de las credenciales del comercio. Mientras tanto, escríbenos para coordinar tu aporte o alianza."
      />
      <Container as="section" className="pb-32">
        <Reveal>
          <Button asChild size="lg" variant="accent">
            <a href="mailto:contacto@fundacionescuelalibertad.com.co">
              Contactar a la fundación
            </a>
          </Button>
        </Reveal>
      </Container>
    </>
  );
}
