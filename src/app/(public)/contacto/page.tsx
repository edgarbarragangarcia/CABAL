import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";

import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/animations/reveal";
import { ContactForm } from "@/components/sections/contact-form";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escríbenos a la Fundación Escuela Libertad.",
};

export default function ContactoPage() {
  return (
    <>
      <PageHeader
        eyebrow="Hablemos"
        title="Contacto"
        description="¿Tienes una pregunta, propuesta de alianza o quieres unirte como voluntario? Escríbenos."
      />

      <Container as="section" className="grid gap-12 pb-32 lg:grid-cols-[1fr_1.3fr]">
        <Reveal className="flex flex-col gap-6">
          <a
            href={`mailto:${siteConfig.contact.email}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-brand"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Mail className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Correo</p>
              <p className="text-sm text-muted-foreground">{siteConfig.contact.email}</p>
            </div>
          </a>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Phone className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Teléfono</p>
              <p className="text-sm text-muted-foreground">{siteConfig.contact.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Ubicación</p>
              <p className="text-sm text-muted-foreground">{siteConfig.contact.address}</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="rounded-2xl border border-border bg-surface p-8">
          <ContactForm />
        </Reveal>
      </Container>
    </>
  );
}
