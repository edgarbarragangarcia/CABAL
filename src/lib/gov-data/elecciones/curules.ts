/**
 * Cifra repartidora (D'Hondt) sobre las curules OFICIALES del preconteo: no
 * se vuelve a simular el reparto, se parte de cuántas curules ganó cada lista
 * y se calcula qué tan cerca estuvo de ganar o perder una.
 *
 * - Cifra repartidora: el cociente más bajo que ganó una curul,
 *   min(votos / curules) entre las listas con curul.
 * - Para una curul más, una lista necesita un cociente mayor a esa cifra:
 *   votos > cifra × (curules + 1).
 * - Margen de seguridad de la lista que tiene la última curul: cuántos votos
 *   podía perder antes de cedérsela a la primera lista sin curul, cuyo cociente
 *   es max(votos / (curules + 1)).
 * - Umbral (art. 263 de la Constitución): 3 % de los votos válidos en el Senado
 *   nacional; 50 % del cociente electoral (votos válidos / curules) en Cámara,
 *   asambleas, concejos y JAL. Los votos en blanco cuentan como válidos.
 *
 * Si las curules oficiales no se explican con la cifra repartidora (curules
 * especiales, listas sin umbral), `consistente` es false y las cifras deben
 * leerse con cautela.
 */

export type ListaDatos = { codigo: string; nombre: string; votos: number; curules: number };

export type ListaCurules = ListaDatos & {
  /** Alcanzó el umbral y participó en el reparto. */
  supera: boolean;
  /** Votos que le faltaron para el umbral (0 si lo superó). */
  faltaUmbral: number;
  /** Votos que le faltan para ganar una curul más; null si no participa en el reparto. */
  faltaCurul: number | null;
  /** Votos que podía perder sin perder una curul; solo en las listas que tienen la última. */
  margen: number | null;
  /** Tiene la última curul repartida. */
  ultima: boolean;
};

export type AnalisisCurules = {
  curules: number;
  validos: number;
  umbral: { votos: number; regla: string } | null;
  /** Cociente más bajo que ganó una curul. */
  cifraRepartidora: number;
  /** Mayor cociente de una lista que se quedó sin la curul siguiente. */
  cocienteSiguiente: number;
  consistente: boolean;
  listas: ListaCurules[];
};

export type Regla = { tipo: "senado" | "cociente" | "ninguno" };

/** Regla de umbral según corporación y circunscripción (códigos de la Registraduría). */
export function reglaUmbral(sigla: string, circunscripcion: string): Regla["tipo"] {
  if (sigla === "SE" && circunscripcion === "0") return "senado";
  if (["CA", "AS", "CO", "JA"].includes(sigla) && !["4", "5", "9"].includes(circunscripcion)) return "cociente";
  return "ninguno";
}

export function analizarCurules(
  listas: ListaDatos[],
  { validos, curules, regla }: { validos: number; curules: number; regla: Regla["tipo"] }
): AnalisisCurules | null {
  if (curules <= 0 || validos <= 0) return null;
  const umbral =
    regla === "senado"
      ? { votos: 0.03 * validos, regla: "3 % de los votos válidos" }
      : regla === "cociente"
        ? { votos: (0.5 * validos) / curules, regla: "50 % del cociente electoral (votos válidos ÷ curules)" }
        : null;

  const supera = (l: ListaDatos) => !umbral || l.votos >= umbral.votos;
  const conCurul = listas.filter((l) => l.curules > 0);
  const cifraRepartidora = conCurul.length ? Math.min(...conCurul.map((l) => l.votos / l.curules)) : 0;
  const participantes = listas.filter(supera);
  const cocienteSiguiente = participantes.length ? Math.max(...participantes.map((l) => l.votos / (l.curules + 1))) : 0;

  const sumaOficial = listas.reduce((s, l) => s + l.curules, 0);
  const consistente =
    conCurul.length > 0 &&
    sumaOficial === curules &&
    conCurul.every(supera) &&
    cifraRepartidora >= cocienteSiguiente - 1e-9;

  return {
    curules,
    validos,
    umbral,
    cifraRepartidora,
    cocienteSiguiente,
    consistente,
    listas: listas
      .map((l) => {
        const ok = supera(l);
        const ultima = l.curules > 0 && Math.abs(l.votos / l.curules - cifraRepartidora) < 1e-9;
        return {
          ...l,
          supera: ok,
          faltaUmbral: ok || !umbral ? 0 : Math.ceil(umbral.votos - l.votos),
          faltaCurul: ok ? Math.max(1, Math.floor(cifraRepartidora * (l.curules + 1)) + 1 - l.votos) : null,
          margen: ultima ? Math.max(0, Math.ceil(l.votos - cocienteSiguiente * l.curules)) : null,
          ultima,
        };
      })
      .sort((a, b) => b.votos - a.votos),
  };
}
