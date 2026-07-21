import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

export function FeedEmptyState({ message }: { message: string }) {
  return (
    <Container as="section" className="pb-32">
      <Reveal className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        {message}
      </Reveal>
    </Container>
  );
}
