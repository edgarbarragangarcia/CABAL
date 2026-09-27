/**
 * Comparación de un candidato entre dos elecciones, territorio por territorio.
 *
 * Con resultados agregados NO se puede saber a quién votó cada persona en la
 * otra elección. Lo que sí se mide es qué cambió en cada territorio: dónde el
 * candidato creció o cayó, y qué otros partidos ganaron votos justo donde él
 * los perdió ("quién ganó donde perdió"). Es una asociación entre territorios,
 * no un flujo de electores.
 */

export type Lado = {
  /** Votos del candidato (0 si no aparece en ese territorio). */
  votos: number;
  validos: number;
  /** Partido con el que se presentó; puede cambiar entre elecciones. */
  partido?: string;
  /** Mayores partidos del territorio en esa elección: [nombre, votos]. */
  partidos: [string, number][];
};

export type FilaComparacion = {
  clave: string;
  nombre: string;
  dane?: string;
  a: Lado;
  b: Lado;
};

export type Estado = "creció" | "cayó" | "igual" | "nuevo" | "perdido";

export type FilaAnalizada = FilaComparacion & {
  delta: number;
  cuotaA: number;
  cuotaB: number;
  /** Cambio de la cuota (% de válidos), en puntos porcentuales. */
  deltaCuota: number;
  estado: Estado;
};

export type Heredero = {
  partido: string;
  /** Votos que ganó en los territorios donde el candidato perdió. */
  ganados: number;
  /** En cuántos de esos territorios el partido ganó votos. */
  territorios: number;
  /** Es el partido con el que se presentó el candidato en la segunda elección. */
  esPropio: boolean;
};

export type Transferencia = {
  votosA: number;
  votosB: number;
  delta: number;
  cuotaA: number;
  cuotaB: number;
  filas: FilaAnalizada[];
  /** Territorios donde perdió votos. */
  fugas: { territorios: number; votosPerdidos: number };
  crecimiento: { territorios: number; votosGanados: number };
  herederos: Heredero[];
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const normalizar = (s: string) => sinTildes(s).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * ¿Es la misma persona? Sin tildes ni orden, y admitiendo que una lista traiga
 * el segundo nombre y otra no ("Paloma Susana Valencia Laserna" / "Paloma
 * Valencia Laserna"): todas las palabras del nombre más corto, con al menos 3.
 */
export function mismaPersona(a: string, b: string) {
  const [x, y] = [new Set(normalizar(a).split(" ")), new Set(normalizar(b).split(" "))];
  const [corto, largo] = x.size <= y.size ? [x, y] : [y, x];
  return corto.size >= 3 && [...corto].every((t) => largo.has(t));
}

/**
 * La comparación siempre va de la elección más antigua a la más reciente ("antes" →
 * "ahora"), sin importar cuál esté abierta en pantalla: si vino al revés, se
 * intercambian los dos lados.
 */
export function alReves(filas: FilaComparacion[]): FilaComparacion[] {
  return filas.map((f) => ({ ...f, a: f.b, b: f.a }));
}

export function calcularTransferencia(datos: FilaComparacion[]): Transferencia {
  const filas: FilaAnalizada[] = datos
    .map((f) => {
      const delta = f.b.votos - f.a.votos;
      const cuotaA = f.a.validos ? (100 * f.a.votos) / f.a.validos : 0;
      const cuotaB = f.b.validos ? (100 * f.b.votos) / f.b.validos : 0;
      const estado: Estado =
        f.a.votos === 0 && f.b.votos > 0 ? "nuevo" : f.b.votos === 0 && f.a.votos > 0 ? "perdido" : delta > 0 ? "creció" : delta < 0 ? "cayó" : "igual";
      return { ...f, delta, cuotaA, cuotaB, deltaCuota: cuotaB - cuotaA, estado };
    })
    .sort((x, y) => x.delta - y.delta);

  const votosA = filas.reduce((s, f) => s + f.a.votos, 0);
  const votosB = filas.reduce((s, f) => s + f.b.votos, 0);
  const validosA = filas.reduce((s, f) => s + f.a.validos, 0);
  const validosB = filas.reduce((s, f) => s + f.b.validos, 0);

  const cayeron = filas.filter((f) => f.delta < 0);
  const crecieron = filas.filter((f) => f.delta > 0);

  // Quién ganó donde perdió: por partido, lo que subió en los territorios donde el candidato bajó.
  const ganados = new Map<string, { nombre: string; votos: number; territorios: number }>();
  for (const f of cayeron) {
    const antes = new Map(f.a.partidos.map(([n, v]) => [normalizar(n), v]));
    for (const [nombre, v] of f.b.partidos) {
      const k = normalizar(nombre);
      const g = v - (antes.get(k) ?? 0);
      if (g <= 0) continue;
      const e = ganados.get(k) ?? { nombre, votos: 0, territorios: 0 };
      e.votos += g;
      e.territorios += 1;
      ganados.set(k, e);
    }
  }
  const propio = datos.map((f) => f.b.partido).find(Boolean);
  const herederos = [...ganados.entries()]
    .map(([k, e]) => ({ partido: e.nombre, ganados: e.votos, territorios: e.territorios, esPropio: !!propio && normalizar(propio) === k }))
    .sort((x, y) => y.ganados - x.ganados)
    .slice(0, 8);

  return {
    votosA,
    votosB,
    delta: votosB - votosA,
    cuotaA: validosA ? (100 * votosA) / validosA : 0,
    cuotaB: validosB ? (100 * votosB) / validosB : 0,
    filas,
    fugas: { territorios: cayeron.length, votosPerdidos: -cayeron.reduce((s, f) => s + f.delta, 0) },
    crecimiento: { territorios: crecieron.length, votosGanados: crecieron.reduce((s, f) => s + f.delta, 0) },
    herederos,
  };
}
