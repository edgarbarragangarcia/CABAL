import "server-only";

import { buscarEnDocumentos } from "@/lib/documentos/servicio";
import { generarTexto } from "@/lib/ia-config";
import { HECHOS_VIGENTES, HECHOS_VIGENTES_AL } from "@/lib/asistente-voz/contexto-vigente";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * El cerebro del asistente de voz: entiende la pregunta, busca en lo que el panel guarda (documentos, resultados electorales, Monitoreo,
 * cifras generales) y responde corto y natural, para ser hablado. Solo lectura: nunca modifica nada.
 */

export type Turno = { rol: "usuario" | "asistente"; texto: string };

type Fuente = "documentos" | "candidatos" | "monitoreo" | "datos";
type Intencion = { fuente: "documentos" | "candidatos" | "monitoreo" | "datos" | "charla"; busqueda: string; cargo: "CO" | "JA" | "AL" | "AS" | "GO" | null; partido: string; lugar: string; tambien: Fuente[]; analisis: boolean; personaje: string; dias: number };

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
      '{"fuente": "documentos" | "candidatos" | "monitoreo" | "datos" | "charla", "busqueda": texto corto para buscar, "cargo": "CO" | "JA" | "AL" | "AS" | "GO" | null, "partido": nombre del partido o movimiento si lo mencionan (si no, ""), "lugar": ciudad, municipio o departamento si lo mencionan (si no, ""), "tambien": lista con OTRAS fuentes que ayudarían a relacionar y contrastar la respuesta (de «documentos», «candidatos», «monitoreo», «datos»), "personaje": de quién piden la prensa: «mafe» (por defecto), «espriella» (Abelardo de la Espriella, el presidente), «uribe», «petro», «cepeda», «paloma» (Paloma Valencia) o «fajardo», "dias": ventana de tiempo en días para prensa y redes (1 si dicen hoy, 7 esta semana, 30 por defecto, hasta 365), "analisis": true si piden analizar, relacionar, comparar, interpretar, opinar, estrategia, riesgos, qué significa, por qué o qué conviene hacer (análisis político), false si solo piden un dato}. ' +
      "«documentos»: preguntas sobre el contenido de los documentos subidos: boletines, discursos, intervenciones, declaraciones y columnas de la Dra. María Fernanda Cabal, actas, programas, estudios; también «qué dijo o qué habló la Dra. sobre un tema» (en «busqueda» pon solo el tema). «candidatos»: votos de candidatos o concejales, ediles, alcaldes, diputados, gobernadores en las elecciones 2023 (en «busqueda» pon SOLO el nombre de la persona si lo dicen, nunca el partido ni el lugar; en «cargo»: CO concejo, JA ediles, AL alcaldía, AS asamblea, GO gobernación). " +
      "«monitoreo»: qué dicen la prensa y las redes de María Fernanda Cabal (menciones, medios, tono), NO lo que ella dijo. «datos»: cuántos datos o registros hay guardados en el panel. «charla»: saludos o cualquier cosa que no necesite datos.",
    user: `${previo ? `Conversación reciente:\n${previo}\n\n` : ""}Pregunta: ${pregunta}`,
    maxTokens: 200,
  });
  const j = leerJson<Partial<Intencion>>(salida);
  const fuente = j?.fuente && ["documentos", "candidatos", "monitoreo", "datos", "charla"].includes(j.fuente) ? j.fuente : "documentos";
  return { fuente, busqueda: String(j?.busqueda ?? pregunta).slice(0, 120), cargo: j?.cargo && j.cargo in NIVEL_CARGO ? j.cargo : null, partido: String(j?.partido ?? "").slice(0, 80), lugar: String(j?.lugar ?? "").slice(0, 80), tambien: Array.isArray(j?.tambien) ? (j.tambien as string[]).filter((x): x is Fuente => ["documentos", "candidatos", "monitoreo", "datos"].includes(x)) : [], analisis: j?.analisis === true, personaje: ["mafe", "espriella", "uribe", "petro", "cepeda", "paloma", "fajardo"].includes(String(j?.personaje)) ? String(j?.personaje) : "mafe", dias: Math.min(365, Math.max(1, Math.round(Number(j?.dias) || 30))) };
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
    const NOMBRE: Record<string, string> = { mafe: "María Fernanda Cabal", espriella: "Abelardo de la Espriella", uribe: "Álvaro Uribe", petro: "Gustavo Petro", cepeda: "Iván Cepeda", paloma: "Paloma Valencia", fajardo: "Sergio Fajardo" };
    const quien = NOMBRE[i.personaje] ?? NOMBRE.mafe;
    const desde = new Date(Date.now() - i.dias * 86_400_000).toISOString();
    const columnas = "titulo, medio, fecha, tono, vistas, contexto";
    type Fila = { titulo: string; medio: string | null; fecha: string; tono: string | null; vistas: number | null; contexto: string | null };
    const base = () => c.from("monitoreo_items").select(columnas).eq("personaje", i.personaje).gte("fecha", desde);
    const { data } = await base().order("fecha", { ascending: false }).limit(1500);
    const filas = (data ?? []) as Fila[];
    if (!filas.length) return { texto: `No hay menciones de ${quien} guardadas en los últimos ${i.dias} días.`, fuente: "Monitoreo" };
    const red = (f: Fila) => (f.medio ?? "web").split("|")[0];
    const tabla = (clave: (f: Fila) => string) => { const m = new Map<string, number>(); for (const f of filas) m.set(clave(f), (m.get(clave(f)) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };
    const porRed = tabla(red).map(([r, n]) => `${r} ${n}`).join(", ");
    const porTono = tabla((f) => f.tono ?? "sin medir").map(([t, n]) => `${t} ${n}`).join(", ");
    const porDia = tabla((f) => f.fecha.slice(0, 10)).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10).map(([d, n]) => `${d}: ${n}`).join("; ");
    const vistas = filas.reduce((acc, f) => acc + (f.vistas ?? 0), 0);
    // Titulares: los que contienen el tema pedido (si lo hay), si no los más recientes.
    const tema = i.busqueda.trim().toLowerCase();
    const palabras = tema.split(/\s+/).filter((w) => w.length >= 4);
    const coincide = (f: Fila) => palabras.length > 0 && palabras.some((w) => `${f.titulo} ${f.contexto ?? ""}`.toLowerCase().includes(w));
    const elegidas = (palabras.length ? filas.filter(coincide) : filas).slice(0, 14);
    const vistos = new Set<string>();
    const titulares = elegidas.filter((f) => { const k = f.titulo.slice(0, 60); if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 10);
    return {
      texto: `Prensa y redes sobre ${quien}, últimos ${i.dias} día(s), hasta hoy (${filas.length} menciones guardadas; fecha de la más reciente ${filas[0].fecha.slice(0, 10)}${vistas ? `; ${fmt(vistas)} vistas medibles` : ""}).\nPor red o medio: ${porRed}.\nTono: ${porTono}.\nMenciones por día: ${porDia}.\n${palabras.length ? `Titulares que tratan «${i.busqueda}»${titulares.length ? "" : ": ninguno en ese periodo"}` : "Titulares más recientes"}:\n${titulares.map((f) => `- ${f.titulo.slice(0, 220)} (${(f.medio ?? "").split("|")[1] ?? red(f)}, ${f.fecha.slice(0, 10)}${f.tono ? `, ${f.tono}` : ""})`).join("\n")}`,
      fuente: "Monitoreo",
    };
  }

  const cuenta = async (t: string) => (await c.from(t).select("*", { count: "estimated", head: true })).count ?? 0;
  const [res, mon, terr, cam, mie, doc] = await Promise.all(["resultados_electorales", "monitoreo_items", "indicadores_territoriales", "camaras_comercio", "miembros", "documentos"].map(cuenta));
  return { texto: `Datos guardados en el panel: ${fmt(res)} resultados electorales (territorios), ${fmt(mon)} menciones de Monitoreo, ${fmt(terr)} indicadores territoriales (DANE y datos abiertos), ${fmt(cam)} cámaras de comercio, ${fmt(mie)} afiliados de la comunidad y ${fmt(doc)} documentos.`, fuente: "datos del panel" };
}

