import "server-only";

import { poblacionDe } from "@/lib/dane/poblacion";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { fuerza, partirEnGrupos, spearman } from "./estadistica";
import { municipiosDe } from "./lugares";
import { NOMBRE_CABAL } from "./votacion";

/**
 * Relaciona, municipio por municipio dentro de un departamento, cómo votó la gente (María Fernanda Cabal, su partido y la oposición)
 * con cuánto conflicto y qué problemas hay. Todo sale de Supabase: los votos de las vistas de resultados y las cifras de
 * `indicadores_territoriales`. Es una comparación entre territorios: no dice cómo vota cada persona ni que una cosa cause la otra.
 */

const ANIO_POBLACION = 2026;
const OPOSICION = "partido.ilike.*PACTO HIST*,partido.ilike.*DECENCIA*,partido.ilike.*COLOMBIA HUMANA*";

export type FilaMunicipio = {
  dane: string;
  nombre: string;
  poblacion: number | null;
  /** Votos y % de los válidos del Senado 2022 (María Fernanda Cabal con voto preferente). */
  cabal2022: number | null;
  cabalPct2022: number | null;
  /** Centro Democrático (lista cerrada) en el Senado 2026. */
  cdPct2026: number | null;
  /** Pacto Histórico en el Senado 2022 y 2026, y en la segunda vuelta presidencial de 2026. */
  oposPct2022: number | null;
  oposPct2026: number | null;
  oposPresidencia2026: number | null;
  victimasPorMil: number | null;
  homicidios100k: number | null;
  cocaHa: number | null;
  pdet: boolean;
};

export type GrupoRelacion = {
  etiqueta: string;
  municipios: number;
  poblacion: number;
  victimasPorMil: number | null;
  oposPresidencia2026: number | null;
  oposPct2026: number | null;
  cdPct2026: number | null;
  cabalPct2022: number | null;
};

export type Relacion = {
  /** Hay municipios suficientes y cifras cargadas para comparar. */
  suficiente: boolean;
  motivo?: string;
  filas: FilaMunicipio[];
  grupos: GrupoRelacion[];
  correlaciones: { etiqueta: string; r: number; n: number; fuerza: string }[];
  lectura: string[];
};

type Fila = Record<string, unknown>;

