import { normalizeDeptCode, querySocrataDataset } from "./socrata";

export type DepartmentDatum = {
  code: string;
  name: string;
  value: number;
};

/** IDs de los datasets oficiales en datos.gov.co usados en el Observatorio. */
export const GOV_DATASETS = {
  homicidios: {
    id: "m8fd-ahd9",
    title: "Homicidios",
    source: "Policía Nacional de Colombia (DIJIN)",
    url: "https://www.datos.gov.co/Seguridad-y-Defensa/HOMICIDIO/m8fd-ahd9",
  },
  pibDepartamental: {
    id: "kgyi-qc7j",
    title: "PIB departamental",
    source: "DANE — Cuentas Nacionales Departamentales",
    url: "https://www.datos.gov.co/Econom-a-y-Finanzas/PIB-Departamental-con-proyecci-n/kgyi-qc7j",
  },
  desempenoMunicipal: {
    id: "nkjx-rsq7",
    title: "Medición del Desempeño Municipal (MDM)",
    source: "Departamento Nacional de Planeación (DNP)",
    url: "https://www.datos.gov.co/Agricultura-y-Desarrollo-Rural/DNP-Medici-n-del-Desempe-o-Municipal/nkjx-rsq7",
  },
  integraLegalidad: {
    id: "i594-3uqz",
    title: "Índice Integral de Legalidad (INTEGRA)",
    source: "Procuraduría General de la Nación",
    url: "https://www.datos.gov.co/Funci-n-p-blica/INTEGRA-ndice-Integral-de-Legalidad-/i594-3uqz",
  },
  coberturaEducativa: {
    id: "ji8i-4anb",
    title: "Cobertura educativa por departamento",
    source: "Ministerio de Educación Nacional (MEN)",
    url: "https://www.datos.gov.co/Educaci-n/MEN_ESTADISTICAS_EN_EDUCACION_EN_PREESCOLAR-B-SIC/ji8i-4anb",
  },
  hurtos: {
    id: "6sqw-8cg5",
    title: "Reporte de hurto por modalidades",
    source: "Policía Nacional de Colombia (DIPON)",
    url: "https://www.datos.gov.co/Seguridad-y-Defensa/Reporte-Hurto-por-Modalidades-Polic-a-Nacional/6sqw-8cg5",
  },
} as const;

const currentYear = new Date().getFullYear();

/** Total de homicidios por departamento en un año (Policía Nacional). */
export async function getHomicidesByDepartment(
  year: number = currentYear - 1
): Promise<{ data: DepartmentDatum[]; year: number }> {
  const rows = await querySocrataDataset<{
    cod_depto: string;
    departamento: string;
    total: string;
  }>(GOV_DATASETS.homicidios.id, {
    $select: "cod_depto, departamento, sum(cantidad) as total",
    $where: `fecha_hecho between '${year}-01-01T00:00:00' and '${year}-12-31T23:59:59'`,
    $group: "cod_depto, departamento",
    $limit: 40,
  });

  return {
    year,
    data: rows.map((r) => ({
      code: normalizeDeptCode(r.cod_depto),
      name: r.departamento,
      value: Number(r.total),
    })),
  };
}

/** PIB nominal (miles de millones COP) por departamento en el último año disponible. */
export async function getGdpByDepartment(): Promise<{
  data: DepartmentDatum[];
  year: number;
}> {
  const [{ max_a_o }] = await querySocrataDataset<{ max_a_o: string }>(
    GOV_DATASETS.pibDepartamental.id,
    { $select: "max(a_o) as max_a_o" }
  );
  const year = Number(max_a_o);

  const rows = await querySocrataDataset<{
    c_digo_departamento_divipola: string;
    departamento: string;
    total: string;
  }>(GOV_DATASETS.pibDepartamental.id, {
    $select: "c_digo_departamento_divipola, departamento, sum(valor_miles_de_millones_de) as total",
    $where: `a_o='${year}' AND tipo_de_precios='PIB a precios corrientes'`,
    $group: "c_digo_departamento_divipola, departamento",
    $limit: 40,
  });

  return {
    year,
    data: rows.map((r) => ({
      code: normalizeDeptCode(r.c_digo_departamento_divipola),
      name: r.departamento,
      value: Number(r.total),
    })),
  };
}

/** Promedio del índice MDM (0-100) de los municipios de cada departamento. */
export async function getGovernmentPerformanceByDepartment(): Promise<{
  data: DepartmentDatum[];
  year: number;
}> {
  const [{ max_anio }] = await querySocrataDataset<{ max_anio: string }>(
    GOV_DATASETS.desempenoMunicipal.id,
    { $select: "max(anio) as max_anio", $where: "indicador='MDM'" }
  );
  const year = Number(max_anio);

  const rows = await querySocrataDataset<{
    codigo_departamento: string;
    departamento: string;
    promedio: string;
  }>(GOV_DATASETS.desempenoMunicipal.id, {
    $select: "codigo_departamento, departamento, avg(dato::number) as promedio",
    $where: `indicador='MDM' AND anio='${year}'`,
    $group: "codigo_departamento, departamento",
    $limit: 40,
  });

  return {
    year,
    data: rows
      .filter((r) => r.departamento)
      .map((r) => ({
        code: normalizeDeptCode(r.codigo_departamento),
        name: r.departamento,
        value: Math.round(Number(r.promedio) * 10) / 10,
      })),
  };
}

