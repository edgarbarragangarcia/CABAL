/** Estadística sencilla para comparar municipios (sin servidor, para poder probarla sola). */

/** Rangos de una lista (de 1 a n); los empates reciben el promedio de sus posiciones. */
function rangos(v: number[]): number[] {
  const orden = v.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const r = new Array<number>(v.length);
  for (let a = 0; a < orden.length; ) {
    let b = a;
    while (b + 1 < orden.length && orden[b + 1].x === orden[a].x) b++;
    const promedio = (a + b) / 2 + 1;
    for (let k = a; k <= b; k++) r[orden[k].i] = promedio;
    a = b + 1;
  }
  return r;
}

function pearson(x: number[], y: number[]): number | null {
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

/** Correlación de Spearman (la de Pearson sobre los rangos): mide si dos cifras suben juntas sin suponer que la relación sea una recta. */
export function spearman(x: number[], y: number[]): number | null {
  return x.length === y.length ? pearson(rangos(x), rangos(y)) : null;
}

export function fuerza(r: number): string {
  const a = Math.abs(r);
  return a < 0.2 ? "muy débil" : a < 0.4 ? "débil" : a < 0.6 ? "moderada" : a < 0.8 ? "fuerte" : "muy fuerte";
}

/** Parte los índices de `valores` (de menor a mayor) en `k` grupos del mismo tamaño, con el resto repartido desde el último. */
export function partirEnGrupos(valores: number[], k = 3): number[][] {
  const orden = valores.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v).map((x) => x.i);
  const base = Math.floor(orden.length / k);
  const extra = orden.length % k;
  const grupos: number[][] = [];
  let desde = 0;
  for (let g = 0; g < k; g++) {
    const tam = base + (g >= k - extra ? 1 : 0);
    grupos.push(orden.slice(desde, desde + tam));
    desde += tam;
  }
  return grupos;
}