/** Lee todas las filas de una consulta (Supabase entrega como máximo 1.000 por página). */
async function todas(consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<Fila[]> {
  const filas: Fila[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw new Error(error.message);
    filas.push(...((data ?? []) as Fila[]));
    if ((data ?? []).length < 1000) return filas;
  }
}

const sumaPorDane = (filas: Fila[], campo = "votos") => {
  const m = new Map<string, number>();
  for (const f of filas) m.set(String(f.dane), (m.get(String(f.dane)) ?? 0) + Number(f[campo]));
  return m;
};

export async function relacionDelDepartamento(dep: string): Promise<Relacion> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const municipios = municipiosDe(dep);
  const vacia = (motivo: string): Relacion => ({ suficiente: false, motivo, filas: [], grupos: [], correlaciones: [], lectura: [] });
  if (municipios.length < 6) return vacia("Este departamento tiene muy pocos municipios para compararlos entre sí.");
  const prefijo = `${dep}%`;

  const validos = async (eleccion: string, corporacion: string) => {
    const filas = await todas((d, h) => c.from("resultados_electorales").select("dane, votantes, nulos, no_marcados").eq("eleccion", eleccion).eq("corporacion", corporacion).eq("nivel", 3).eq("vacio", false).like("dane", prefijo).order("dane").range(d, h));
    return new Map(filas.map((f) => [String(f.dane), Number(f.votantes) - Number(f.nulos) - Number(f.no_marcados)]));
  };
  const votosPartido = (eleccion: string, corporacion: string, filtro: "oposicion" | "cd") =>
    todas((d, h) => {
      const q = c.from("partidos_electorales").select("dane, votos").eq("eleccion", eleccion).eq("corporacion", corporacion).eq("nivel", 3).like("dane", prefijo);
      return (filtro === "oposicion" ? q.or(OPOSICION) : q.ilike("partido", "*CENTRO DEMOCR*")).order("dane").range(d, h);
    });

  const [v2022, v2026, vPres, opos2022, opos2026, oposPres, cd2026, cabal, ind] = await Promise.all([
    validos("congreso-2022", "SE"),
    validos("congreso-2026", "SE"),
    validos("presidencia-2026-2v", "PR"),
    votosPartido("congreso-2022", "SE", "oposicion"),
    votosPartido("congreso-2026", "SE", "oposicion"),
    votosPartido("presidencia-2026-2v", "PR", "oposicion"),
    votosPartido("congreso-2026", "SE", "cd"),
    todas((d, h) => c.from("candidatos_electorales").select("dane, votos").eq("eleccion", "congreso-2022").eq("corporacion", "SE").eq("nivel", 3).like("dane", prefijo).ilike("candidato", `*${NOMBRE_CABAL.split(" ").slice(-2).join(" ")}*`).order("dane").range(d, h)),
    todas((d, h) => c.from("indicadores_territoriales").select("dane, indicador, periodo, valor").in("indicador", ["victimas_total", "homicidios", "coca_ha", "pdet"]).like("dane", prefijo).order("dane").range(d, h)).catch((e: Error) => {
      if (/schema cache|does not exist|42P01|PGRST20[25]/i.test(e.message)) return [] as Fila[];
      throw e;
    }),
  ]);
  const o22 = sumaPorDane(opos2022);
  const o26 = sumaPorDane(opos2026);
  const oPres = sumaPorDane(oposPres);
  const cd26 = sumaPorDane(cd2026);
  const cab = sumaPorDane(cabal);

  // El periodo más reciente de cada indicador por municipio («2021-2025» ordena bien como texto).
  const reciente = new Map<string, { periodo: string; valor: number }>();
  for (const f of ind) {
    const k = `${f.dane}|${f.indicador}`;
    const previo = reciente.get(k);
    if (!previo || String(f.periodo) > previo.periodo) reciente.set(k, { periodo: String(f.periodo), valor: Number(f.valor) });
  }
  const hayIndicadores = ind.length > 0;
  const hayVictimas = [...reciente.keys()].some((k) => k.endsWith("|victimas_total"));

  const filas: FilaMunicipio[] = municipios.map((m) => {
    const poblacion = poblacionDe(m.dane, ANIO_POBLACION)?.total ?? null;
    const pct = (votos: Map<string, number>, base: Map<string, number>) => (base.has(m.dane) && base.get(m.dane)! > 0 && votos.has(m.dane) ? (votos.get(m.dane)! / base.get(m.dane)!) * 100 : base.has(m.dane) && base.get(m.dane)! > 0 ? 0 : null);
    const dato = (ind: string) => reciente.get(`${m.dane}|${ind}`)?.valor;
    return {
      dane: m.dane,
      nombre: m.nombre,
      poblacion,
      cabal2022: v2022.has(m.dane) ? (cab.get(m.dane) ?? 0) : null,
      cabalPct2022: pct(cab, v2022),
      cdPct2026: pct(cd26, v2026),
      oposPct2022: pct(o22, v2022),
      oposPct2026: pct(o26, v2026),
      oposPresidencia2026: pct(oPres, vPres),
      victimasPorMil: hayVictimas && poblacion ? ((dato("victimas_total") ?? 0) / poblacion) * 1000 : null,
      homicidios100k: hayIndicadores && poblacion && [...reciente.keys()].some((k) => k.endsWith("|homicidios")) ? ((dato("homicidios") ?? 0) / 5 / poblacion) * 100_000 : null,
      cocaHa: hayIndicadores && [...reciente.keys()].some((k) => k.endsWith("|coca_ha")) ? (dato("coca_ha") ?? 0) : null,
      pdet: (dato("pdet") ?? 0) > 0,
    };
  });

  if (!hayVictimas) {
    return { ...vacia("Todavía no están cargadas las cifras de conflicto (se cargan desde esta misma sección)."), filas };
  }
  const comparables = filas.filter((f) => f.victimasPorMil !== null && f.oposPresidencia2026 !== null);
  if (comparables.length < 6) return { ...vacia("No hay resultados electorales guardados de suficientes municipios de este departamento."), filas };

  // Tres grupos de municipios según cuántas víctimas por habitante tienen; los votos se suman (no se promedian los porcentajes).
  const grupos: GrupoRelacion[] = partirEnGrupos(comparables.map((f) => f.victimasPorMil!), 3).map((idx, g) => {
    const m = idx.map((i) => comparables[i]);
    const compartido = (votos: Map<string, number>, base: Map<string, number>) => {
      let a = 0;
      let b = 0;
      for (const f of m) if (base.has(f.dane)) { a += votos.get(f.dane) ?? 0; b += base.get(f.dane)!; }
      return b > 0 ? (a / b) * 100 : null;
    };
    return {
      etiqueta: ["Menos víctimas por habitante", "Término medio", "Más víctimas por habitante"][g],
      municipios: m.length,
      poblacion: m.reduce((s, f) => s + (f.poblacion ?? 0), 0),
      victimasPorMil: m.length ? m.reduce((s, f) => s + f.victimasPorMil!, 0) / m.length : null,
      oposPresidencia2026: compartido(oPres, vPres),
      oposPct2026: compartido(o26, v2026),
      cdPct2026: compartido(cd26, v2026),
      cabalPct2022: compartido(cab, v2022),
    };
  });

  const correlacion = (etiqueta: string, x: (f: FilaMunicipio) => number | null, y: (f: FilaMunicipio) => number | null) => {
    const pares = filas.flatMap((f) => (x(f) !== null && y(f) !== null ? [[x(f)!, y(f)!]] : []));
    const r = spearman(pares.map((p) => p[0]), pares.map((p) => p[1]));
    return r === null || pares.length < 6 ? [] : [{ etiqueta, r, n: pares.length, fuerza: fuerza(r) }];
  };
  const correlaciones = [
    ...correlacion("Víctimas por habitante y voto a la oposición (2ª vuelta 2026)", (f) => f.victimasPorMil, (f) => f.oposPresidencia2026),
    ...correlacion("Víctimas por habitante y voto al Pacto Histórico (Senado 2026)", (f) => f.victimasPorMil, (f) => f.oposPct2026),
    ...correlacion("Víctimas por habitante y voto a María Fernanda Cabal (Senado 2022)", (f) => f.victimasPorMil, (f) => f.cabalPct2022),
    ...correlacion("Víctimas por habitante y voto al Centro Democrático (Senado 2026)", (f) => f.victimasPorMil, (f) => f.cdPct2026),
    ...correlacion("Homicidios por habitante y voto a la oposición (2ª vuelta 2026)", (f) => f.homicidios100k, (f) => f.oposPresidencia2026),
  ];

  const [bajo, , alto] = grupos;
  const p1 = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-CO", { maximumFractionDigits: 1 }));
  const lectura: string[] = [];
  if (alto.oposPresidencia2026 !== null && bajo.oposPresidencia2026 !== null) {
    lectura.push(`En los ${alto.municipios} municipios con más víctimas por habitante, la oposición (Pacto Histórico) sacó ${p1(alto.oposPresidencia2026)} % de los votos en la segunda vuelta presidencial de 2026; en los ${bajo.municipios} con menos, ${p1(bajo.oposPresidencia2026)} %.`);
  }
  if (alto.oposPct2026 !== null && bajo.oposPct2026 !== null) {
    lectura.push(`En el Senado 2026, el Pacto Histórico tuvo ${p1(alto.oposPct2026)} % en los más afectados y ${p1(bajo.oposPct2026)} % en los menos afectados; el Centro Democrático, ${p1(alto.cdPct2026)} % y ${p1(bajo.cdPct2026)} %.`);
  }
  const principal = correlaciones[0];
  if (principal) lectura.push(`La relación entre víctimas por habitante y voto a la oposición es ${principal.fuerza} (${principal.r >= 0 ? "positiva" : "negativa"}, r de Spearman = ${principal.r.toLocaleString("es-CO", { maximumFractionDigits: 2 })}, ${principal.n} municipios).`);
  lectura.push("Es una comparación entre municipios: no dice cómo vota cada persona ni que el conflicto explique el voto.");

  return { suficiente: true, filas, grupos, correlaciones, lectura };
}
