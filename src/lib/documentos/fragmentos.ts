/**
 * Divide el texto de un documento en fragmentos para vectorizarlos: de unos mil caracteres, cortados por párrafos (y, si un párrafo
 * es larguísimo, por oraciones), con un poco de solape para que una idea cortada en el borde no se pierda. Cada fragmento recuerda la
 * página donde empieza (PDF). Parte pura, sin red ni `server-only`, para poder probarla sola.
 */

export type Pagina = { numero: number | null; texto: string };
export type Fragmento = { posicion: number; pagina: number | null; contenido: string };

type Opciones = {
  /** Tamaño al que se intenta llegar, en caracteres. */
  objetivo?: number;
  /** Ningún fragmento pasa de aquí. */
  maximo?: number;
  /** Caracteres del final de un fragmento que se repiten al principio del siguiente. */
  solape?: number;
};

const OBJETIVO = 1100;
const MAXIMO = 1600;
const SOLAPE = 160;
const MINIMO = 24;

/** Limpia el texto de una página: sin caracteres raros, líneas de un mismo párrafo unidas y párrafos separados por una línea en blanco. */
export function limpiarTexto(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/­/g, "") // guion blando
    .replace(/[ \t ]+/g, " ")
    .replace(/[ ]*\n[ ]*/g, "\n")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2") // palabra cortada al final de línea
    .replace(/\n{2,}/g, "\u0000")
    .replace(/\n/g, " ")
    .replace(/\u0000/g, "\n\n")
    .trim();
}

/** Parte un texto largo por oraciones y, si una oración sola es demasiado larga, por palabras. */
function partirLargo(texto: string, maximo: number): string[] {
  const oraciones = texto.match(/[^.!?…;:]+[.!?…;:]+["”’)\]]*\s*|[^.!?…;:]+$/g) ?? [texto];
  const piezas: string[] = [];
  for (const oracion of oraciones) {
    if (oracion.length <= maximo) {
      piezas.push(oracion);
      continue;
    }
    let resto = oracion;
    while (resto.length > maximo) {
      let corte = resto.lastIndexOf(" ", maximo);
      if (corte < maximo * 0.5) corte = maximo;
      piezas.push(resto.slice(0, corte));
      resto = resto.slice(corte).trimStart();
    }
    if (resto) piezas.push(resto);
  }
  return piezas;
}

/** El final de un fragmento, empezando en una palabra completa, para repetirlo al principio del siguiente. */
function cola(texto: string, solape: number): string {
  if (solape <= 0 || texto.length <= solape) return "";
  const desde = texto.length - solape;
  const espacio = texto.indexOf(" ", desde);
  return espacio === -1 ? "" : texto.slice(espacio + 1).trim();
}

export function dividirEnFragmentos(paginas: Pagina[], opciones: Opciones = {}): Fragmento[] {
  const objetivo = opciones.objetivo ?? OBJETIVO;
  const maximo = Math.max(objetivo, opciones.maximo ?? MAXIMO);
  const solape = opciones.solape ?? SOLAPE;

  // Unidades de texto (párrafos u oraciones) con la página de la que vienen.
  const unidades: { pagina: number | null; texto: string; separador: string }[] = [];
  for (const p of paginas) {
    for (const parrafo of limpiarTexto(p.texto).split(/\n{2,}/)) {
      const t = parrafo.trim();
      if (!t) continue;
      if (t.length <= maximo - solape) unidades.push({ pagina: p.numero, texto: t, separador: "\n\n" });
      else for (const pieza of partirLargo(t, maximo - solape)) if (pieza.trim()) unidades.push({ pagina: p.numero, texto: pieza.trim(), separador: " " });
    }
  }

  const fragmentos: Fragmento[] = [];
  let actual = "";
  let pagina: number | null = null;
  let hayNuevo = false; // el fragmento en curso ya tiene texto propio, no solo el solape
  const cerrar = () => {
    const contenido = actual.trim();
    if (hayNuevo && contenido.length >= MINIMO) fragmentos.push({ posicion: fragmentos.length, pagina, contenido });
    const resto = cola(contenido, solape);
    actual = resto;
    hayNuevo = false;
  };

  for (const u of unidades) {
    // Si lo acumulado es apenas un título o una frase corta, no se cierra: se le sigue pegando texto (que quepa en `maximo`).
    if (actual.length >= MINIMO && actual.length + u.separador.length + u.texto.length > objetivo && hayNuevo) {
      // Se cierra aquí; el siguiente arranca con el solape (y su página es la de la primera unidad nueva).
      cerrar();
      pagina = null;
    }
    if (!hayNuevo) pagina = u.pagina;
    actual = actual ? `${actual}${hayNuevo ? u.separador : " "}${u.texto}` : u.texto;
    hayNuevo = true;
  }
  // Lo último: si es muy corto, se pega al fragmento anterior en vez de dejarlo suelto.
  const ultimo = actual.trim();
  if (hayNuevo && ultimo) {
    if (ultimo.length < MINIMO && fragmentos.length > 0) fragmentos[fragmentos.length - 1].contenido += `\n\n${ultimo}`;
    else fragmentos.push({ posicion: fragmentos.length, pagina, contenido: ultimo });
  }
  return fragmentos;
}
