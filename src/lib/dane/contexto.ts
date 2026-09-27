/**
 * Contexto demográfico de un territorio (DANE, proyecciones del Censo 2018) y
 * dónde le va mejor a un candidato según el tipo de municipio. Todo es
 * aritmética sobre datos oficiales.
 *
 * Ojo con la lectura: es POBLACIÓN del municipio, no de quienes votaron (el
 * voto es secreto y ninguna fuente oficial publica la edad de los votantes), y
 * una relación entre municipios no dice cómo vota cada persona (falacia
 * ecológica).
 */

export type Poblacion = {
  total: number;
  cabecera: number;
  /** Centros poblados y rural disperso. */
  resto: number;
  /** Por grupo: 0-17, 18-29, 30-44, 45-59, 60+. */
  edades: [number, number, number, number, number];
};

export type Indicadores = {
  total: number;
  /** Población de 18 años o más: la que tiene edad de votar. */
  adultos: number;
  pctRural: number;
  pctAdultos: number;
  pct18a29: number;
  pct60: number;
};

export function indicadores(p: Poblacion): Indicadores {
  const adultos = p.edades[1] + p.edades[2] + p.edades[3] + p.edades[4];
  const pc = (n: number) => (p.total ? (100 * n) / p.total : 0);
  return { total: p.total, adultos, pctRural: pc(p.resto), pctAdultos: pc(adultos), pct18a29: pc(p.edades[1]), pct60: pc(p.edades[4]) };
}

export function sumar(lista: Poblacion[]): Poblacion {
  const s: Poblacion = { total: 0, cabecera: 0, resto: 0, edades: [0, 0, 0, 0, 0] };
  for (const p of lista) {
    s.total += p.total;
    s.cabecera += p.cabecera;
    s.resto += p.resto;
    p.edades.forEach((v, i) => (s.edades[i] += v));
  }
  return s;
}

export type FilaTerritorio = { nombre: string; votos: number; poblacion: Poblacion | null };

export type Grupo = {
  etiqueta: string;
  territorios: number;
  votos: number;
  adultos: number;
  /** Votos del candidato por cada mil personas de 18 años o más. */
  votosPorMilAdultos: number;
  /** Parte de todos sus votos (%). */
  pctDeSusVotos: number;
};

export type Correlacion = {
  factor: string;
  r: number;
  fuerza: "sin relación clara" | "débil" | "moderada" | "fuerte";
  /** Lectura en palabras: "más votos por adulto donde hay más población rural". */
  lectura: string;
};

export type PerfilCandidato = {
  territorios: number;
  sinDatos: number;
  porRuralidad: Grupo[];
  porTamano: Grupo[];
  correlaciones: Correlacion[];
};

export const RURALIDAD = [
  { etiqueta: "Urbano (menos de 25 % rural)", cabe: (r: number) => r < 25 },
  { etiqueta: "Mixto (25 % a 60 % rural)", cabe: (r: number) => r >= 25 && r <= 60 },
  { etiqueta: "Rural (más de 60 % rural)", cabe: (r: number) => r > 60 },
];
export const TAMANO = [
  { etiqueta: "Menos de 20 mil habitantes", cabe: (t: number) => t < 20_000 },
  { etiqueta: "20 mil a 100 mil", cabe: (t: number) => t >= 20_000 && t <= 100_000 },
  { etiqueta: "Más de 100 mil", cabe: (t: number) => t > 100_000 },
];

export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

const fuerzaDe = (r: number): Correlacion["fuerza"] => {
  const a = Math.abs(r);
  return a < 0.2 ? "sin relación clara" : a < 0.4 ? "débil" : a < 0.6 ? "moderada" : "fuerte";
};

/** Mínimo de municipios para calcular una correlación: con menos, es ruido. */
export const MIN_CORRELACION = 8;

export function perfilCandidato(filas: FilaTerritorio[]): PerfilCandidato {
  const con = filas.filter((f): f is FilaTerritorio & { poblacion: Poblacion } => f.poblacion !== null && f.poblacion.total > 0);
  const totalVotos = con.reduce((s, f) => s + f.votos, 0);
  const datos = con.map((f) => ({ ...f, ind: indicadores(f.poblacion) }));

  const agrupar = <T extends { etiqueta: string; cabe: (n: number) => boolean }>(reglas: T[], clave: (d: (typeof datos)[number]) => number): Grupo[] =>
    reglas.map((g) => {
      const dentro = datos.filter((d) => g.cabe(clave(d)));
      const votos = dentro.reduce((s, d) => s + d.votos, 0);
      const adultos = dentro.reduce((s, d) => s + d.ind.adultos, 0);
      return {
        etiqueta: g.etiqueta,
        territorios: dentro.length,
        votos,
        adultos,
        votosPorMilAdultos: adultos ? (1000 * votos) / adultos : 0,
        pctDeSusVotos: totalVotos ? (100 * votos) / totalVotos : 0,
      };
    });

  const correlaciones: Correlacion[] = [];
  const util = datos.filter((d) => d.ind.adultos > 0);
  if (util.length >= MIN_CORRELACION) {
    const y = util.map((d) => (1000 * d.votos) / d.ind.adultos);
    const factores: [string, (d: (typeof util)[number]) => number, string, string][] = [
      ["Población rural", (d) => d.ind.pctRural, "donde hay más población rural", "donde hay menos población rural"],
      ["Jóvenes de 18 a 29 años", (d) => d.ind.pct18a29, "donde hay más jóvenes", "donde hay menos jóvenes"],
      ["Personas de 60 años o más", (d) => d.ind.pct60, "donde hay más personas mayores", "donde hay menos personas mayores"],
      ["Tamaño del municipio", (d) => Math.log10(d.ind.total), "en los municipios más grandes", "en los municipios más pequeños"],
    ];
    for (const [factor, f, mas, menos] of factores) {
      const r = pearson(util.map(f), y);
      if (r === null) continue;
      const fuerza = fuerzaDe(r);
      correlaciones.push({
        factor,
        r,
        fuerza,
        lectura: fuerza === "sin relación clara" ? "sin relación clara" : `más votos por adulto ${r > 0 ? mas : menos}`,
      });
    }
  }

  return {
    territorios: con.length,
    sinDatos: filas.length - con.length,
    porRuralidad: agrupar(RURALIDAD, (d) => d.ind.pctRural),
    porTamano: agrupar(TAMANO, (d) => d.ind.total),
    correlaciones,
  };
}