const SISTEMA =
  "Eres MaFe, la analista política del equipo de María Fernanda Cabal: no solo entregas datos, los relacionas, los interpretas y propones qué hacer. Hablas en español de Colombia, natural, cercano y con criterio, como una asesora de confianza. " +
  "Tus respuestas se LEEN EN VOZ ALTA: sin markdown, sin listas, sin asteriscos, sin paréntesis, sin enlaces ni símbolos; di las cifras como se hablan. " +
  "Si piden un dato puntual, contesta en una o dos frases. Si piden analizar, relacionar o decidir, usa hasta siete frases cortas con este hilo: primero la lectura de los datos, luego cómo se relacionan entre sí (votos, documentos, prensa y redes, territorio), después el riesgo o la oportunidad, y cierra con una recomendación concreta. " +
  "Cruza las fuentes del CONTEXTO: compara cifras, busca coincidencias y contradicciones, y señala tendencias. " +
  "Separa con claridad lo que dicen los datos de lo que es tu interpretación: usa expresiones como «los datos muestran» y «mi lectura es». " +
  "Usa SOLO lo que diga el CONTEXTO para cifras, nombres y hechos; nunca inventes un dato. Los HECHOS VIGENTES del CONTEXTO mandan sobre cualquier documento o nota antigua que los contradiga: trata lo viejo como historia, con su fecha. Siempre habla de la situación actual y no de la de años anteriores. Si falta información para concluir, dilo y di exactamente qué dato haría falta y dónde cargarlo en el panel. " +
  "Si dicen un saludo o piden algo que no necesita datos, responde breve y pregunta en qué ayudas.";

