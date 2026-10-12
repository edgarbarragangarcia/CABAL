import "server-only";

import { poblacionDe, poblacionPais } from "@/lib/dane/poblacion";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { GRUPOS, INDICADORES, type Grupo } from "./catalogo";

/** Año de población con el que se calculan las tasas (el más cercano que tiene el archivo del DANE). */
const ANIO_POBLACION = 2026;

type Resumen = { indicador: string; periodo: string; valor: number; municipios: number; detalle: string | null; fuente: string | null; corte: string | null };

export type ItemIndicador = {
  clave: string;
  grupo: Grupo;
  etiqueta: string;
  unidad: string;
  ayuda: string;
  fuente: string;
  valor: number;
  /** El periodo del dato: «acum», un año o una ventana («2021-2025»). */
  periodo: string;
  anterior?: { periodo: string; valor: number };
  /** Por cada 1.000 habitantes (víctimas) o por cada 100.000 y por año (homicidios...). */
  tasa?: { cantidad: number; texto: string };
  /** Lo mismo para todo el país y cuántas veces es el del lugar respecto al del país. */
  nacional?: { valor: number; tasa?: number };
  veces?: number;
  detalle?: string | null;
  corte?: string | null;
  /** Departamento: en cuántos municipios hay algo (p. ej. municipios PDET). */
  municipios?: number;
};

export type Indicadores = {
  /** Las tablas de territorio existen y tienen cifras. */
  disponible: boolean;
  /** Falta crear las tablas (supabase/territorio.sql). */
  sinTablas?: boolean;
  poblacion: number | null;
  anioPoblacion: number;
  items: ItemIndicador[];
  grupos: { grupo: Grupo; nombre: string }[];
};

async function resumen(prefijo: string): Promise<Resumen[]> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const { data, error } = await c.rpc("indicadores_resumen", { p_prefijo: prefijo });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    indicador: String(f.indicador),
    periodo: String(f.periodo),
    valor: Number(f.valor),
    municipios: Number(f.municipios),
    detalle: (f.detalle as string | null) ?? null,
    fuente: (f.fuente as string | null) ?? null,
    corte: (f.corte as string | null) ?? null,
  }));
}

const faltaTabla = (e: unknown) => /schema cache|does not exist|42P01|PGRST20[25]/i.test(`${(e as { code?: string }).code ?? ""} ${(e as Error).message ?? ""}`);

/** El periodo más reciente de un indicador, y el anterior si hay. «2021-2025» y «2024» ordenan bien como texto. */
function periodos(filas: Resumen[]): { actual: Resumen; anterior?: Resumen } | null {
  if (filas.length === 0) return null;
  const orden = [...filas].sort((a, b) => b.periodo.localeCompare(a.periodo));
  return { actual: orden[0], anterior: orden[1] };
}

/** Las cifras de conflicto y problemas de un departamento (2 dígitos) o municipio (5), con la comparación contra el país. */
export async function indicadoresDe(dane: string): Promise<Indicadores> {
  const poblacion = poblacionDe(dane, ANIO_POBLACION)?.total ?? null;
  const base: Indicadores = { disponible: false, poblacion, anioPoblacion: ANIO_POBLACION, items: [], grupos: [] };
  let lugar: Resumen[];
  let pais: Resumen[];
  try {
    [lugar, pais] = await Promise.all([resumen(dane), resumen("")]);
  } catch (e) {
    if (faltaTabla(e)) return { ...base, sinTablas: true };
    throw e;
  }
  if (pais.length === 0) return base;
  const poblacionNacional = poblacionPais(ANIO_POBLACION)?.total ?? null;

  const items: ItemIndicador[] = [];
  for (const [clave, def] of Object.entries(INDICADORES)) {
    const nacional = periodos(pais.filter((f) => f.indicador === clave));
    if (!nacional) continue; // esa fuente todavía no se ha cargado
    const propio = periodos(lugar.filter((f) => f.indicador === clave));
    // Si la fuente está cargada y el lugar no aparece, es que no tiene casos (p. ej. ni una hectárea de coca).
    const valor = propio?.actual.valor ?? 0;
    const periodo = propio?.actual.periodo ?? nacional.actual.periodo;
    const sobre = (v: number, pob: number | null) => {
      if (!pob || !def.tasa) return undefined;
      if (def.tasa === "mil") return (v / pob) * 1000;
      return (v / 5 / pob) * 100_000;
    };
    const tasa = sobre(valor, poblacion);
    const tasaNacional = sobre(nacional.actual.valor, poblacionNacional);
    items.push({
      clave,
      grupo: def.grupo,
      etiqueta: def.etiqueta,
      unidad: def.unidad,
      ayuda: def.ayuda,
      fuente: def.fuente,
      valor,
      periodo,
      ...(propio?.anterior ? { anterior: { periodo: propio.anterior.periodo, valor: propio.anterior.valor } } : {}),
      ...(tasa !== undefined ? { tasa: { cantidad: tasa, texto: def.tasa === "mil" ? "por cada 1.000 habitantes" : "por cada 100.000 habitantes al año" } } : {}),
      nacional: { valor: nacional.actual.valor, ...(tasaNacional !== undefined ? { tasa: tasaNacional } : {}) },
      ...(tasa !== undefined && tasaNacional ? { veces: tasa / tasaNacional } : {}),
      detalle: clave === "pdet" ? (dane.length === 5 ? (propio?.actual.detalle ?? null) : null) : (propio?.actual.detalle ?? null),
      corte: nacional.actual.corte,
      ...(dane.length === 2 || clave === "pdet" ? { municipios: propio?.actual.municipios ?? 0 } : {}),
    });
  }
  const gruposPresentes = [...new Set(items.map((i) => i.grupo))];
  return {
    ...base,
    disponible: items.length > 0,
    items,
    grupos: (Object.keys(GRUPOS) as Grupo[]).filter((g) => gruposPresentes.includes(g)).map((g) => ({ grupo: g, nombre: GRUPOS[g] })),
  };
}

export type EstadoFuente = { indicador: string; filas: number; corte: string | null; actualizadoEn: string | null };

/** Qué hay cargado de cada indicador (para el panel de fuentes). `tabla: false` si faltan las tablas. */
export async function estadoDeFuentes(): Promise<{ tabla: boolean; fuentes: EstadoFuente[] }> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const { data, error } = await c.rpc("resumen_indicadores");
  if (error) {
    if (faltaTabla(error)) return { tabla: false, fuentes: [] };
    throw new Error(error.message);
  }
  return {
    tabla: true,
    fuentes: ((data ?? []) as Record<string, unknown>[]).map((f) => ({ indicador: String(f.indicador), filas: Number(f.filas), corte: (f.corte as string | null) ?? null, actualizadoEn: (f.actualizado_en as string | null) ?? null })),
  };
}
