import type { CrmSnapshot, Dimension } from "./types";

/**
 * Red de relaciones entre contactos del CRM. Se calcula en el navegador
 * con los campos que trae /api/admin/red-crm, para que cambiar qué
 * relaciones se usan no requiera volver a consultar Bitrix24.
 *
 * - Parecido (lugar, intereses, actividades): cada valor compartido pesa
 *   según lo raro que es (IDF): compartir un barrio o un taller pesa mucho
 *   más que compartir la ciudad. Cada contacto se une a sus 5 más parecidos.
 * - Referidos: vínculo directo de quien trajo a quien.
 * - Comunidades: método de Louvain (grupos más unidos entre sí que con el resto).
 * - Relaciones probables: Adamic-Adar — dos personas sin vínculo directo que
 *   tienen varios contactos en común, sobre todo si esos contactos no están
 *   conectados con todo el mundo.
 */

/** Campo → relación elegida a mano (`null` = no usar). Lo que no está aquí usa la detección automática. */
export type Mapping = Record<string, Dimension | null>;

export type Trait = { dim: Dimension; field: string; value: string };

export type NetNode = {
  id: string;
  name: string;
  /** Referente que no está entre los contactos (texto libre o usuario de Bitrix24). */
  external: boolean;
  traits: Trait[];
  referredBy: number[];
  referred: number[];
  /** Índice en `communities`; -1 si el contacto no quedó relacionado con nadie. */
  community: number;
  degree: number;
  strength: number;
  /** Qué tan repartidas están sus conexiones entre comunidades (0 = todas en la suya). */
  bridge: number;
};

export type NetEdge = {
  a: number;
  b: number;
  weight: number;
  similarity: number;
  /** `a` trajo a `b`. */
  referral: boolean;
  /** Valores en común, los más raros primero. */
  shared: Trait[];
};

export type Community = {
  members: number[];
  hub: number;
  traits: Trait[];
  /** Referente que trajo a buena parte del grupo. */
  referrer: number | null;
};

export type Prediction = { a: number; b: number; score: number; via: number[]; shared: Trait[] };

type Token = { dim: Dimension; field: string; value: string; df: number; idf: number };

export type Network = {
  nodes: NetNode[];
  edges: NetEdge[];
  /** Vecino → índice de la arista, por nodo. */
  adjacency: Map<number, number>[];
  /** Ordenadas de mayor a menor. */
  communities: Community[];
  predictions: Prediction[];
  tokens: Token[];
  nodeTokens: number[][];
};

const SHARED_DIMS = new Set<Dimension>(["lugar", "intereses", "actividades"]);
const K_NEAREST = 5;
const MIN_SIMILARITY = 0.08;
/** Hasta este tamaño se comparan todos los pares que comparten un valor; más arriba, una muestra. */
const FULL_PAIRS_MAX_DF = 40;
const SAMPLED_NEIGHBORS = 5;
const REFERRAL_WEIGHT = 1;
/** Contactos con más vínculos que esto no cuentan como "contacto en común" al predecir. */
const PREDICTION_MAX_HUB_DEGREE = 80;

