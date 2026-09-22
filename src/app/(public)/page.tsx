import { Hero } from "@/components/sections/hero";
import { Manifesto } from "@/components/sections/home/manifesto";
import { Pillars } from "@/components/sections/home/pillars";
import { ImpactBand } from "@/components/sections/home/impact-band";
import { Observatories } from "@/components/sections/home/observatories";
import { ClosingCta } from "@/components/sections/home/closing-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Manifesto />
      <Pillars />
      {/* Franja oscura entre dos secciones claras: el corte de luminosidad
          es lo que marca el ritmo al bajar por la página. */}
      <ImpactBand />
      <Observatories />
      <ClosingCta />
    </>
  );
}
