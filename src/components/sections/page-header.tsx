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
          <span className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            {eyebrow}
          </span>
        )}
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-6 text-lg text-muted-foreground">{description}</p>
      </Reveal>
    </Container>
  );
}
