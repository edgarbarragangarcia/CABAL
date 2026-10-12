import "server-only";

import { nombreMunicipio } from "@/lib/dane/poblacion";
import { querySocrataDataset } from "@/lib/gov-data/socrata";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { INDICADORES } from "./catalogo";

/**
 * Trae de datos.gov.co las cifras de conflicto y problemas por municipio y las guarda en Supabase (tabla `indicadores_territoriales`,
 * supabase/territorio.sql). La pantalla Territorio lee de ahí y nunca consulta al portal. Cada fuente se agrega en el propio portal
 * (SoQL) para que cada consulta devuelva unos miles de filas, no millones.
 */

export type FilaIndicador = { dane: string; indicador: string; periodo: string; valor: number; detalle?: string; fuente: string; corte?: string };
export type ResultadoCarga = { filas: number; porIndicador: Record<string, number>; omitidos: number; corte: string };

const OPCIONES = { revalidate: 0, timeoutMs: 50_000 } as const;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Código DANE de municipio de cinco dígitos (a los que vienen como número les falta el cero de la izquierda). */
const dane5 = (v: unknown) => String(v ?? "").trim().replace(/\.0+$/, "").padStart(5, "0");

/** Fecha de un corte del Registro de Víctimas: vienen como «2024/08/31», «31/08/2026» o «31/07/2024 00:00». */
function fechaDeCorte(s: string): Date | null {
  const t = s.trim();
  const a = t.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (a) return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3]));
  const b = t.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (b) return new Date(Date.UTC(b[3].length === 2 ? 2000 + +b[3] : +b[3], +b[2] - 1, +b[1]));
  return null;
}

/**
 * Los datasets de víctimas guardan UNA FOTO POR MES, una encima de otra (cerca de 30 cortes): sumar sin filtrar multiplicaría las
 * cifras por 25. Aquí se busca el corte más reciente para filtrar por él.
 */
async function ultimoCorte(dataset: string): Promise<{ texto: string; fecha: string }> {
  const cortes = await querySocrataDataset<{ fecha_corte: string }>(dataset, { $select: "fecha_corte", $group: "fecha_corte", $limit: 500 }, OPCIONES);
  const validos = cortes.map((c) => ({ texto: c.fecha_corte, fecha: fechaDeCorte(c.fecha_corte) })).filter((c): c is { texto: string; fecha: Date } => c.fecha !== null);
  if (validos.length === 0) throw new Error("No se pudo saber cuál es el corte más reciente de las víctimas.");
  const ultimo = validos.reduce((a, b) => (b.fecha > a.fecha ? b : a));
  return { texto: ultimo.texto, fecha: ultimo.fecha.toISOString().slice(0, 10) };
}

/** A qué indicador pertenece un hecho victimizante; los textos traen letras dañadas (Desaparición, Vinculación...) según la carga. */
export function claveDeHecho(hecho: string): string | null {
  const t = hecho.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?").toLowerCase().trim();
  if (t.startsWith("desplazamiento")) return "victimas_desplazamiento";
  if (t.startsWith("homicidio")) return "victimas_homicidio";
  if (t.startsWith("amenaza")) return "victimas_amenaza";
  if (t.startsWith("confinamiento")) return "victimas_confinamiento";
  if (/^desaparici.{1,4}n forzada/.test(t)) return "victimas_desaparicion";
  if (t.startsWith("secuestro")) return "victimas_secuestro";
  if (t.startsWith("minas")) return "victimas_minas";
  if (t.startsWith("vinculaci")) return "victimas_reclutamiento";
  if (t.startsWith("abandono")) return "victimas_despojo";
  if (t.startsWith("delitos contra la libertad")) return "victimas_sexual";
  if (t.startsWith("acto terrorista")) return "victimas_acto_terrorista";
  return null;
}

