import { Hero } from "@/components/sections/hero";
import { Manifesto } from "@/components/sections/home/manifesto";
import { Pillars } from "@/components/sections/home/pillars";
import { Observatories } from "@/components/sections/home/observatories";
import { Community } from "@/components/sections/home/community";
import { ImpactBand } from "@/components/sections/home/impact-band";
import { ClosingCta } from "@/components/sections/home/closing-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Manifesto />
      <Pillars />
      {/* Franja oscura entre dos secciones claras: el corte de luminosidad
          es lo que marca el ritmo al bajar por la página. */}
      <Observatories />
      <Community />
      {/* Solo aparece cuando hay cifras verificadas (ver impact-band.tsx). */}
      <ImpactBand />
      <ClosingCta />
    </>
  );
}
