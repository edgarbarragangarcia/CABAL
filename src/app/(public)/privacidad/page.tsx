import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/animations/reveal";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo la Fundación Escuela Libertad recopila, usa y protege tus datos personales.",
};

export default function PrivacidadPage() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Política de privacidad"
        description="Cómo recopilamos, usamos y protegemos tus datos personales al interactuar con este sitio."
      />

      <Container as="section" className="max-w-3xl pb-32">
        <Reveal className="flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">Datos que recopilamos</h2>
            <p>
              Recopilamos únicamente los datos que nos proporcionas voluntariamente a través de
              nuestros formularios de contacto y suscripción al boletín: nombre, correo electrónico,
              teléfono (opcional) y el contenido de tu mensaje.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">Uso de la información</h2>
            <p>
              Usamos tus datos exclusivamente para responder tus solicitudes, gestionar tu
              suscripción al boletín y, si lo autorizas, mantenerte informado sobre nuestros
              programas y eventos. No vendemos ni compartimos tu información con terceros con
              fines comerciales.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">Seguridad</h2>
            <p>
              Este sitio aplica cabeceras de seguridad OWASP, validación estricta de formularios y
              limitación de solicitudes para proteger tu información contra accesos no autorizados.
            </p>
          </div>
          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">Tus derechos</h2>
            <p>
              Puedes solicitar la actualización o eliminación de tus datos personales escribiendo a{" "}
              <a href={`mailto:${siteConfig.contact.email}`} className="text-brand hover:underline">
                {siteConfig.contact.email}
              </a>
              .
            </p>
          </div>
        </Reveal>
      </Container>
    </>
  );
}
