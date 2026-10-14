import "server-only";

import snapshot from "@/data/dane/municipios.json";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Los municipios del país en cuatro grupos según la estructura que ya hay y las condiciones locales (tal como pide el acta de la
 * alianza). La estructura se cuenta con lo que está en Supabase: afiliados de la comunidad y contactos de los portales, ubicados por
 * municipio y departamento. Las condiciones salen de la población (DANE, proyección 2026) y de los indicadores territoriales (PDET,
 * cultivos de coca, víctimas) cuando están cargados. Los umbrales son una primera propuesta: están a la vista para ajustarlos.
 */
type Registro = { nombre: string; dep: string; departamento: string; pob: Record<string, number[]> };
const municipios = (snapshot as unknown as { municipios: Record<string, Registro> }).municipios;

export const UMBRALES = { consolidado: 20, base: 3, poblacionOportunidad: 30_000 } as const;

export type GrupoId = 1 | 2 | 3 | 4;
export const GRUPOS: Record<GrupoId, { nombre: string; que: string; accion: string }> = {
  1: { nombre: "Estructura consolidada", que: `${UMBRALES.consolidado} o más personas organizadas (afiliados y contactos)`, accion: "Sostener y delegar: ya hay quien responda en el territorio." },
  2: { nombre: "Con base inicial", que: `Entre ${UMBRALES.base} y ${UMBRALES.consolidado - 1} personas organizadas`, accion: "Fortalecer: formar liderazgos y crecer hasta consolidar." },
  3: { nombre: "Oportunidad", que: `Casi sin estructura, pero con ${UMBRALES.poblacionOportunidad.toLocaleString("es-CO")} habitantes o más`, accion: "Priorizar: mucha gente por organizar; empezar por aquí." },
  4: { nombre: "Por construir", que: "Casi sin estructura y con poca población", accion: "Acompañar con campañas regionales y alianzas locales." },
};

export type MunicipioClasificado = { dane: string; nombre: string; departamento: string; poblacion: number; estructura: number; grupo: GrupoId; pdet: boolean; coca: boolean; victimas: number };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const depNorm = (t: string) => norm(t).replace(/^(bogota.*)$/, "bogota").replace(/^archipielago.*$/, "san andres");

export async function clasificarMunicipios(): Promise<{ conectado: boolean; municipios: MunicipioClasificado[]; estructuraTotal: number }> {
  const c = getSupabaseServerClient();
  const porNombre = new Map<string, string[]>();
  for (const [dane, r] of Object.entries(municipios)) {
    const k = norm(r.nombre);
    porNombre.set(k, [...(porNombre.get(k) ?? []), dane]);
  }
  const depDe = new Map(Object.entries(municipios).map(([dane, r]) => [dane, depNorm(r.departamento)]));
  const estructura = new Map<string, number>();
  const sumar = (dep: string, mun: string) => {
    const k = norm(mun);
    const posibles = porNombre.get(k) ?? (k === "bogota" || k.startsWith("bogota") ? ["11001"] : []);
    const d = depNorm(dep);
    const dane = posibles.length === 1 ? posibles[0] : posibles.find((x) => depDe.get(x) === d);
    if (dane) estructura.set(dane, (estructura.get(dane) ?? 0) + 1);
  };

  const pdet = new Set<string>();
  const coca = new Set<string>();
  const victimas = new Map<string, number>();
  if (c) {
    const leer = async (tabla: string, cols: string, f: (r: Record<string, unknown>) => void) => {
      for (let desde = 0; desde < 100_000; desde += 1000) {
        const { data, error } = await c.from(tabla).select(cols).range(desde, desde + 999);
        if (error) return;
        (data ?? []).forEach((r) => f(r as unknown as Record<string, unknown>));
        if ((data ?? []).length < 1000) return;
      }
    };
    await Promise.all([
      leer("miembros", "departamento, municipio", (r) => sumar(String(r.departamento ?? ""), String(r.municipio ?? ""))),
      leer("portal_contactos", "departamento, ciudad", (r) => sumar(String(r.departamento ?? ""), String(r.ciudad ?? ""))),
      leer("indicadores_territoriales", "dane, indicador, periodo, valor", (r) => {
        const dane = String(r.dane);
        const v = Number(r.valor) || 0;
        if (r.indicador === "pdet" && v > 0) pdet.add(dane);
        if (r.indicador === "coca_ha" && v > 0) coca.add(dane);
        if (r.indicador === "victimas_total" && r.periodo === "acum") victimas.set(dane, v);
      }),
    ]);
  }

  const lista = Object.entries(municipios).map(([dane, r]): MunicipioClasificado => {
    const poblacion = r.pob["2026"]?.[0] ?? r.pob["2023"]?.[0] ?? 0;
    const e = estructura.get(dane) ?? 0;
    const grupo: GrupoId = e >= UMBRALES.consolidado ? 1 : e >= UMBRALES.base ? 2 : poblacion >= UMBRALES.poblacionOportunidad ? 3 : 4;
    return { dane, nombre: r.nombre, departamento: r.departamento, poblacion, estructura: e, grupo, pdet: pdet.has(dane), coca: coca.has(dane), victimas: victimas.get(dane) ?? 0 };
  });
  return { conectado: !!c, municipios: lista.sort((a, b) => a.grupo - b.grupo || b.poblacion - a.poblacion), estructuraTotal: [...estructura.values()].reduce((s, n) => s + n, 0) };
}
