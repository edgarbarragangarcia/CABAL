import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

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
    <Container as="section" className="pb-16 pt-36 sm:pt-44">
      <Reveal className="max-w-2xl">
        {eyebrow && (
          <span className="eyebrow mb-5 inline-flex items-center gap-2.5 text-accent-ink">
            <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
            {eyebrow}
          </span>
        )}
        <h1 className="text-balance font-display text-[2.5rem] font-normal leading-[1.05] tracking-tight sm:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {description}
        </p>
        <hr className="hairline mt-10" />
      </Reveal>
    </Container>
  );
}
