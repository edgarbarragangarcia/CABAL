import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FileText, Gavel, LineChart, Newspaper } from "lucide-react";

import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { RevealGroup, Reveal } from "@/components/animations/reveal";
import { mainNav } from "@/config/site";

export const metadata: Metadata = {
  title: "Academia",
  description:
    "Investigación, seguimiento legislativo y publicaciones de la Fundación Escuela Libertad.",
};

const ICONS: Record<string, React.ElementType> = {
  "/academia/publicaciones": FileText,
  "/academia/observatorio-legislativo": Gavel,
  "/academia/observatorio-economico": LineChart,
  "/academia/boletines": Newspaper,
};

export default function AcademiaPage() {
  const children = mainNav.find((item) => item.href === "/academia")?.children ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Academia"
        title="Investigación con impacto en el debate público"
        description="Producimos análisis, seguimiento legislativo y reportes que sustentan nuestra posición pública sobre libertad, institucionalidad y derechos."
      />

      <Container as="section" className="pb-32">
        <RevealGroup as="div" className="grid gap-6 sm:grid-cols-2">
          {children.map((item) => {
            const Icon = ICONS[item.href] ?? FileText;
            return (
              <Reveal key={item.href} as="li" className="list-none">
                <Link
                  href={item.href}
                  className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-8 transition-shadow hover:shadow-xl"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    {item.label}
                    <ArrowUpRight
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </h2>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </Link>
              </Reveal>
            );
          })}
        </RevealGroup>
      </Container>
    </>
  );
}
