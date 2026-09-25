import type { Network } from "./network";

/**
 * Posiciones para dibujar la red: cada comunidad es un racimo propio (sus
 * miembros se acomodan por fuerzas usando solo sus vínculos internos) y
 * los racimos se reparten en espiral, los más grandes al centro. Así los
 * grupos se ven separados en vez de una maraña, y el dibujo siempre cabe.
 */

/** Distancia típica entre vecinos dentro de un racimo, en unidades del layout. */
export const SPACING = 10;
/** Separación entre racimos: bastante más que entre vecinos, para que cada grupo se lea como uno. */
const GAP = 30;
const ITERATIONS = 160;
/** Racimos más grandes que esto se acomodan en espiral: las fuerzas crecen con el cuadrado. */
const MAX_FORCE_GROUP = 400;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type Layout = {
  /** Posición final de cada nodo dibujado. */
  final: Map<number, [number, number]>;
  /** Centro del racimo de cada nodo: de ahí parte la animación. */
  start: Map<number, [number, number]>;
};

/**
 * Fruchterman-Reingold dentro de un racimo. `gravity` lo mantiene compacto:
 * alta cuando hay muchos racimos juntos, baja cuando se ve una sola comunidad
 * y lo que importa es su forma interna.
 */
function relax(pos: Float64Array, n: number, springs: [number, number, number][], gravity: number) {
  const disp = new Float64Array(2 * n);
  let temperature = SPACING * Math.sqrt(n) * 0.5;
  const cooling = temperature / ITERATIONS;
  for (let it = 0; it < ITERATIONS; it++) {
    disp.fill(0);
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const dx = pos[2 * a] - pos[2 * b];
        const dy = pos[2 * a + 1] - pos[2 * b + 1];
        const d2 = Math.max(dx * dx + dy * dy, 0.01);
        const f = (SPACING * SPACING) / d2;
        disp[2 * a] += dx * f;
        disp[2 * a + 1] += dy * f;
        disp[2 * b] -= dx * f;
        disp[2 * b + 1] -= dy * f;
      }
    }
    for (const [a, b, w] of springs) {
      const dx = pos[2 * a] - pos[2 * b];
      const dy = pos[2 * a + 1] - pos[2 * b + 1];
      const f = (Math.sqrt(dx * dx + dy * dy) / SPACING) * Math.min(w, 2);
      disp[2 * a] -= dx * f;
      disp[2 * a + 1] -= dy * f;
      disp[2 * b] += dx * f;
      disp[2 * b + 1] += dy * f;
    }
    for (let a = 0; a < n; a++) {
      // Gravedad: sin ella, quien tiene pocos vínculos se aleja del racimo.
      const dx = disp[2 * a] - pos[2 * a] * gravity;
      const dy = disp[2 * a + 1] - pos[2 * a + 1] * gravity;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const step = Math.min(len, temperature);
      pos[2 * a] += (dx / len) * step;
      pos[2 * a + 1] += (dy / len) * step;
    }
    temperature = Math.max(temperature - cooling, SPACING * 0.05);
  }
}

/** Posiciones internas de un racimo, centradas en 0,0; devuelve también su radio. */
function groupLayout(network: Network, members: number[], gravity: number) {
  const n = members.length;
  const pos = new Float64Array(2 * n);
  // Espiral inicial con el más conectado al centro.
  const order = members.map((_, k) => k);
  order.sort((a, b) => network.nodes[members[b]].strength - network.nodes[members[a]].strength);
  order.forEach((k, rank) => {
    const r = SPACING * Math.sqrt(rank + 0.5);
    pos[2 * k] = r * Math.cos(rank * GOLDEN_ANGLE);
    pos[2 * k + 1] = r * Math.sin(rank * GOLDEN_ANGLE);
  });

  if (n > 1 && n <= MAX_FORCE_GROUP) {
    const index = new Map(members.map((m, k) => [m, k]));
    const springs: [number, number, number][] = [];
    members.forEach((m, k) => {
      for (const [j, e] of network.adjacency[m]) {
        const kj = index.get(j);
        if (kj !== undefined && k < kj) springs.push([k, kj, network.edges[e].weight]);
      }
    });
    relax(pos, n, springs, gravity);
  }

  let cx = 0;
  let cy = 0;
  for (let k = 0; k < n; k++) {
    cx += pos[2 * k] / n;
    cy += pos[2 * k + 1] / n;
  }
  for (let k = 0; k < n; k++) {
    pos[2 * k] -= cx;
    pos[2 * k + 1] -= cy;
  }
  if (n === 1) return { pos, radius: SPACING / 2 };

  // Escala: la distancia típica al vecino más cercano queda en SPACING, así en
  // todos los racimos los puntos ni se enciman ni quedan sueltos.
  const nearest: number[] = [];
  for (let a = 0; a < n; a++) {
    let best = Infinity;
    for (let b = 0; b < n; b++) {
      if (a !== b) best = Math.min(best, Math.hypot(pos[2 * a] - pos[2 * b], pos[2 * a + 1] - pos[2 * b + 1]));
    }
    nearest.push(best);
  }
  nearest.sort((x, y) => x - y);
  const median = nearest[n >> 1];
  const scale = median > 0 ? SPACING / median : 1;
  let sumSq = 0;
  for (let k = 0; k < 2 * n; k++) {
    pos[k] *= scale;
    sumSq += pos[k] ** 2;
  }
  // Los que quedaron muy lejos del resto se acercan al borde del racimo.
  const limit = 2 * Math.sqrt(sumSq / n);
  let radius = 0;
  for (let k = 0; k < n; k++) {
    const r = Math.hypot(pos[2 * k], pos[2 * k + 1]);
    if (r > limit) {
      pos[2 * k] *= limit / r;
      pos[2 * k + 1] *= limit / r;
    }
    radius = Math.max(radius, Math.min(r, limit));
  }
  return { pos, radius };
}

/**
 * `aspect` = ancho/alto del lienzo: la espiral de racimos se estira para
 * aprovechar un lienzo apaisado.
 */
export function layoutNetwork(network: Network, visible: number[], aspect = 1.6): Layout {
  const groups = new Map<number, number[]>();
  for (const i of visible) {
    const c = network.nodes[i].community;
    const key = c >= 0 ? c : -1 - i;
    const list = groups.get(key);
    if (list) list.push(i);
    else groups.set(key, [i]);
  }

  const final = new Map<number, [number, number]>();
  const start = new Map<number, [number, number]>();
  const placed: { x: number; y: number; r: number }[] = [];
  const stretch = Math.max(1, Math.min(aspect, 2.5));

  const gravity = groups.size === 1 ? 0.08 : 1;
  for (const members of [...groups.values()].sort((a, b) => b.length - a.length)) {
    const { pos, radius } = groupLayout(network, members, gravity);
    let x = 0;
    let y = 0;
    // Primer hueco libre en una espiral desde el centro: los grandes quedan en medio.
    for (let s = 0; placed.length > 0; s++) {
      const r = (GAP / 2) * Math.sqrt(s);
      x = r * Math.cos(s * GOLDEN_ANGLE) * stretch;
      y = r * Math.sin(s * GOLDEN_ANGLE);
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + radius + GAP)) break;
    }
    placed.push({ x, y, r: radius });
    members.forEach((m, k) => {
      final.set(m, [x + pos[2 * k], y + pos[2 * k + 1]]);
      // Un pelo de separación para que la animación no arranque con todos encimados.
      start.set(m, [x + pos[2 * k] * 0.05, y + pos[2 * k + 1] * 0.05]);
    });
  }
  return { final, start };
}
