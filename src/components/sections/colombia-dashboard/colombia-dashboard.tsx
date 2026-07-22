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
  getNationalGdpTrend,
  getNationalHomicideTrend,
  getNationalTheftTrend,
  getTheftsByDepartment,
  GOV_DATASETS,
} from "@/lib/gov-data/queries";
import { projectLinearTrend } from "@/lib/gov-data/trend-projection";
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
  let shapes,
    homicidios,
    pib,
    mdm,
    integra,
    educacion,
    hurtos,
    homicideTrend,
    theftTrend,
    gdpTrendNominal,
    gdpTrendReal;

  try {
    [
      shapes,
      homicidios,
      pib,
      mdm,
      integra,
      educacion,
      hurtos,
      homicideTrend,
      theftTrend,
      gdpTrendNominal,
      gdpTrendReal,
    ] = await Promise.all([
      getColombiaDepartmentShapes(),
      getHomicidesByDepartment(),
      getGdpByDepartment(),
      getGovernmentPerformanceByDepartment(),
      getAnticorruptionIndexByDepartment(),
      getEducationCoverageByDepartment(),
      getTheftsByDepartment(),
      getNationalHomicideTrend(),
      getNationalTheftTrend(),
      getNationalGdpTrend(10, "corrientes"),
      getNationalGdpTrend(10, "constantes"),
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

  const PROJECTION_YEARS = 3;

  // Nota: PIB va en una gráfica aparte porque su escala (miles de
  // millones) no es comparable con conteos de casos — superponerlos en
  // el mismo eje aplanaría una de las dos series y sería engañoso.
  const securityTrendSeries: TrendSeries[] = [
    {
      id: "homicidios",
      label: "Homicidios",
      color: "var(--destructive)",
      data: homicideTrend,
      projection: projectLinearTrend(homicideTrend, PROJECTION_YEARS),
    },
    {
      id: "hurtos",
      label: "Hurtos",
      color: "#d946ef",
      data: theftTrend,
      projection: projectLinearTrend(theftTrend, PROJECTION_YEARS),
    },
  ];

  // PIB nominal vs. PIB real (a precios constantes de 2015, es decir,
  // ya descontada la inflación): la brecha entre ambas líneas es lo más
  // cercano a "poder adquisitivo" que se puede mostrar con series
  // nacionales del DANE sin inventar un índice propio.
  const economyTrendSeries: TrendSeries[] = [
    {
      id: "pib-nominal",
      label: "PIB nominal",
      color: "var(--brand)",
      data: gdpTrendNominal,
      projection: projectLinearTrend(gdpTrendNominal, PROJECTION_YEARS),
    },
    {
      id: "pib-real",
      label: "PIB real (precios 2015)",
      color: "var(--accent)",
      data: gdpTrendReal,
      projection: projectLinearTrend(gdpTrendReal, PROJECTION_YEARS),
    },
  ];

  // Deflactor implícito del PIB = PIB nominal / PIB real × 100, con base
  // 100 en 2015. Es un proxy de inflación a nivel de toda la economía —
  // NO es el salario real ni el costo de vida de los hogares, y se
  // etiqueta así explícitamente para no sobre-interpretarlo.
  const deflatorTrend = gdpTrendNominal
    .map((n) => {
      const real = gdpTrendReal.find((r) => r.year === n.year);
      if (!real || real.total === 0) return null;
      return { year: n.year, total: Math.round((n.total / real.total) * 100 * 10) / 10 };
    })
    .filter((d): d is { year: number; total: number } => d !== null);

  const deflatorSeries: TrendSeries[] = [
    {
      id: "deflactor",
      label: "Deflactor del PIB (base 2015 = 100)",
      color: "#eab308",
      data: deflatorTrend,
      projection: projectLinearTrend(deflatorTrend, PROJECTION_YEARS),
    },
  ];
  const latestDeflator = deflatorTrend[deflatorTrend.length - 1]?.total ?? null;

  return (
    <section className="py-16 sm:py-24">
      <Container>
        {/* Resumen nacional: da contexto de país antes de entrar al detalle por departamento */}
        <Reveal className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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

        {/* Tendencias en el tiempo: complementan el mapa, que solo compara un año a la vez.
            Permiten superponer indicadores, comparar promedio por gobierno y ver una
            proyección estadística opcional (sin atribución causal ni política). */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Reveal className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <p className="text-sm font-semibold">
              Seguridad, {homicideTrend[0]?.year}–{homicideTrend[homicideTrend.length - 1]?.year}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Homicidios y hurtos a nivel nacional. Actívalos o desactívalos para comparar.
            </p>
            <div className="mt-4">
              <NationalTrendChart series={securityTrendSeries} />
            </div>
          </Reveal>

          <Reveal className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <p className="text-sm font-semibold">
              Economía, {gdpTrendNominal[0]?.year}–{gdpTrendNominal[gdpTrendNominal.length - 1]?.year}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PIB nacional en miles de millones de pesos. El <strong>nominal</strong> crece más
              rápido porque incluye inflación; el <strong>real</strong> (a precios constantes de
              2015) descuenta la inflación — la diferencia entre ambas líneas es, en la práctica,
              cuánto de ese crecimiento se traduce en más poder adquisitivo y cuánto es solo
              aumento de precios.
            </p>
            <div className="mt-4">
              <NationalTrendChart series={economyTrendSeries} />
            </div>
          </Reveal>
        </div>

        {/* Deflactor del PIB: la aproximación más honesta a "inflación
            general" que se puede calcular con los datos oficiales que ya
            tenemos, sin traer una fuente nueva sin verificar. */}
        <Reveal className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <p className="text-sm font-semibold">
            Deflactor del PIB, {deflatorTrend[0]?.year}–{deflatorTrend[deflatorTrend.length - 1]?.year}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Calculado como PIB nominal ÷ PIB real × 100 (base 2015 = 100), con los mismos datos
            del DANE de arriba.{" "}
            {latestDeflator !== null && (
              <>
                En {deflatorTrend[deflatorTrend.length - 1].year}, algo que costaba $100 en 2015
                cuesta en promedio <strong>${latestDeflator.toLocaleString("es-CO")}</strong> —
                un {Math.round(latestDeflator - 100)}% más.
              </>
            )}{" "}
            <strong>No es</strong> el salario real ni el costo de vida de los hogares (para eso
            haría falta el IPC y el salario mínimo real, que no encontré en una fuente oficial
            verificable con acceso público por API) — es un indicador de precios a nivel de toda
            la economía.
          </p>
          <div className="mt-4">
            <NationalTrendChart series={deflatorSeries} />
          </div>
        </Reveal>

        <div className="mt-6">
          <ColombiaDashboardClient shapes={shapes} topics={topics} />
        </div>
      </Container>
    </section>
  );
}