export function normalizeText(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Números al azar pero repetibles: la misma data da siempre la misma red. */
export function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function dimensionOf(field: { key: string; auto: Dimension | null }, mapping: Mapping) {
  return field.key in mapping ? mapping[field.key] : field.auto;
}

export function buildNetwork(snapshot: CrmSnapshot, mapping: Mapping, enabled: ReadonlySet<Dimension>): Network {
  const { fields, contacts } = snapshot;
  const dims = fields.map((f) => {
    const dim = dimensionOf(f, mapping);
    return dim && enabled.has(dim) ? dim : null;
  });

  const nodes: NetNode[] = contacts.map((c) => ({
    id: c.id,
    name: c.name,
    external: false,
    traits: [],
    referredBy: [],
    referred: [],
    community: -1,
    degree: 0,
    strength: 0,
    bridge: 0,
  }));
  const byId = new Map(nodes.map((n, i) => [n.id, i]));
  const byName = new Map<string, number[]>();
  nodes.forEach((n, i) => {
    const key = normalizeText(n.name);
    byName.set(key, [...(byName.get(key) ?? []), i]);
  });

  // 1. Valores compartibles (tokens) y referidos.
  const tokens: Token[] = [];
  const tokenIds = new Map<string, number>();
  const nodeTokens: number[][] = nodes.map(() => []);
  const referrals: [number, number][] = [];
  const externals = new Map<string, number>();

  contacts.forEach((c, i) => {
    for (const [fi, valueIdxs] of c.v) {
      const dim = dims[fi];
      if (!dim) continue;
      const field = fields[fi];
      for (const vi of valueIdxs) {
        const value = field.values[vi];
        nodes[i].traits.push({ dim, field: field.label, value });

        if (SHARED_DIMS.has(dim)) {
          const key = `${dim}|${normalizeText(value)}`;
          let t = tokenIds.get(key);
          if (t === undefined) {
            t = tokens.length;
            tokens.push({ dim, field: field.label, value, df: 0, idf: 0 });
            tokenIds.set(key, t);
          }
          if (!nodeTokens[i].includes(t)) {
            nodeTokens[i].push(t);
            tokens[t].df++;
          }
          continue;
        }

        // Referidos: el valor apunta a otro contacto (enlace del CRM o nombre igual);
        // si no está entre los contactos, queda como referente externo.
        const ref = field.contactRefs?.[vi];
        const sameName = byName.get(normalizeText(value));
        let r = ref != null && byId.has(ref) ? byId.get(ref)! : sameName?.length === 1 ? sameName[0] : -1;
        if (r === -1) {
          const key = normalizeText(value);
          r = externals.get(key) ?? -1;
          if (r === -1) {
            r = nodes.length;
            nodes.push({
              id: `ext:${key}`,
              name: value,
              external: true,
              traits: [],
              referredBy: [],
              referred: [],
              community: -1,
              degree: 0,
              strength: 0,
              bridge: 0,
            });
            nodeTokens.push([]);
            externals.set(key, r);
          }
        }
        if (r !== i && !nodes[r].referred.includes(i)) {
          referrals.push([r, i]);
          nodes[r].referred.push(i);
          nodes[i].referredBy.push(r);
        }
      }
    }
  });

  // 2. Peso de cada valor: los que casi nadie comparte pesan más; los que tiene
  // más de la mitad (p. ej. el país) no distinguen a nadie y se descartan.
  const withTokens = nodeTokens.filter((t) => t.length > 0).length;
  const maxDf = Math.max(2, Math.floor(withTokens / 2));
  for (const t of tokens) t.idf = t.df >= 2 && t.df <= maxDf ? Math.log(withTokens / t.df) : 0;

  const vectors = nodeTokens.map((ts) => ts.filter((t) => tokens[t].idf > 0).sort((x, y) => x - y));
  const norms = vectors.map((ts) => Math.sqrt(ts.reduce((s, t) => s + tokens[t].idf ** 2, 0)));
  const postings: number[][] = tokens.map(() => []);
  vectors.forEach((ts, i) => ts.forEach((t) => postings[t].push(i)));

  const shared = (i: number, j: number) => {
    const out: number[] = [];
    const [x, y] = [vectors[i], vectors[j]];
    for (let p = 0, q = 0; p < x.length && q < y.length; ) {
      if (x[p] === y[q]) {
        out.push(x[p]);
        p++;
        q++;
      } else if (x[p] < y[q]) p++;
      else q++;
    }
    return out;
  };
  const similarity = (i: number, j: number) => {
    const dot = shared(i, j).reduce((s, t) => s + tokens[t].idf ** 2, 0);
    return dot / (norms[i] * norms[j]);
  };
  const toTraits = (ts: number[]) =>
    [...ts]
      .sort((x, y) => tokens[y].idf - tokens[x].idf)
      .slice(0, 3)
      .map((t) => ({ dim: tokens[t].dim, field: tokens[t].field, value: tokens[t].value }));

  // 3. Candidatos: pares que comparten algún valor (una muestra en los valores muy comunes).
  const M = nodes.length;
  const random = seededRandom(20260924);
  const candidates = new Set<number>();
  const addPair = (i: number, j: number) => {
    if (i !== j) candidates.add(i < j ? i * M + j : j * M + i);
  };
  for (const members of postings) {
    if (members.length < 2) continue;
    if (members.length <= FULL_PAIRS_MAX_DF) {
      for (let p = 0; p < members.length; p++)
        for (let q = p + 1; q < members.length; q++) addPair(members[p], members[q]);
    } else {
      const order = shuffle([...members], random);
      for (let p = 0; p < order.length; p++)
        for (let s = 1; s <= SAMPLED_NEIGHBORS; s++) addPair(order[p], order[(p + s) % order.length]);
    }
  }

  // 4. Cada contacto se queda con sus K más parecidos.
  const nearest: { j: number; s: number }[][] = nodes.map(() => []);
  const keep = (list: { j: number; s: number }[], j: number, s: number) => {
    if (list.length < K_NEAREST) list.push({ j, s });
    else if (s > list[list.length - 1].s) list[list.length - 1] = { j, s };
    else return;
    list.sort((x, y) => y.s - x.s);
  };
  for (const key of candidates) {
    const i = Math.floor(key / M);
    const j = key % M;
    const s = similarity(i, j);
    if (s < MIN_SIMILARITY) continue;
    keep(nearest[i], j, s);
    keep(nearest[j], i, s);
  }

  const edges: NetEdge[] = [];
  const edgeIndex = new Map<number, number>();
  const pairKey = (i: number, j: number) => (i < j ? i * M + j : j * M + i);
  nearest.forEach((list, i) => {
    for (const { j, s } of list) {
      const key = pairKey(i, j);
      if (edgeIndex.has(key)) continue;
      edgeIndex.set(key, edges.length);
      edges.push({ a: i, b: j, weight: s, similarity: s, referral: false, shared: toTraits(shared(i, j)) });
    }
  });
  for (const [r, i] of referrals) {
    const key = pairKey(r, i);
    const existing = edgeIndex.get(key);
    if (existing === undefined) {
      edgeIndex.set(key, edges.length);
      edges.push({ a: r, b: i, weight: REFERRAL_WEIGHT, similarity: 0, referral: true, shared: [] });
    } else {
      const e = edges[existing];
      e.a = r;
      e.b = i;
      e.referral = true;
      e.weight += REFERRAL_WEIGHT;
    }
  }

  const adjacency = nodes.map(() => new Map<number, number>());
  edges.forEach((e, k) => {
    adjacency[e.a].set(e.b, k);
    adjacency[e.b].set(e.a, k);
    for (const n of [nodes[e.a], nodes[e.b]]) {
      n.degree++;
      n.strength += e.weight;
    }
  });

  // 5. Comunidades, ordenadas de la más grande a la más pequeña.
  const membership = louvain(M, edges, random);
  const groups = new Map<number, number[]>();
  nodes.forEach((n, i) => {
    if (n.degree > 0) groups.set(membership[i], [...(groups.get(membership[i]) ?? []), i]);
  });
  const communities: Community[] = [...groups.values()]
    .sort((x, y) => y.length - x.length)
    .map((members) => {
      const hub = members.reduce((best, m) => (nodes[m].strength > nodes[best].strength ? m : best), members[0]);
      return { members, hub, traits: communityTraits(members), referrer: communityReferrer(members) };
    });
  communities.forEach((c, ci) => c.members.forEach((m) => (nodes[m].community = ci)));

  function communityTraits(members: number[]): Trait[] {
    const counts = new Map<number, number>();
    for (const m of members) for (const t of nodeTokens[m]) counts.set(t, (counts.get(t) ?? 0) + 1);
    const ranked = [...counts]
      .map(([t, count]) => {
        const pIn = count / members.length;
        const pAll = tokens[t].df / Math.max(withTokens, 1);
        const ok = count >= 2 && tokens[t].df >= 2 && pIn >= 0.25 && pIn > pAll;
        return { t, score: ok ? pIn * Math.log(pIn / pAll) : 0 };
      })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .map(({ t }) => t);
    // Primero el mejor rasgo de cada relación (barrio, interés, actividad): así no
    // se gastan los tres en "barrio, ciudad, departamento", que dicen lo mismo.
    const chosen: number[] = [];
    for (const t of ranked) if (chosen.length < 3 && !chosen.some((c) => tokens[c].dim === tokens[t].dim)) chosen.push(t);
    for (const t of ranked) if (chosen.length < 3 && !chosen.includes(t)) chosen.push(t);
    return chosen.map((t) => ({ dim: tokens[t].dim, field: tokens[t].field, value: tokens[t].value }));
  }

  function communityReferrer(members: number[]): number | null {
    const counts = new Map<number, number>();
    for (const m of members) for (const r of nodes[m].referredBy) counts.set(r, (counts.get(r) ?? 0) + 1);
    const [top] = [...counts].sort((x, y) => y[1] - x[1]);
    return top && top[1] >= Math.max(2, members.length * 0.25) ? top[0] : null;
  }

  // 6. Puentes: vínculos repartidos entre varias comunidades.
  nodes.forEach((n, i) => {
    if (n.degree < 2) return;
    const byCommunity = new Map<number, number>();
    for (const [j, k] of adjacency[i]) {
      const c = nodes[j].community;
      byCommunity.set(c, (byCommunity.get(c) ?? 0) + edges[k].weight);
    }
    n.bridge = 1 - [...byCommunity.values()].reduce((s, w) => s + (w / n.strength) ** 2, 0);
  });

  const network: Network = { nodes, edges, adjacency, communities, predictions: [], tokens, nodeTokens };
  network.predictions = predictGlobal(network, toTraits, shared);
  return network;
}

function predictGlobal(
  network: Network,
  toTraits: (ts: number[]) => Trait[],
  shared: (i: number, j: number) => number[]
): Prediction[] {
  const { nodes, adjacency } = network;
  const M = nodes.length;
  const scores = new Map<number, { score: number; common: number }>();
  nodes.forEach((n, w) => {
    if (n.degree < 2 || n.degree > PREDICTION_MAX_HUB_DEGREE) return;
    const neighbors = [...adjacency[w].keys()];
    const inc = 1 / Math.log(neighbors.length);
    for (let p = 0; p < neighbors.length; p++)
      for (let q = p + 1; q < neighbors.length; q++) {
        const [x, y] = [neighbors[p], neighbors[q]];
        if (adjacency[x].has(y)) continue;
        const key = x < y ? x * M + y : y * M + x;
        const entry = scores.get(key) ?? { score: 0, common: 0 };
        entry.score += inc;
        entry.common++;
        scores.set(key, entry);
      }
  });
  return [...scores]
    .filter(([, e]) => e.common >= 2)
    .sort((x, y) => y[1].score - x[1].score)
    .slice(0, 12)
    .map(([key, e]) => {
      const a = Math.floor(key / M);
      const b = key % M;
      const via = [...adjacency[a].keys()].filter((w) => adjacency[b].has(w));
      return { a, b, score: e.score, via, shared: toTraits(shared(a, b)) };
    });
}

/** Valores que comparten dos personas, los más raros primero. */
export function sharedTraits(network: Network, a: number, b: number, limit = 3): Trait[] {
  const { tokens, nodeTokens } = network;
  const other = new Set(nodeTokens[b]);
  return nodeTokens[a]
    .filter((t) => other.has(t))
    .sort((x, y) => tokens[y].idf - tokens[x].idf)
    .slice(0, limit)
    .map((t) => ({ dim: tokens[t].dim, field: tokens[t].field, value: tokens[t].value }));
}

/** Relaciones probables de una persona: contactos de sus contactos con los que aún no está unida. */
export function predictFor(network: Network, i: number, limit = 5): Omit<Prediction, "shared">[] {
  const { nodes, adjacency } = network;
  const scores = new Map<number, { score: number; via: number[] }>();
  for (const w of adjacency[i].keys()) {
    const degree = adjacency[w].size;
    if (degree < 2 || degree > PREDICTION_MAX_HUB_DEGREE) continue;
    for (const v of adjacency[w].keys()) {
      if (v === i || adjacency[i].has(v)) continue;
      const entry = scores.get(v) ?? { score: 0, via: [] };
      entry.score += 1 / Math.log(degree);
      entry.via.push(w);
      scores.set(v, entry);
    }
  }
  return [...scores]
    .filter(([v]) => !nodes[v].external)
    .sort((x, y) => y[1].score - x[1].score)
    .slice(0, limit)
    .map(([b, e]) => ({ a: i, b, score: e.score, via: e.via }));
}

/**
 * Louvain: mueve cada nodo a la comunidad vecina que más sube la
 * modularidad, luego junta cada comunidad en un solo nodo y repite.
 */
function louvain(n: number, edges: { a: number; b: number; weight: number }[], random: () => number): number[] {
  let membership = Array.from({ length: n }, (_, i) => i);
  let size = n;
  let adj: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  let self = new Float64Array(n);
  for (const { a, b, weight } of edges) {
    adj[a].set(b, (adj[a].get(b) ?? 0) + weight);
    adj[b].set(a, (adj[b].get(a) ?? 0) + weight);
  }

  for (let level = 0; level < 10; level++) {
    const k = new Float64Array(size);
    let m2 = 0;
    for (let i = 0; i < size; i++) {
      let s = 2 * self[i];
      for (const w of adj[i].values()) s += w;
      k[i] = s;
      m2 += s;
    }
    if (m2 === 0) break;

    const comm = Int32Array.from({ length: size }, (_, i) => i);
    const tot = Float64Array.from(k);
    const order = shuffle(Array.from({ length: size }, (_, i) => i), random);
    let movedAny = false;
    for (let pass = 0; pass < 20; pass++) {
      let moved = false;
      for (const i of order) {
        const current = comm[i];
        const links = new Map<number, number>();
        for (const [j, w] of adj[i]) links.set(comm[j], (links.get(comm[j]) ?? 0) + w);
        tot[current] -= k[i];
        let best = current;
        let bestGain = (links.get(current) ?? 0) - (tot[current] * k[i]) / m2;
        for (const [c, w] of links) {
          const gain = w - (tot[c] * k[i]) / m2;
          if (gain > bestGain + 1e-12) {
            best = c;
            bestGain = gain;
          }
        }
        tot[best] += k[i];
        if (best !== current) {
          comm[i] = best;
          moved = true;
          movedAny = true;
        }
      }
      if (!moved) break;
    }
    if (!movedAny) break;

    const renumber = new Map<number, number>();
    for (let i = 0; i < size; i++) if (!renumber.has(comm[i])) renumber.set(comm[i], renumber.size);
    membership = membership.map((c) => renumber.get(comm[c])!);

    const nextSize = renumber.size;
    const nextAdj: Map<number, number>[] = Array.from({ length: nextSize }, () => new Map());
    const nextSelf = new Float64Array(nextSize);
    for (let i = 0; i < size; i++) {
      const ci = renumber.get(comm[i])!;
      nextSelf[ci] += self[i];
      for (const [j, w] of adj[i]) {
        if (j < i) continue;
        const cj = renumber.get(comm[j])!;
        if (ci === cj) nextSelf[ci] += w;
        else {
          nextAdj[ci].set(cj, (nextAdj[ci].get(cj) ?? 0) + w);
          nextAdj[cj].set(ci, (nextAdj[cj].get(ci) ?? 0) + w);
        }
      }
    }
    adj = nextAdj;
    self = nextSelf;
    size = nextSize;
  }
  return membership;
}
