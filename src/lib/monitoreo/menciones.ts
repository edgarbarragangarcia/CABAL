/**
 * ¿Un texto nombra a María Fernanda Cabal? Se buscan su apellido, su apodo («MaFe») y su cuenta de X. «cabal» en minúscula
 * no cuenta: en español también es un adjetivo («dar cabal cumplimiento»). Tampoco «María Fernanda» a secas, que es un nombre
 * muy común. Es una búsqueda sobre el texto disponible (título y descripción de un video, titular de una noticia): no se
 * lee el contenido completo del video ni del artículo.
 */
const PATRON = /\b(?:Cabal|CABAL|MaFe)\b|MariaFdaCabal/;

export function nombraAMariaFernanda(texto: string): boolean {
  return PATRON.test(texto);
}

/** El fragmento donde aparece, para mostrar en qué contexto la nombran (null si no aparece). */
export function contextoDeMencion(texto: string, ancho = 80): string | null {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const m = PATRON.exec(limpio);
  if (!m) return null;
  const desde = Math.max(0, m.index - ancho);
  const hasta = Math.min(limpio.length, m.index + m[0].length + ancho);
  return `${desde > 0 ? "…" : ""}${limpio.slice(desde, hasta)}${hasta < limpio.length ? "…" : ""}`;
}