async function victimas(): Promise<{ filas: FilaIndicador[]; corte: string }> {
  const FUENTE = INDICADORES.victimas_total.fuente;
  const [{ texto, fecha }, { texto: textoHechos }] = await Promise.all([ultimoCorte("ykxr-xynr"), ultimoCorte("9qih-4vkc")]);
  const [total, hechos] = await Promise.all([
    querySocrataDataset<{ cod_ciudad_muni: string; v: string }>("ykxr-xynr", { $select: "cod_ciudad_muni, sum(per_ocu) as v", $where: `fecha_corte='${texto}'`, $group: "cod_ciudad_muni", $limit: 5000 }, OPCIONES),
    querySocrataDataset<{ cod_ciudad_muni: string; hecho: string; v: string }>("9qih-4vkc", { $select: "cod_ciudad_muni, hecho, sum(per_ocu) as v", $where: `fecha_corte='${textoHechos}'`, $group: "cod_ciudad_muni, hecho", $limit: 50_000 }, OPCIONES),
  ]);
  const filas: FilaIndicador[] = total.map((r) => ({ dane: dane5(r.cod_ciudad_muni), indicador: "victimas_total", periodo: "acum", valor: num(r.v), fuente: FUENTE, corte: fecha }));
  // Un mismo hecho llega con varias grafías (por la carga de caracteres): se suman en un solo indicador.
  const sumas = new Map<string, FilaIndicador>();
  for (const r of hechos) {
    const clave = claveDeHecho(r.hecho);
    if (!clave) continue;
    const dane = dane5(r.cod_ciudad_muni);
    const k = `${dane}|${clave}`;
    const f = sumas.get(k) ?? { dane, indicador: clave, periodo: "acum", valor: 0, fuente: FUENTE, corte: fecha };
    f.valor += num(r.v);
    sumas.set(k, f);
  }
  return { filas: [...filas, ...sumas.values()], corte: fecha };
}

type PorAnio = { cod: string; anio: string; v: string; w?: string };

/** Suma por municipio de una serie anual en dos ventanas de cinco años completos: la más reciente y la anterior. */
function ventanas(filas: PorAnio[], indicador: string, fuente: string, hoy = new Date()): FilaIndicador[] {
  const Y = hoy.getUTCFullYear();
  const reciente = [Y - 5, Y - 1] as const;
  const anterior = [Y - 10, Y - 6] as const;
  const acum = new Map<string, FilaIndicador>();
  for (const r of filas) {
    const anio = Number(r.anio);
    const ventana = anio >= reciente[0] && anio <= reciente[1] ? reciente : anio >= anterior[0] && anio <= anterior[1] ? anterior : null;
    if (!ventana) continue;
    const dane = dane5(r.cod);
    const periodo = `${ventana[0]}-${ventana[1]}`;
    const k = `${dane}|${periodo}`;
    const f = acum.get(k) ?? { dane, indicador, periodo, valor: 0, fuente, corte: String(Y - 1) };
    f.valor += num(r.v);
    acum.set(k, f);
  }
  return [...acum.values()];
}

const seriePorAnio = (dataset: string, valor: string, extra = "") =>
  querySocrataDataset<PorAnio>(
    dataset,
    {
      $select: `cod_muni as cod, date_extract_y(fecha_hecho) as anio, sum(${valor}) as v${extra}`,
      $where: `fecha_hecho >= '${new Date().getUTCFullYear() - 10}-01-01T00:00:00'`,
      $group: "cod_muni, date_extract_y(fecha_hecho)",
      $limit: 50_000,
    },
    OPCIONES
  );

async function seguridad(): Promise<{ filas: FilaIndicador[]; corte: string }> {
  const FUENTE = INDICADORES.homicidios.fuente;
  const [homicidios, secuestros, extorsiones, masacres] = await Promise.all([
    seriePorAnio("m8fd-ahd9", "cantidad"),
    seriePorAnio("d7zw-hpf4", "cantidad"),
    seriePorAnio("q2ib-t9am", "cantidad"),
    querySocrataDataset<{ cod: string; casos: string; victimas: string; desde: string }>(
      "u8eq-92tb",
      { $select: "cod_muni as cod, sum(casos) as casos, sum(victimas) as victimas, min(date_extract_y(fecha_hecho)) as desde", $group: "cod_muni", $limit: 5000 },
      OPCIONES
    ),
  ]);
  const corte = String(new Date().getUTCFullYear() - 1);
  const filas = [
    ...ventanas(homicidios, "homicidios", FUENTE),
    ...ventanas(secuestros, "secuestros", FUENTE),
    ...ventanas(extorsiones, "extorsiones", FUENTE),
    ...masacres.flatMap((r): FilaIndicador[] => [
      { dane: dane5(r.cod), indicador: "masacres_casos", periodo: "acum", valor: num(r.casos), detalle: `desde ${r.desde}`, fuente: FUENTE, corte },
      { dane: dane5(r.cod), indicador: "masacres_victimas", periodo: "acum", valor: num(r.victimas), detalle: `desde ${r.desde}`, fuente: FUENTE, corte },
    ]),
  ];
  return { filas, corte };
}

