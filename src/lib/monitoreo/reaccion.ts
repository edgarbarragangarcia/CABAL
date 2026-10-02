import "server-only";

import { generarConBusqueda } from "@/lib/ia-config";
import { buscarNoticias, type Noticia } from "@/lib/informe/fuentes";
import { leerReaccion, type ResultadoReaccion } from "./reaccion-lector";
import { redes } from "./redes";

const SYSTEM = `Eres analista de opinión pública para la Fundación Escuela Libertad (María Fernanda Cabal). Investigas CÓMO ESTÁ REACCIONANDO LA GENTE a lo que ella dice y hace, y con qué tono, usando tu herramienta de búsqueda web (varias búsquedas distintas: prensa, columnas de opinión, comentarios de lectores, notas que citen trinos o publicaciones en X, Facebook, Instagram, TikTok y YouTube, y encuestas) y los datos reales que se te entregan (titulares de las últimas semanas y, si existen, comentarios y publicaciones de redes).

Reglas estrictas:
- Todo hecho debe poder rastrearse a una fuente real; no inventes citas, cifras ni reacciones. Si no encontraste reacción de un grupo, dilo.
- Los porcentajes de tono son una ESTIMACIÓN sobre la muestra que revisaste, no una encuesta: indica el tamaño de la muestra y sus límites.
- Distingue el tono de la prensa del tono de la gente (comentarios, redes). Si solo viste prensa, dilo.
- Cuando cites a alguien, indica medio o red y fecha aproximada.

Responde ÚNICAMENTE con un objeto JSON (sin texto antes ni después, sin bloques de código):
{
 "resumen": "3 a 5 frases: qué pasó y cómo reacciona la gente",
 "muestra": "qué revisaste: cuántos titulares, comentarios, publicaciones y límites",
 "tono": {"positivo": 0, "neutral": 0, "negativo": 0, "lectura": "una frase que interprete el balance"},
 "tonoPrensa": "tono dominante de los medios y por qué",
 "tonoGente": "tono dominante de la gente (redes y comentarios) y por qué, o 'no se pudo medir'",
 "temas": [{"tema": "...", "tono": "positivo|neutral|negativo|dividido", "detalle": "..."}],
 "reacciones": [{"grupo": "simpatizantes|críticos|medios|políticos|otros", "reaccion": "...", "citas": ["cita o referencia con medio y fecha"]}],
 "momentos": [{"fecha": "YYYY-MM-DD o aproximada", "hecho": "...", "reaccion": "..."}],
 "riesgos": ["..."],
 "oportunidades": ["..."],
 "recomendaciones": ["acción concreta para la Fundación"]
}
Los tres porcentajes de "tono" son enteros y suman 100. Todos los arreglos de strings (riesgos, oportunidades, recomendaciones, citas) contienen strings simples, nunca objetos.`;

const linea = (n: Noticia) => `- ${n.titulo} (${n.medio}, ${n.fecha.slice(0, 10)})`;

let memoria: { en: number; datos: ResultadoReaccion } | null = null;

/** Cuesta una llamada de IA con búsqueda web: solo con el botón, y se recuerda 30 minutos. */
export async function investigarReaccion({ forzar = false } = {}): Promise<ResultadoReaccion> {
  if (!forzar && memoria && Date.now() - memoria.en < 30 * 60_000) return memoria.datos;

  const hoy = new Date();
  const desde = new Date(hoy.getTime() - 21 * 86_400_000).toISOString().slice(0, 10);
  const [prensa, opinion, r] = await Promise.all([
    buscarNoticias(`"María Fernanda Cabal" after:${desde}`, 60),
    buscarNoticias(`"María Fernanda Cabal" (reacciones OR críticas OR respaldo OR polémica OR trino OR opinan) after:${desde}`, 40),
    redes().catch(() => null),
  ]);
  const vistos = new Set<string>();
  const titulares = [...prensa, ...opinion].filter((n) => (vistos.has(n.enlace) ? false : (vistos.add(n.enlace), true))).slice(0, 80);

  const publicaciones = [
    ...(r?.x.estado === "ok" ? r.x.datos.recientes : []),
    ...(r?.youtube.estado === "ok" ? r.youtube.datos.comentarios : []),
  ].slice(0, 40);

  const user = [
    `Hoy es ${hoy.toISOString().slice(0, 10)}. Analiza las últimas tres semanas.`,
    `\n## Titulares de prensa (${titulares.length}, Google Noticias)\n${titulares.map(linea).join("\n") || "- (sin resultados)"}`,
    publicaciones.length
      ? `\n## Publicaciones y comentarios de redes (${publicaciones.length}, API oficial)\n${publicaciones
          .map((p) => `- ${p.autor} (${p.fecha.slice(0, 10)}, ${p.me_gusta} me gusta): ${p.texto.replace(/\s+/g, " ").slice(0, 240)}`)
          .join("\n")}`
      : "\n## Redes sociales\nNo hay API de redes conectada: busca en la web notas y publicaciones que las citen.",
  ].join("\n");

  const { texto, fuentes } = await generarConBusqueda({ system: SYSTEM, user, maxTokens: 6000 });
  if (!texto.trim()) throw new Error("La búsqueda no devolvió resultados.");
  const datos: ResultadoReaccion = { analisis: leerReaccion(texto), texto, fuentes, generadoEn: hoy.toISOString(), titulares: titulares.length };
  memoria = { en: Date.now(), datos };
  return datos;
}
