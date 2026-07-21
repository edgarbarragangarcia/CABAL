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
