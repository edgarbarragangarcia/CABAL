/**
 * Los formatos que puede escribir el Redactor además de la nota de prensa: publicaciones para redes, columnas, discursos y bullets
 * de apoyo para una entrevista. Cada uno trae lo que se le pide a la IA y el límite de caracteres que se avisa en pantalla.
 */
export type FormatoId = "nota" | "x" | "instagram" | "facebook" | "tiktok" | "columna" | "discurso" | "bullets";

export const FORMATOS: Record<FormatoId, { nombre: string; corto: string; ayuda: string; palabras: number | null; limite: number | null; instruccion: string }> = {
  nota: { nombre: "Nota de prensa", corto: "Nota", ayuda: "Nota completa con título, resumen, imagen y buscadores.", palabras: 450, limite: null, instruccion: "" },
  x: {
    nombre: "Trinos de X", corto: "X", ayuda: "Un trino o un hilo, cada uno de máximo 280 caracteres.", palabras: null, limite: 280,
    instruccion: "Escribe un hilo de 3 a 7 trinos (o uno solo si el material es breve). CADA trino debe tener MÁXIMO 280 caracteres contando espacios. El primero engancha con el dato más fuerte. Sepáralos con una línea que contenga solo «---». Máximo 2 hashtags en todo el hilo. Sin numeración tipo 1/5 salvo que ayude.",
  },
  instagram: {
    nombre: "Instagram", corto: "Instagram", ayuda: "Texto de la publicación, con gancho, hashtags e idea de imagen.", palabras: null, limite: 2200,
    instruccion: "Escribe el pie de foto de una publicación de Instagram: primera línea que enganche (se ve antes del «ver más»), 2 a 4 párrafos cortos, un llamado a la acción y 5 a 8 hashtags al final. Cierra con una línea «Imagen sugerida:» describiendo qué mostrar (sin inventar hechos). Máximo 2200 caracteres.",
  },
  facebook: {
    nombre: "Facebook", corto: "Facebook", ayuda: "Publicación conversacional que invite a comentar.", palabras: null, limite: 800,
    instruccion: "Escribe una publicación de Facebook cercana y conversacional de 80 a 150 palabras, con un dato central, un párrafo de contexto y una pregunta final que invite a comentar. Máximo 2 hashtags.",
  },
  tiktok: {
    nombre: "Guion de TikTok", corto: "TikTok", ayuda: "Guion de 30 a 60 segundos con gancho, escenas y texto en pantalla.", palabras: 130, limite: null,
    instruccion: "Escribe un guion de TikTok de 30 a 60 segundos (unas 80 a 130 palabras habladas). Estructura con subtítulos «##»: «Gancho (0-3 s)», «Desarrollo», «Cierre y llamado». Bajo cada uno, viñetas con «Dice:» (lo que se habla) y «Pantalla:» (texto o imagen en pantalla). Frases cortas, ritmo rápido.",
  },
  columna: {
    nombre: "Columna de opinión", corto: "Columna", ayuda: "Texto de opinión con tesis, argumentos y cierre.", palabras: 700, limite: null,
    instruccion: "Escribe una columna de opinión en primera persona, con una tesis clara en el primer párrafo, tres argumentos apoyados SOLO en los hechos del material (cada uno con su dato), una objeción respondida y un cierre contundente. Subtítulos «##» opcionales. Las opiniones son del autor, pero los hechos, cifras y citas deben constar en el material.",
  },
  discurso: {
    nombre: "Discurso", corto: "Discurso", ayuda: "Texto para decir en voz alta, con apertura, cuerpo y cierre.", palabras: 600, limite: null,
    instruccion: "Escribe un discurso para decir en voz alta (unas 600 palabras, 4 a 5 minutos). Frases cortas y rítmicas, repeticiones que se recuerden, una historia o imagen de apertura, tres ideas fuerza apoyadas en el material, un cierre con llamado a la acción. Estructura con subtítulos «##»: «Apertura», «Ideas centrales», «Cierre». Marca las pausas con «(pausa)». No inventes anécdotas ni cifras.",
  },
  bullets: {
    nombre: "Bullets para entrevista", corto: "Bullets", ayuda: "Ayuda de memoria para leer antes de una entrevista y tener a la mano.", palabras: null, limite: null,
    instruccion: "Arma una ayuda de memoria para una entrevista, solo con viñetas cortas (una idea por viñeta, máximo 20 palabras), en este orden con subtítulos «##»: «Mensaje central» (1 a 2 viñetas), «Datos que no se pueden olvidar» (6 a 10 viñetas, cada una con su cifra o fecha y de dónde sale), «Frases para repetir» (4 a 6, de máxima 15 palabras), «Preguntas difíciles y respuesta corta» (4 a 6: la pregunta en negrita y la respuesta en una viñeta) y «Lo que no hay que decir» (2 a 4). Todo debe salir del material.",
  },
};

export const FORMATOS_ORDEN: FormatoId[] = ["nota", "x", "instagram", "facebook", "tiktok", "columna", "discurso", "bullets"];

/** Los formatos que no son nota se escriben en tres pasos: contexto, texto y vista previa. */
export const esNota = (f: string | undefined) => !f || f === "nota";

/** Trinos de un hilo (separados por una línea «---») con su largo. */
export function partesDeHilo(cuerpo: string): { texto: string; largo: number }[] {
  return cuerpo.split(/\n\s*---+\s*\n/).map((t) => t.trim()).filter(Boolean).map((t) => ({ texto: t, largo: [...t].length }));
}
