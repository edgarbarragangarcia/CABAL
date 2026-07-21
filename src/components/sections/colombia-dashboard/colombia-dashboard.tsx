import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { getColombiaDepartmentShapes } from "@/lib/gov-data/colombia-geo";
import {
  getGdpByDepartment,
  getGovernmentPerformanceByDepartment,
  getHomicidesByDepartment,
  GOV_DATASETS,
} from "@/lib/gov-data/queries";
import { ColombiaDashboardClient } from "./colombia-dashboard-client";
import type { DashboardTopic } from "./types";

/**
 * Observatorio de datos regionales: mapa interactivo de Colombia con
 * cifras oficiales del Estado (Policía Nacional, DANE, DNP) consultadas
 * en vivo vía la API de datos.gov.co. Server Component: todas las
 * consultas se resuelven en el servidor antes de enviar HTML al cliente.
 */
export async function ColombiaDashboard() {
  let shapes, homicidios, pib, mdm;

  try {
    [shapes, homicidios, pib, mdm] = await Promise.all([
      getColombiaDepartmentShapes(),
      getHomicidesByDepartment(),
      getGdpByDepartment(),
      getGovernmentPerformanceByDepartment(),
    ]);
  } catch {
    return (
      <section className="py-16 sm:py-24">
        <Container>
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No fue posible cargar las cifras oficiales de datos.gov.co en este momento.
            Intenta de nuevo más tarde.
          </div>
        </Container>
      </section>
    );
  }

  const topics: DashboardTopic[] = [
    {
      id: "violencia",
      label: "Violencia",
      unit: "casos",
      year: homicidios.year,
      source: GOV_DATASETS.homicidios.source,
      sourceUrl: GOV_DATASETS.homicidios.url,
      data: homicidios.data,
      higherIsBetter: false,
    },
    {
      id: "economia",
      label: "Economía",
      unit: "miles de millones COP",
      year: pib.year,
      source: GOV_DATASETS.pibDepartamental.source,
      sourceUrl: GOV_DATASETS.pibDepartamental.url,
      data: pib.data,
      higherIsBetter: true,
    },
    {
      id: "gobierno",
      label: "Gobierno",
      unit: "puntos",
      year: mdm.year,
      source: GOV_DATASETS.desempenoMunicipal.source,
      sourceUrl: GOV_DATASETS.desempenoMunicipal.url,
      data: mdm.data,
      higherIsBetter: true,
    },
  ];

  return (
    <section className="py-16 sm:py-24">
      <Container>
        <Reveal className="max-w-2xl">
          <span className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            Observatorio regional
          </span>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Colombia, departamento por departamento
          </h2>
          <p className="mt-4 text-muted-foreground">
            Cifras oficiales del Estado colombiano, consultadas en vivo desde{" "}
            <a
              href="https://www.datos.gov.co"
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand hover:underline"
            >
              datos.gov.co
            </a>
            . Explora violencia, economía y desempeño de gobiernos locales por región.
          </p>
        </Reveal>

        <div className="mt-10">
          <ColombiaDashboardClient shapes={shapes} topics={topics} />
        </div>
      </Container>
    </section>
  );
}
