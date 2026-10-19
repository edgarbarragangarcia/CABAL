import "server-only";

import { buscarEnDocumentos } from "@/lib/documentos/servicio";
import { generarTexto } from "@/lib/ia-config";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * El cerebro del asistente de voz: entiende la pregunta, busca en lo que el panel guarda (documentos, resultados electorales, Monitoreo,
 * cifras generales) y responde corto y natural, para ser hablado. Solo lectura: nunca modifica nada.
 */

export type Turno = { rol: "usuario" | "asistente"; texto: string };

type Intencion = { fuente: "documentos" | "candidatos" | "monitoreo" | "datos" | "charla"; busqueda: string; cargo: "CO" | "JA" | "AL" | "AS" | "GO" | null; partido: string; lugar: string };

const NIVEL_CARGO: Record<string, number> = { CO: 3, JA: 5, AL: 3, AS: 2, GO: 2 };

function leerJson<T>(texto: string): T | null {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

async function entender(pregunta: string, historial: Turno[]): Promise<Intencion> {
  const previo = historial.slice(-4).map((t) => `${t.rol === "usuario" ? "Usuario" : "Asistente"}: ${t.texto}`).join("\n");
  const salida = await generarTexto({
    system:
      "Clasificas lo que pregunta una persona al asistente del panel de una organización política colombiana. Responde SOLO un objeto JSON: " +
      '{"fuente": "documentos" | "candidatos" | "monitoreo" | "datos" | "charla", "busqueda": texto corto para buscar, "cargo": "CO" | "JA" | "AL" | "AS" | "GO" | null, "partido": nombre del partido o movimiento si lo mencionan (si no, ""), "lugar": ciudad, municipio o departamento si lo mencionan (si no, "")}. ' +
      "«documentos»: preguntas sobre el contenido de los documentos subidos: boletines, discursos, intervenciones, declaraciones y columnas de la Dra. María Fernanda Cabal, actas, programas, estudios; también «qué dijo o qué habló la Dra. sobre un tema» (en «busqueda» pon solo el tema). «candidatos»: votos de candidatos o concejales, ediles, alcaldes, diputados, gobernadores en las elecciones 2023 (en «busqueda» pon SOLO el nombre de la persona si lo dicen, nunca el partido ni el lugar; en «cargo»: CO concejo, JA ediles, AL alcaldía, AS asamblea, GO gobernación). " +
      "«monitoreo»: qué dicen la prensa y las redes de María Fernanda Cabal (menciones, medios, tono), NO lo que ella dijo. «datos»: cuántos datos o registros hay guardados en el panel. «charla»: saludos o cualquier cosa que no necesite datos.",
    user: `${previo ? `Conversación reciente:\n${previo}\n\n` : ""}Pregunta: ${pregunta}`,
    maxTokens: 200,
  });
  const j = leerJson<Partial<Intencion>>(salida);
  const fuente = j?.fuente && ["documentos", "candidatos", "monitoreo", "datos", "charla"].includes(j.fuente) ? j.fuente : "documentos";
  return { fuente, busqueda: String(j?.busqueda ?? pregunta).slice(0, 120), cargo: j?.cargo && j.cargo in NIVEL_CARGO ? j.cargo : null, partido: String(j?.partido ?? "").slice(0, 80), lugar: String(j?.lugar ?? "").slice(0, 80) };
}

const CARGO_NOMBRE: Record<string, string> = { CO: "concejo", JA: "juntas administradoras locales", AL: "alcaldía", AS: "asamblea", GO: "gobernación" };
const fmt = (n: number) => n.toLocaleString("es-CO");

async function contextoDe(i: Intencion, pregunta: string): Promise<{ texto: string; fuente: string }> {
  const c = getSupabaseServerClient();
  if (i.fuente === "charla") return { texto: "", fuente: "" };
  if (!c) return { texto: "Supabase no está conectado: no hay datos para consultar.", fuente: "sin conexión" };

  if (i.fuente === "documentos") {
    const [r1, r2] = await Promise.all([buscarEnDocumentos(pregunta, 8).catch(() => null), i.busqueda && i.busqueda !== pregunta ? buscarEnDocumentos(i.busqueda, 8).catch(() => null) : Promise.resolve(null)]);
    const vistos = new Set<string>();
    const hallazgos = [...(r1?.resultados ?? []), ...(r2?.resultados ?? [])]
      .filter((h) => h.similitud > 0.25)
      .sort((x, y) => y.similitud - x.similitud)
      .filter((h) => { const k = `${h.documentoId}:${h.pagina}:${h.contenido.slice(0, 40)}`; if (vistos.has(k)) return false; vistos.add(k); return true; })
      .slice(0, 8);
    if (!hallazgos.length) {
      // Quizá el documento existe pero no terminó de procesarse: se avisa en vez de decir que no hay nada.
      const palabras = i.busqueda.split(/\s+/).map((w) => w.replace(/[%_\\,().]/g, "")).filter((w) => w.length >= 4).slice(0, 4);
      if (palabras.length) {
        const { data } = await c.from("documentos").select("titulo, estado").neq("estado", "listo").eq("es_vigente", true).or(palabras.map((w) => `titulo.ilike.%${w}%`).join(",")).limit(3);
        const sin = (data ?? []) as { titulo: string; estado: string }[];
        if (sin.length) return { texto: `Hay documentos con ese tema que no terminaron de procesarse y por eso no se pueden consultar: ${sin.map((d) => `«${d.titulo}» (${d.estado})`).join(", ")}. Hay que volver a subirlos o procesarlos en el Gestor documental.`, fuente: "documentos" };
      }
      return { texto: "No hay documentos con información sobre esto (la biblioteca puede estar vacía).", fuente: "documentos" };
    }
    return { texto: hallazgos.map((h, k) => `[${k + 1}] Documento «${h.titulo}»${h.pagina ? `, página ${h.pagina}` : ""}: ${h.contenido}`).join("\n\n"), fuente: "documentos" };
  }

  if (i.fuente === "candidatos") {
    const cargo = i.cargo ?? "CO";
    const { data, error } = await c.rpc("candidatos_mas_votados", { p_eleccion: "territoriales-2023", p_corporacion: cargo, p_nivel: NIVEL_CARGO[cargo], p_prefijo: "", p_busqueda: i.busqueda.replace(/[%_\\]/g, ""), p_limite: 10, p_partido: i.partido.replace(/[%_\\]/g, ""), p_lugar: i.lugar.replace(/[%_\\]/g, "") });
    const filtros = [i.busqueda && `nombre «${i.busqueda}»`, i.partido && `partido «${i.partido}»`, i.lugar && `lugar «${i.lugar}»`].filter(Boolean).join(", ") || "sin filtros";
    if (error) return { texto: `No pude consultar los resultados de 2023 en este momento (${error.message}).`, fuente: "resultados 2023" };
    if (!data?.length) return { texto: `Busqué en los resultados guardados de 2023 (${CARGO_NOMBRE[cargo]}) con ${filtros} y no apareció ningún candidato. Puede que el nombre del partido o del lugar esté escrito distinto.`, fuente: "resultados 2023" };
    const filas = data as { ambito_nombre: string; partido: string; candidato: string; votos: number }[];
    return { texto: `Candidatos más votados (${CARGO_NOMBRE[cargo]}, elecciones territoriales 2023, preconteo oficial de la Registraduría; filtros: ${filtros}; ordenados de más a menos votos; no indica quién salió elegido):\n${filas.map((f) => `- ${f.candidato}, ${f.partido}, ${f.ambito_nombre}: ${fmt(f.votos)} votos`).join("\n")}`, fuente: "resultados electorales 2023" };
  }

  if (i.fuente === "monitoreo") {
    const desde = new Date(Date.now() - 31 * 86_400_000).toISOString();
    const { data } = await c.from("monitoreo_items").select("titulo, medio, fecha, tono").eq("personaje", "mafe").gte("fecha", desde).order("fecha", { ascending: false }).limit(300);
    const filas = (data ?? []) as { titulo: string; medio: string | null; fecha: string; tono: string | null }[];
    if (!filas.length) return { texto: "No hay menciones guardadas en el último mes.", fuente: "Monitoreo" };
    const porRed = new Map<string, number>();
    for (const f of filas) porRed.set((f.medio ?? "web").split("|")[0], (porRed.get((f.medio ?? "web").split("|")[0]) ?? 0) + 1);
    return {
      texto: `Menciones de María Fernanda Cabal en el último mes (muestra de ${filas.length}): ${[...porRed].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(", ")}.\nLas más recientes:\n${filas.slice(0, 8).map((f) => `- ${f.titulo} (${(f.medio ?? "").split("|")[1] ?? "web"}, ${f.fecha.slice(0, 10)})`).join("\n")}`,
      fuente: "Monitoreo",
    };
  }

  const cuenta = async (t: string) => (await c.from(t).select("*", { count: "estimated", head: true })).count ?? 0;
  const [res, mon, terr, cam, mie, doc] = await Promise.all(["resultados_electorales", "monitoreo_items", "indicadores_territoriales", "camaras_comercio", "miembros", "documentos"].map(cuenta));
  return { texto: `Datos guardados en el panel: ${fmt(res)} resultados electorales (territorios), ${fmt(mon)} menciones de Monitoreo, ${fmt(terr)} indicadores territoriales (DANE y datos abiertos), ${fmt(cam)} cámaras de comercio, ${fmt(mie)} afiliados de la comunidad y ${fmt(doc)} documentos.`, fuente: "datos del panel" };
}

const SISTEMA =
  "Eres el asistente de voz del panel del equipo de María Fernanda Cabal. Hablas en español de Colombia, natural y cercano, como una persona que conversa. " +
  "Tus respuestas se LEEN EN VOZ ALTA: máximo cuatro frases cortas, sin markdown, sin listas, sin asteriscos, sin paréntesis, sin enlaces ni símbolos; di las cifras como se hablan. " +
  "Usa SOLO lo que diga el CONTEXTO para los datos. Si el contexto no alcanza, dilo con franqueza y sugiere dónde mirar en el panel; nunca inventes. " +
  "Si dicen un saludo o piden algo que no necesita datos, responde breve y pregunta en qué ayudas.";

export async function responder(pregunta: string, historial: Turno[]): Promise<{ respuesta: string; fuente: string }> {
  const intencion = await entender(pregunta, historial).catch((): Intencion => ({ fuente: "documentos", busqueda: pregunta, cargo: null, partido: "", lugar: "" }));
  const ctx = await contextoDe(intencion, pregunta);
  const previo = historial.slice(-6).map((t) => `${t.rol === "usuario" ? "Usuario" : "Asistente"}: ${t.texto}`).join("\n");
  const respuesta = await generarTexto({
    system: SISTEMA,
    user: `${previo ? `Conversación hasta ahora:\n${previo}\n\n` : ""}${ctx.texto ? `CONTEXTO (${ctx.fuente}):\n${ctx.texto}\n\n` : ""}Pregunta: ${pregunta}\n\nResponde hablando.`,
    maxTokens: 400,
  });
  return { respuesta: respuesta.replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim(), fuente: ctx.fuente };
}
