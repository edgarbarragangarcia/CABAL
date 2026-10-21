import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Censo electoral proyectado a 2030, por municipio y por edad.
 *
 * Método (sencillo y comprobable): el censo de la Registraduría de cada municipio en 2026 se hace crecer con la población de 18 años
 * o más que proyecta el DANE (serie 2018-2042 por municipio, sexo y edad). Es decir, se mantiene la razón censo / población adulta
 * de cada municipio. Los «votantes nuevos» son quienes cumplen 18 años entre la elección de 2026 y la de 2030 (edades 18 a 21 en 2030).
 * El DANE proyecta personas residentes; el censo electoral incluye a quienes están inscritos aunque hayan migrado o fallecido, por eso se usa la razón.
 */
type Fila = number[]; // lo que devuelve proyeccion_resumen (ver supabase/proyeccion.sql)
type Municipio = { n: string; d: string; y: Record<string, Fila> };

export type FilaProyeccion = {
  dane: string; municipio: string; departamento: string;
  censo2022: number | null; censo2026: number; votantes2026: number; participacion2026: number; participacion2026Segunda: number;
  adultos2026: number; adultos2030: number; razon: number;
  electores2030: number; crecimiento: number;
  nuevos2030: number; pesoNuevos: number; nuevosEn2026: number;
  edades2030: number[]; // electores 2030 por bandas: 18-24, 25-34, 35-44, 45-54, 55-64, 65+
  edades2026: number[];
  hombres2030: number; mujeres2030: number;
  votantesEsperados2030: number;
  errorPrueba: number | null; // error de la prueba hacia atrás (proyectar el censo de 2026 desde 2022)
};

export const BANDAS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65 o más"] as const;

type Censo = { dane: string; nombre: string; censo: number; votantes: number };

async function censos(eleccion: string): Promise<Censo[]> {
  const c = getSupabaseServerClient();
  if (!c) return [];
  const { data, error } = await c.from("resultados_electorales").select("dane, ambito_nombre, censo:datos->censo, votantes:datos->votantes").eq("eleccion", eleccion).eq("corporacion", "PR").eq("nivel", 3).not("dane", "is", null).limit(2000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { dane: string; ambito_nombre: string; censo: number | string | null; votantes: number | string | null }[]).map((r) => ({ dane: r.dane, nombre: r.ambito_nombre, censo: Number(r.censo) || 0, votantes: Number(r.votantes) || 0 }));
}

/** La población del DANE guardada en Supabase (tabla proyeccion_poblacion), resumida por la función proyeccion_resumen. */
async function poblacion(): Promise<Record<string, Municipio>> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Supabase no está conectado.");
  const out: Record<string, Municipio> = {};
  for (const anio of [2022, 2026, 2030]) {
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await c.rpc("proyeccion_resumen", { p_anios: [anio] }).range(desde, desde + 999);
      if (error) throw new Error(error.message.includes("proyeccion_") ? "Falta crear la tabla de población: corre supabase/proyeccion.sql en el SQL Editor de Supabase." : error.message);
      const filas = (data ?? []) as { dane: string; anio: number; municipio: string; departamento: string; resumen: number[] }[];
      for (const f of filas) (out[f.dane] ??= { n: f.municipio, d: f.departamento, y: {} }).y[String(f.anio)] = f.resumen;
      if (filas.length < 1000) break;
    }
  }
  return out;
}

export class SinDatosDane extends Error {}

