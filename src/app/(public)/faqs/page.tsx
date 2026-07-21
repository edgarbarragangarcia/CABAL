import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/animations/reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Respuestas a las preguntas más comunes sobre la Fundación Escuela Libertad.",
};

const FAQS = [
  {
    question: "¿Cómo puedo donar a la fundación?",
    answer:
      "Puedes hacerlo desde la sección Donar. Estamos habilitando la pasarela de pagos en línea; mientras tanto, escríbenos para coordinar tu aporte.",
  },
  {
    question: "¿Cómo puedo ser voluntario?",
    answer:
      "Escríbenos desde la sección Contacto contándonos tu perfil e interés. Te contactaremos con las oportunidades de voluntariado disponibles.",
  },
  {
    question: "¿Dónde puedo consultar los estatutos de la fundación?",
    answer: "Los documentos constitutivos están disponibles en la sección Estatutos.",
  },
  {
    question: "¿Cómo escucho la radio en vivo?",
    answer:
      "Puedes sintonizarnos desde el reproductor en la página de inicio, disponible las 24 horas.",
  },
] as const;

export default function FaqsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Ayuda"
        title="Preguntas frecuentes"
        description="Respuestas a las dudas más comunes sobre la fundación y nuestros programas."
      />

      <Container as="section" className="max-w-2xl pb-32">
        <Reveal>
          <Accordion type="single" collapsible>
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </Container>
    </>
  );
}
