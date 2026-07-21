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
      explainer:
        "Este mapa muestra cuántos homicidios registró la Policía Nacional en cada departamento durante el año. Mientras más oscuro el color rojo, más casos hubo en ese departamento.",
      unitExplainer: "\"Casos\" son homicidios reportados oficialmente por la Policía Nacional.",
      lowLabel: "Menos casos",
      highLabel: "Más casos",
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
      explainer:
        "Este mapa muestra el tamaño de la economía de cada departamento: el valor de todo lo que se produjo (bienes y servicios) durante el año. Mientras más oscuro el color verde, más grande es esa economía.",
      unitExplainer:
        "El valor está en \"miles de millones de pesos\": por ejemplo, $10.000 significa 10.000 mil millones, es decir, 10 billones de pesos.",
      lowLabel: "Economía más pequeña",
      highLabel: "Economía más grande",
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
      explainer:
        "Este mapa muestra qué tan bien gestionan sus recursos y servicios los municipios de cada departamento (educación, salud, gestión de recursos, entre otros), según el índice oficial del DNP. Mientras más oscuro el color azul, mejor es el desempeño promedio.",
      unitExplainer:
        "El puntaje va de 0 a 100: entre más alto, mejor es la gestión municipal según este índice oficial.",
      lowLabel: "Peor gestión",
      highLabel: "Mejor gestión",
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