export async function responder(pregunta: string, historial: Turno[]): Promise<{ respuesta: string; fuente: string }> {
  const intencion = await entender(pregunta, historial).catch((): Intencion => ({ fuente: "documentos", busqueda: pregunta, cargo: null, partido: "", lugar: "", tambien: [], analisis: false, personaje: "mafe", dias: 30 }));
  // Para un análisis se cruzan varias fuentes a la vez; para un dato puntual, la principal y las que el clasificador sugiera.
  const extra = intencion.analisis ? (["documentos", "candidatos", "monitoreo"] as Fuente[]) : intencion.tambien;
  const fuentes = [...new Set<Intencion["fuente"]>([intencion.fuente, ...extra])].filter((f) => f !== "charla").slice(0, 4);
  const contextos = fuentes.length ? await Promise.all(fuentes.map((f) => contextoDe({ ...intencion, fuente: f }, pregunta).catch(() => ({ texto: "", fuente: "" })))) : [await contextoDe(intencion, pregunta)];
  const ctx = { texto: contextos.filter((c) => c.texto).map((c) => `--- ${c.fuente} ---\n${c.texto}`).join("\n\n"), fuente: contextos.map((c) => c.fuente).filter(Boolean).join(" + ") };
  const previo = historial.slice(-6).map((t) => `${t.rol === "usuario" ? "Usuario" : "Asistente"}: ${t.texto}`).join("\n");
  const respuesta = await generarTexto({
    system: SISTEMA,
    user: `HECHOS VIGENTES (al ${HECHOS_VIGENTES_AL}; hoy es ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" })}):\n${HECHOS_VIGENTES}\n\n${previo ? `Conversación hasta ahora:\n${previo}\n\n` : ""}${ctx.texto ? `CONTEXTO (${ctx.fuente}):\n${ctx.texto}\n\n` : ""}Pregunta: ${pregunta}\n\nResponde hablando.`,
    maxTokens: intencion.analisis ? 900 : 450,
  });
  return { respuesta: respuesta.replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim(), fuente: ctx.fuente };
}