export async function proyectar() {
  const DANE = await poblacion();
  if (!Object.keys(DANE).length) throw new SinDatosDane("La población del DANE todavía no está cargada en Supabase.");
  const [c26, c26b, c22] = await Promise.all([censos("presidencia-2026-1v"), censos("presidencia-2026-2v"), censos("presidencia-2022-1v")]);
  if (!c26.length) throw new Error("Todavía no están cargados los resultados de 2026 en Supabase (hacen falta para el censo electoral).");
  const seg = new Map(c26b.map((x) => [x.dane, x.votantes]));
  const prev = new Map(c22.map((x) => [x.dane, x.censo]));
  const filas: FilaProyeccion[] = [];
  for (const r of c26) {
    const m = DANE[r.dane];
    const a = m?.y["2026"], b = m?.y["2030"], p22 = m?.y["2022"];
    if (!m || !a || !b || !r.censo || !a[3]) continue;
    const razon = r.censo / a[3];
    const esc = (v: number) => Math.round(v * razon);
    const nuevos = b[10] + b[11] + b[12] + b[13];
    const electores2030 = esc(b[3]);
    const censo22 = prev.get(r.dane) ?? null;
    const pred26 = censo22 && p22?.[3] ? censo22 * (a[3] / p22[3]) : null;
    filas.push({
      dane: r.dane, municipio: m.n, departamento: m.d,
      censo2022: censo22, censo2026: r.censo, votantes2026: r.votantes, participacion2026: r.votantes / r.censo, participacion2026Segunda: (seg.get(r.dane) ?? 0) / r.censo,
      adultos2026: a[3], adultos2030: b[3], razon,
      electores2030, crecimiento: electores2030 / r.censo - 1,
      nuevos2030: esc(nuevos), pesoNuevos: electores2030 ? esc(nuevos) / electores2030 : 0, nuevosEn2026: esc(a[10] + a[11] + a[12] + a[13]),
      edades2030: b.slice(14, 20).map(esc), edades2026: a.slice(14, 20).map(esc),
      hombres2030: esc(b[4]), mujeres2030: esc(b[5]),
      votantesEsperados2030: Math.round(electores2030 * (r.votantes / r.censo)),
      errorPrueba: pred26 ? (pred26 - r.censo) / r.censo : null,
    });
  }
  // Lo que no tiene municipio (consulados, voto en el exterior) se mantiene igual: no hay proyección del DANE para ello.
  const sinMunicipio = c26.filter((r) => !DANE[r.dane]).reduce((s, r) => s + r.censo, 0);
  const suma = (f: (x: FilaProyeccion) => number) => filas.reduce((s, x) => s + f(x), 0);
  const errores = filas.map((f) => f.errorPrueba).filter((e): e is number => e !== null).map(Math.abs).sort((x, y) => x - y);
  const t22 = filas.reduce((s, f) => s + (f.censo2022 ?? 0), 0);
  const pred26Nac = filas.reduce((s, f) => s + (f.censo2022 && f.errorPrueba !== null ? f.censo2026 * (1 + f.errorPrueba) : 0), 0);
  const real26ConPrueba = filas.reduce((s, f) => s + (f.censo2022 && f.errorPrueba !== null ? f.censo2026 : 0), 0);
  return {
    nacional: {
      censo2022: t22, censo2026: suma((f) => f.censo2026) + sinMunicipio, exterior: sinMunicipio,
      electores2030: suma((f) => f.electores2030) + sinMunicipio, nuevos2030: suma((f) => f.nuevos2030), nuevosEn2026: suma((f) => f.nuevosEn2026),
      edades2030: BANDAS.map((_, i) => suma((f) => f.edades2030[i])), edades2026: BANDAS.map((_, i) => suma((f) => f.edades2026[i])),
      hombres2030: suma((f) => f.hombres2030), mujeres2030: suma((f) => f.mujeres2030),
      votantes2026: suma((f) => f.votantes2026), votantesEsperados2030: suma((f) => f.votantesEsperados2030),
    },
    prueba: { errorNacional: real26ConPrueba ? (pred26Nac - real26ConPrueba) / real26ConPrueba : null, errorMediano: errores.length ? errores[Math.floor(errores.length / 2)] : null, errorP90: errores.length ? errores[Math.floor(errores.length * 0.9)] : null, municipios: errores.length },
    municipios: filas,
    bandas: BANDAS,
  };
}