async function minas(): Promise<{ filas: FilaIndicador[]; corte: string }> {
  const r = await querySocrataDataset<{ cod: string; v: string; desde: string; hasta: string }>(
    "sgp4-3e6k",
    { $select: "codigo_dane_municipio as cod, count(*) as v, min(a_o) as desde, max(a_o) as hasta", $group: "codigo_dane_municipio", $limit: 5000 },
    OPCIONES
  );
  const hasta = r.reduce((m, x) => Math.max(m, num(x.hasta)), 0);
  return {
    filas: r.map((x) => ({ dane: dane5(x.cod), indicador: "minas_eventos", periodo: "acum", valor: num(x.v), detalle: `${x.desde}–${x.hasta}`, fuente: INDICADORES.minas_eventos.fuente, corte: String(hasta || "") })),
    corte: String(hasta || ""),
  };
}

async function coca(): Promise<{ filas: FilaIndicador[]; corte: string }> {
  const r = await querySocrataDataset<Record<string, string>>("acs4-3wgp", { $limit: 2000 }, OPCIONES);
  const anios = [...new Set(r.flatMap((f) => Object.keys(f).flatMap((k) => (/^_(\d{4})$/.test(k) && f[k] !== undefined && f[k] !== "" ? [Number(k.slice(1))] : []))))].sort((a, b) => b - a);
  if (anios.length === 0) throw new Error("El dataset de coca no trae años.");
  const ultimo = anios[0];
  const previo = ultimo - 5;
  const filas: FilaIndicador[] = [];
  for (const f of r) {
    for (const anio of [ultimo, previo]) {
      const v = f[`_${anio}`];
      if (v === undefined || v === "") continue;
      filas.push({ dane: dane5(f.codmpio), indicador: "coca_ha", periodo: String(anio), valor: num(v), fuente: INDICADORES.coca_ha.fuente, corte: String(ultimo) });
    }
  }
  return { filas, corte: String(ultimo) };
}

async function pdet(): Promise<{ filas: FilaIndicador[]; corte: string }> {
  const r = await querySocrataDataset<{ cod_muni: string; nom_subreg: string }>("idrk-ba8y", { $limit: 500 }, OPCIONES);
  return { filas: r.map((x) => ({ dane: dane5(x.cod_muni), indicador: "pdet", periodo: "acum", valor: 1, detalle: x.nom_subreg, fuente: INDICADORES.pdet.fuente, corte: "PDET 2017" })), corte: "PDET 2017" };
}

const CARGADORES: Record<string, () => Promise<{ filas: FilaIndicador[]; corte: string }>> = { victimas, seguridad, minas, coca, pdet };

/** Trae una fuente de datos.gov.co sin guardarla: las filas por municipio (solo de municipios que existen) y el corte. */
export async function traerFuente(fuente: string): Promise<{ filas: FilaIndicador[]; omitidos: number; corte: string }> {
  const cargador = CARGADORES[fuente];
  if (!cargador) throw new Error("Fuente no válida.");
  const { filas, corte } = await cargador();
  // Solo municipios que existen (no «sin información», no países, no errores de digitación del portal).
  const validas = filas.filter((f) => !!nombreMunicipio(f.dane));
  return { filas: validas, omitidos: filas.length - validas.length, corte };
}

/** Trae una fuente y la guarda en Supabase (reemplazando lo que hubiera de esos indicadores y periodos). */
export async function cargarFuente(fuente: string): Promise<ResultadoCarga> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const { filas: validas, omitidos, corte } = await traerFuente(fuente);
  const porIndicador: Record<string, number> = {};
  for (const f of validas) porIndicador[f.indicador] = (porIndicador[f.indicador] ?? 0) + 1;
  const ahora = new Date().toISOString();
  for (let i = 0; i < validas.length; i += 1000) {
    const { error } = await c.from("indicadores_territoriales").upsert(
      validas.slice(i, i + 1000).map((f) => ({ ...f, detalle: f.detalle ?? null, corte: f.corte ?? null, actualizado_en: ahora })),
      { onConflict: "dane,indicador,periodo" }
    );
    if (error) {
      throw new Error(/schema cache|does not exist|42P01|PGRST205/i.test(`${error.code} ${error.message}`) ? "Faltan las tablas de territorio: ejecuta supabase/territorio.sql en Supabase." : error.message);
    }
  }
  return { filas: validas.length, porIndicador, omitidos, corte };
}
