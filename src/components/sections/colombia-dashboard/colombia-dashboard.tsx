import { AlertTriangle, Banknote, GraduationCap, Landmark, ShieldAlert, Siren } from "lucide-react";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { AnimatedCounter } from "@/components/animations/animated-counter";
import { getColombiaDepartmentShapes } from "@/lib/gov-data/colombia-geo";
import {
  getAnticorruptionIndexByDepartment,
  getEducationCoverageByDepartment,
  getGdpByDepartment,
  getGovernmentPerformanceByDepartment,
  getHomicidesByDepartment,
  getNationalHomicideTrend,
  getNationalTheftTrend,
  getTheftsByDepartment,
  GOV_DATASETS,
} from "@/lib/gov-data/queries";
import { ColombiaDashboardClient } from "./colombia-dashboard-client";
import { NationalTrendChart } from "./national-trend-chart";
import type { DashboardTopic, TrendSeries } from "./types";

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Observatorio de datos regionales: mapa interactivo de Colombia con
 * cifras oficiales del Estado (Policía Nacional, DANE, DNP, Procuraduría)
 * consultadas en vivo vía la API de datos.gov.co. Server Component: todas
 * las consultas se resuelven en el servidor antes de enviar HTML al cliente.
 */
export async function ColombiaDashboard() {
  let shapes, homicidios, pib, mdm, integra, educacion, hurtos, homicideTrend, theftTrend;

  try {
    [shapes, homicidios, pib, mdm, integra, educacion, hurtos, homicideTrend, theftTrend] =
      await Promise.all([
        getColombiaDepartmentShapes(),
        getHomicidesByDepartment(),
        getGdpByDepartment(),
        getGovernmentPerformanceByDepartment(),
        getAnticorruptionIndexByDepartment(),
        getEducationCoverageByDepartment(),
        getTheftsByDepartment(),
        getNationalHomicideTrend(),
        getNationalTheftTrend(),
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
    {
      id: "corrupcion",
      label: "Corrupción",
      unit: "puntos",
      year: integra.year,
      source: GOV_DATASETS.integraLegalidad.source,
      sourceUrl: GOV_DATASETS.integraLegalidad.url,
      data: integra.data,
      higherIsBetter: true,
      explainer:
        "Este mapa muestra el Índice Integral de Legalidad (INTEGRA) de la Procuraduría, que combina contratación, control interno, transparencia y manejo financiero para medir el riesgo de corrupción institucional. Mientras más oscuro el color morado, menor es el riesgo (mejor legalidad).",
      unitExplainer:
        "El puntaje va de 0 a 100: entre más alto, menor es el riesgo de corrupción según este índice oficial.",
      lowLabel: "Mayor riesgo de corrupción",
      highLabel: "Menor riesgo de corrupción",
    },
    {
      id: "educacion",
      label: "Educación",
      unit: "%",
      year: educacion.year,
      source: GOV_DATASETS.coberturaEducativa.source,
      sourceUrl: GOV_DATASETS.coberturaEducativa.url,
      data: educacion.data,
      higherIsBetter: true,
      explainer:
        "Este mapa muestra qué porcentaje de niños y jóvenes en edad escolar (5 a 16 años) están matriculados en un colegio en cada departamento. Mientras más oscuro el color naranja, mayor es esa cobertura.",
      unitExplainer:
        "La \"cobertura neta\" es el porcentaje de la población en edad escolar que está matriculada en el nivel educativo que le corresponde.",
      lowLabel: "Menor cobertura escolar",
      highLabel: "Mayor cobertura escolar",
    },
    {
      id: "hurtos",
      label: "Hurtos",
      unit: "casos",
      year: hurtos.year,
      source: GOV_DATASETS.hurtos.source,
      sourceUrl: GOV_DATASETS.hurtos.url,
      data: hurtos.data,
      higherIsBetter: false,
      explainer:
        "Este mapa muestra cuántos hurtos (a personas, comercios, viviendas, vehículos) registró la Policía Nacional en cada departamento durante el año. Mientras más oscuro el color, más casos hubo.",
      unitExplainer: "\"Casos\" son hurtos reportados oficialmente por la Policía Nacional.",
      lowLabel: "Menos casos",
      highLabel: "Más casos",
    },
  ];

  const nationalStats = [
    {
      icon: ShieldAlert,
      label: `Homicidios en ${homicidios.year} (total nacional)`,
      value: homicidios.data.reduce((sum, d) => sum + d.value, 0),
      suffix: "",
    },
    {
      icon: Banknote,
      label: `PIB nacional ${pib.year} (miles de millones COP)`,
      value: Math.round(pib.data.reduce((sum, d) => sum + d.value, 0)),
      suffix: "",
    },
    {
      icon: Landmark,
      label: `Desempeño municipal promedio (${mdm.year})`,
      value: Math.round(average(mdm.data.map((d) => d.value)) * 10) / 10,
      suffix: " / 100",
    },
    {
      icon: AlertTriangle,
      label: `Legalidad institucional promedio (${integra.year})`,
      value: Math.round(average(integra.data.map((d) => d.value)) * 10) / 10,
      suffix: " / 100",
    },
    {
      icon: GraduationCap,
      label: `Cobertura escolar promedio (${educacion.year})`,
      value: Math.round(average(educacion.data.map((d) => d.value)) * 10) / 10,
      suffix: "%",
    },
    {
      icon: Siren,
      label: `Hurtos en ${hurtos.year} (total nacional)`,
      value: hurtos.data.reduce((sum, d) => sum + d.value, 0),
      suffix: "",
    },
  ];

  const trendSeries: TrendSeries[] = [
    { id: "homicidios", label: "Homicidios", color: "var(--destructive)", data: homicideTrend },
    { id: "hurtos", label: "Hurtos", color: "#d946ef", data: theftTrend },
  ];

  return (
    <section className="py-16 sm:py-24">
      <Container>
        <Reveal className="max-w-2xl">
          <span className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            Observatorio regional
          </span>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Así va el país
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
            . Explora violencia, economía, gestión de gobiernos locales y riesgo de
            corrupción, departamento por departamento.
          </p>
        </Reveal>

        {/* Resumen nacional: da contexto de país antes de entrar al detalle por departamento */}
        <Reveal className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {nationalStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-border bg-surface p-4">
                <Icon className="size-4 text-brand" aria-hidden="true" />
                <p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </Reveal>

        {/* Tendencia en el tiempo: complementa el mapa, que solo compara un año a la vez.
            Permite superponer indicadores y compara el promedio por periodo presidencial. */}
        <Reveal className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <p className="text-sm font-semibold">
            Tendencia nacional, {homicideTrend[0]?.year}–{homicideTrend[homicideTrend.length - 1]?.year}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Total nacional por año. Activa o desactiva indicadores para compararlos, y pasa el
            mouse sobre cada punto para ver el dato exacto. Las franjas de color marcan cada
            gobierno.
          </p>
          <div className="mt-4">
            <NationalTrendChart series={trendSeries} />
          </div>
        </Reveal>

        <div className="mt-6">
          <ColombiaDashboardClient shapes={shapes} topics={topics} />
        </div>
      </Container>
    </section>
  );
}
