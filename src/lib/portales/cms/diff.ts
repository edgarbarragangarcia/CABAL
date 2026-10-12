/** Comparación línea por línea entre dos textos (para el historial de versiones). Sin dependencias; recorta a 800 líneas. */

export type LineaDiff = { tipo: "igual" | "agregada" | "quitada"; texto: string };

export function diferencias(antes: string, despues: string, tope = 800): LineaDiff[] {
  const a = antes.replace(/\r\n?/g, "\n").split("\n").slice(0, tope);
  const b = despues.replace(/\r\n?/g, "\n").split("\n").slice(0, tope);
  // Subsecuencia común más larga (tabla de largos) y recorrido hacia atrás.
  const m = a.length;
  const n = b.length;
  const t: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const salida: LineaDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      salida.push({ tipo: "igual", texto: a[i] });
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) salida.push({ tipo: "quitada", texto: a[i++] });
    else salida.push({ tipo: "agregada", texto: b[j++] });
  }
  while (i < m) salida.push({ tipo: "quitada", texto: a[i++] });
  while (j < n) salida.push({ tipo: "agregada", texto: b[j++] });
  return salida;
}

/** Líneas agregadas y quitadas, para el resumen («+12 −3»). */
export function resumenDiff(d: LineaDiff[]) {
  return { agregadas: d.filter((x) => x.tipo === "agregada" && x.texto.trim()).length, quitadas: d.filter((x) => x.tipo === "quitada" && x.texto.trim()).length };
}
