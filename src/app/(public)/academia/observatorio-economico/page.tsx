import type { Metadata } from "next";
import { PageHeader } from "@/components/sections/page-header";
import { ColombiaDashboard } from "@/components/sections/colombia-dashboard/colombia-dashboard";

export const metadata: Metadata = {
  title: "Observatorio Económico",
  description:
    "Cifras oficiales de seguridad, economía, gestión de gobiernos locales y riesgo de corrupción, departamento por departamento.",
};

export default function ObservatorioEconomicoPage() {
  return (
    <>
      <PageHeader
        eyebrow="Academia"
        title="Observatorio Económico"
        description="Seguimiento a la economía, la seguridad y la gestión pública en Colombia con cifras oficiales del Estado."
      />
      <ColombiaDashboard />
    </>
  );
}