/**
 * Promedio departamental del Índice Integral de Legalidad (INTEGRA) de la
 * Procuraduría: mide riesgo de corrupción institucional (contratación,
 * control interno, transparencia y gestión financiera). 0-100, más alto
 * es mejor (menor riesgo).
 */
export async function getAnticorruptionIndexByDepartment(): Promise<{
  data: DepartmentDatum[];
  year: number;
}> {
  const [{ max_periodo }] = await querySocrataDataset<{ max_periodo: string }>(
    GOV_DATASETS.integraLegalidad.id,
    { $select: "max(periodo_medicion) as max_periodo" }
  );
  const year = Number(max_periodo);

  const rows = await querySocrataDataset<{
    dpto_ccdgo: string;
    departamento: string;
    promedio: string;
  }>(GOV_DATASETS.integraLegalidad.id, {
    $select: "dpto_ccdgo, departamento, avg(integra::number) as promedio",
    $where: `periodo_medicion='${year}'`,
    $group: "dpto_ccdgo, departamento",
    $limit: 40,
  });

  return {
    year,
    data: rows
      .filter((r) => r.departamento && r.dpto_ccdgo)
      .map((r) => ({
        code: normalizeDeptCode(r.dpto_ccdgo),
        name: r.departamento,
        value: Math.round(Number(r.promedio) * 10) / 10,
      })),
  };
}

/** Cobertura neta de educación (%) por departamento, último año disponible. */
export async function getEducationCoverageByDepartment(): Promise<{
  data: DepartmentDatum[];
  year: number;
}> {
  const [{ max_ano }] = await querySocrataDataset<{ max_ano: string }>(
    GOV_DATASETS.coberturaEducativa.id,
    { $select: "max(ano) as max_ano" }
  );
  const year = Number(max_ano);

  const rows = await querySocrataDataset<{
    c_digo_departamento: string;
    departamento: string;
    cobertura_neta: string;
  }>(GOV_DATASETS.coberturaEducativa.id, {
    $select: "c_digo_departamento, departamento, cobertura_neta",
    $where: `ano='${year}'`,
    $limit: 40,
  });

  return {
    year,
    data: rows
      .filter((r) => r.departamento && r.cobertura_neta)
      .map((r) => ({
        code: normalizeDeptCode(r.c_digo_departamento),
        name: r.departamento,
        value: Math.round(Number(r.cobertura_neta) * 10) / 10,
      })),
  };
}

/** Total de hurtos por departamento en un año (Policía Nacional). */
export async function getTheftsByDepartment(
  year: number = currentYear - 1
): Promise<{ data: DepartmentDatum[]; year: number }> {
  const rows = await querySocrataDataset<{
    dpto: string;
    departamento: string;
    total: string;
  }>(GOV_DATASETS.hurtos.id, {
    $select: "substring(codigo_dane,1,2) as dpto, departamento, sum(cantidad::number) as total",
    $where: `fecha_hecho like '%/${year}'`,
    $group: "dpto, departamento",
    $limit: 40,
  });

  return {
    year,
    data: rows
      .filter((r) => r.dpto)
      .map((r) => ({
        code: normalizeDeptCode(r.dpto),
        name: r.departamento,
        value: Number(r.total),
      })),
  };
}

/** Tendencia nacional de homicidios por año (últimos `years` años completos). */
export async function getNationalHomicideTrend(
  years: number = 10
): Promise<{ year: number; total: number }[]> {
  const endYear = currentYear - 1;
  const startYear = endYear - years + 1;

  const rows = await querySocrataDataset<{ anio: string; total: string }>(
    GOV_DATASETS.homicidios.id,
    {
      $select: "date_extract_y(fecha_hecho) as anio, sum(cantidad) as total",
      $where: `fecha_hecho >= '${startYear}-01-01T00:00:00' AND fecha_hecho < '${endYear + 1}-01-01T00:00:00'`,
      $group: "anio",
      $order: "anio",
    }
  );

  return rows.map((r) => ({ year: Number(r.anio), total: Number(r.total) }));
}

/** Tendencia nacional de hurtos por año (últimos `years` años completos). */
export async function getNationalTheftTrend(
  years: number = 10
): Promise<{ year: number; total: number }[]> {
  const endYear = currentYear - 1;
  const startYear = endYear - years + 1;

  const rows = await querySocrataDataset<{ anio: string; total: string }>(
    GOV_DATASETS.hurtos.id,
    {
      $select: "substring(fecha_hecho,7,4) as anio, sum(cantidad::number) as total",
      $group: "anio",
      $order: "anio",
    }
  );

  return rows
    .map((r) => ({ year: Number(r.anio), total: Number(r.total) }))
    .filter((r) => r.year >= startYear && r.year <= endYear);
}

/** Tendencia nacional del PIB nominal (miles de millones COP) por año. */
export async function getNationalGdpTrend(
  years: number = 10
): Promise<{ year: number; total: number }[]> {
  const rows = await querySocrataDataset<{ a_o: string; total: string }>(
    GOV_DATASETS.pibDepartamental.id,
    {
      $select: "a_o, sum(valor_miles_de_millones_de) as total",
      $where: "tipo_de_precios='PIB a precios corrientes'",
      $group: "a_o",
      $order: "a_o",
    }
  );

  const all = rows.map((r) => ({ year: Number(r.a_o), total: Number(r.total) }));
  return all.slice(Math.max(all.length - years, 0));
}
