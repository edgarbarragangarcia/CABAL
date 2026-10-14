/**
 * Tono de un titular o comentario hacia María Fernanda Cabal, por palabras: sin IA, sin claves y sin red, para poder colorear cada
 * mención del país. Es una estimación y se dice así en pantalla: un titular irónico o sin palabras de valoración queda «neutral».
 *
 * La clave es quién actúa. «Cabal arremete contra Petro» cuenta de qué hace ella (neutral); «Petro arremete contra Cabal» o «critican a
 * Cabal» la dejan mal (negativo). Lo mismo con el apoyo: «respaldan a Cabal» la favorece; «Cabal respalda a X» solo informa.
 */
export type Tono = "positivo" | "neutral" | "negativo";

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cosas que le pasan a quien las recibe y la dejan mal (no cuentan palabras como «escándalo» o «crisis»: casi siempre son de otros). */
const NEGATIVAS = /\b(sancion(?:ada|es|an|ar)?|condena(?:da|do|n)?|tutela|rectific\w+|derrota|pierde|perdio|se hunde|hundimiento|abuche\w*|repudio|pide perdon|zancadilla|traicion|traidora|imputad\w+|procesada|denuncia penal|investigacion (?:contra|a)|vetada|expulsada)\b/;
/** Cosas que le pasan a quien las recibe y la favorecen. */
const POSITIVAS = /\b(elogi\w+|aplaud\w+|ovacion\w*|homenaje|reconocimiento|aclam\w+|felicit\w+|orgullo|respald\w+|apoy\w+|adhesion|se une a ella)\b/;
/** Logros de quien es sujeto: favorecen aunque vayan después del nombre. */
const LOGROS = /\b(gana|ganadora|gano|lidera|lidero|triunf\w+|favorita|ventaja|crece)\b/;
/** Verbos de ataque o crítica: dependen de quién los dice. */
const ATAQUE = /\b(critic\w*|cuestion\w*|arremete\w*|acus\w*|denunci\w*|atac\w*|desmiente\w*|desmienten|senal\w*|demanda\w*|fustig\w*|reproch\w*|regan\w*|contraataca\w*)\b/;
const NOMBRE = /\b(maria fernanda cabal|maria fernanda|mafe cabal|mafe|fernanda cabal|cabal)\b/;
const EMOJI_POS = /[👏❤💚💙🙌👍💪🙏👑]/u;
const EMOJI_NEG = /[😡🤬🤮👎💩🤡😠😤]/u;

export function tonoDeTexto(texto: string): { tono: Tono; puntaje: number } {
  const t = sinTildes(texto).replace(/santa rosa de cabal/g, " ");
  const nombre = NOMBRE.exec(t);
  const pos = nombre?.index ?? -1;
  let puntaje = 0;

  const neg = NEGATIVAS.exec(t);
  if (neg) puntaje -= 2;
  const bien = POSITIVAS.exec(t);
  if (bien) {
    // «respaldan a Cabal», «apoyo a María Fernanda»: la favorece. «Cabal respalda a X»: solo informa de lo que ella hace.
    puntaje += pos >= 0 && bien.index > pos ? 0 : 2;
  }
  if (LOGROS.test(t)) puntaje += 2;
  const ataque = ATAQUE.exec(t);
  if (ataque && pos >= 0) {
    const antes = t.slice(Math.max(0, pos - 14), pos);
    // Ella recibe la crítica si el verbo va antes de su nombre («Petro arremete contra Cabal») o la crítica es «a/contra Cabal».
    // «La crítica de Cabal a Uribe» o «Cabal critica a Petro»: la hace ella, no la recibe.
    const recibe = (ataque.index < pos && !/\b(la|las|su|sus)\s+\w*\s*$/.test(t.slice(0, ataque.index + ataque[0].length + 1)) && /\b(contra|a|de|sobre)\s*$/.test(antes)) || /\b(contra|a)\s*$/.test(antes) && ataque.index < pos;
    if (recibe) puntaje -= 2;
  }
  if (EMOJI_POS.test(texto)) puntaje += 1;
  if (EMOJI_NEG.test(texto)) puntaje -= 1;
  return { tono: puntaje >= 1 ? "positivo" : puntaje <= -1 ? "negativo" : "neutral", puntaje };
}

/** Color de un índice de -1 (todo negativo) a 1 (todo positivo): rojo → gris → verde. */
export function colorDeIndice(indice: number): string {
  const t = Math.max(-1, Math.min(1, indice));
  const mezcla = (a: number[], b: number[], k: number) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
  const rojo = [220, 38, 38];
  const gris = [148, 163, 184];
  const verde = [22, 163, 74];
  const c = t < 0 ? mezcla(gris, rojo, -t) : mezcla(gris, verde, t);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export const COLOR_TONO: Record<Tono, string> = { positivo: "#16a34a", neutral: "#94a3b8", negativo: "#dc2626" };
