import { Container } from "@/components/ui/container";

/**
 * Encabezado de las subpáginas: arranca justo debajo de la barra de
 * navegación y se queda fijo al hacer scroll (el contenido pasa por
 * debajo, por eso el fondo es opaco). En móvil fluye con la página:
 * fijo ocuparía media pantalla.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <>
      <section className="top-0 z-30 border-b border-border/70 bg-background md:sticky">
        <Container className="pb-6 pt-24 sm:pb-8 sm:pt-28">
          <div className="max-w-3xl">
            {eyebrow && (
              <span className="eyebrow mb-3 inline-flex items-center gap-2.5 text-accent-ink">
                <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
                {eyebrow}
              </span>
            )}
            <h1 className="text-balance font-display text-[2.1rem] font-normal leading-[1.08] tracking-tight sm:text-[3.25rem]">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {description}
            </p>
          </div>
        </Container>
      </section>
      {/* Aire entre el encabezado y el contenido (no es parte de lo que queda fijo). */}
      <div className="h-10 sm:h-12" aria-hidden="true" />
    </>
  );
}
