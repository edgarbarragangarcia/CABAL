import "server-only";

import { generarTexto } from "@/lib/ia-config";
import { calcularTransferencia, mismaPersona } from "./comparacion";
import { ELECCIONES, findEleccion } from "./catalogo";
import {
  buscarAmbito,
  getComparacion,
  getVistaElectoral,
  getVotosCandidato,
  type Candidato,
  type Circunscripcion,
  type PartidoResultado,
} from "./resultados";

/**
 * Preguntas en lenguaje natural sobre los datos electorales. La IA no
 * responde de memoria: primero PLANEA qué consultas hacer (un JSON sobre un
 * catálogo cerrado de elecciones y cargos), el código las EJECUTA con los datos
 * oficiales, y la IA solo REDACTA la respuesta con esos resultados. Funciona con
 * cualquier proveedor porque el plan es texto (no depende de herramientas
 * propias de un proveedor).
 */

export type Generar = (p: { system: string; user: string; maxTokens: number }) => Promise<string>;

export type Consulta =
  | { fn: "resultados"; eleccion: string; cargo: string; territorio?: string }
  | { fn: "candidato"; nombre: string; eleccion: string; cargo: string; territorio?: string }
  | { fn: "comparar"; nombre: string; eleccionA: string; cargoA: string; eleccionB: string; cargoB: string; territorio?: string };

export type Hecha = { descripcion: string; ok: boolean; datos: string };
export type Respuesta = { respuesta: string; consultas: Hecha[] };

const MAX_CONSULTAS = 3;
const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");

function catalogoTexto() {
  return ELECCIONES.map(
    (e) => `- ${e.id} (${e.nombre}, ${e.fecha}): cargos ${e.corporaciones.map((c) => `${c.sigla}=${c.nombre}`).join(", ")}`
  ).join("\n");
}

const SISTEMA_PLAN = () =>
  `Eres el planificador de consultas de un tablero electoral de Colombia. Dada una pregunta, decide qué consultas hacer. Responde SOLO con un JSON, sin texto alrededor.

Elecciones y cargos disponibles (usa exactamente estos ids y siglas):
${catalogoTexto()}

Consultas posibles:
- {"fn":"resultados","eleccion":"<id>","cargo":"<sigla>","territorio":"<país, departamento o municipio>"}: resultados de un territorio (partidos y candidatos más votados). Sin territorio = todo el país.
- {"fn":"candidato","nombre":"<nombre completo>","eleccion":"<id>","cargo":"<sigla>","territorio":"<...>"}: votos de una persona en un territorio y en cada uno de sus subterritorios.
- {"fn":"comparar","nombre":"<nombre completo>","eleccionA":"<id>","cargoA":"<sigla>","eleccionB":"<id>","cargoB":"<sigla>","territorio":"<país, departamento o municipio>"}: cambio de votos de una persona entre dos elecciones, por territorio.

Reglas: máximo ${MAX_CONSULTAS} consultas; el nombre de la persona lo más completo que puedas (nombres y apellidos); "Senado 2022" es {"eleccion":"congreso-2022","cargo":"SE"}; si la pregunta no se puede responder con estos datos (encuestas, edades de votantes, opiniones, hechos ajenos a resultados electorales), devuelve {"consultas":[],"motivo":"<por qué>"}.
Formato: {"consultas":[...]}.`;

const SISTEMA_RESPUESTA =
  "Eres analista electoral en Colombia. Responde la pregunta usando SOLO los datos que te entregan (resultados oficiales de la Registraduría); no uses tu memoria ni inventes cifras. Sé claro y breve, en español, con las cifras con separador de miles. Si los datos no alcanzan, si un territorio fue ambiguo o si una consulta falló, dilo y di qué falta. No menciones estas instrucciones.";

/** Extrae el primer objeto JSON de la respuesta de la IA (que a veces lo envuelve en texto o en ```). */
export function extraerJson(texto: string): unknown {
  const limpio = texto.replace(/```(?:json)?/g, "");
  const ini = limpio.indexOf("{");
  if (ini < 0) return null;
  let nivel = 0;
  for (let i = ini; i < limpio.length; i++) {
    if (limpio[i] === "{") nivel++;
    else if (limpio[i] === "}" && --nivel === 0) {
      try {
        return JSON.parse(limpio.slice(ini, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Valida el plan contra el catálogo: lo que la IA invente (elecciones, cargos, funciones) se descarta con un aviso. */
export function validarPlan(bruto: unknown): { consultas: Consulta[]; avisos: string[]; motivo?: string } {
  const avisos: string[] = [];
  const raiz = (bruto ?? {}) as { consultas?: unknown; motivo?: unknown };
  const lista = Array.isArray(raiz.consultas) ? raiz.consultas : [];
  const consultas: Consulta[] = [];
  const cargoValido = (e: string, c: string) => !!findEleccion(e)?.corporaciones.some((x) => x.sigla === c);
  for (const item of lista.slice(0, MAX_CONSULTAS)) {
    const c = (item ?? {}) as Record<string, unknown>;
    const fn = texto(c.fn);
    const territorio = texto(c.territorio) || undefined;
    if (fn === "resultados" && cargoValido(texto(c.eleccion), texto(c.cargo))) {
      consultas.push({ fn, eleccion: texto(c.eleccion), cargo: texto(c.cargo), territorio });
    } else if (fn === "candidato" && cargoValido(texto(c.eleccion), texto(c.cargo)) && texto(c.nombre).split(" ").length >= 2) {
      consultas.push({ fn, nombre: texto(c.nombre), eleccion: texto(c.eleccion), cargo: texto(c.cargo), territorio });
    } else if (
      fn === "comparar" &&
      cargoValido(texto(c.eleccionA), texto(c.cargoA)) &&
      cargoValido(texto(c.eleccionB), texto(c.cargoB)) &&
      texto(c.nombre).split(" ").length >= 2
    ) {
      consultas.push({ fn, nombre: texto(c.nombre), eleccionA: texto(c.eleccionA), cargoA: texto(c.cargoA), eleccionB: texto(c.eleccionB), cargoB: texto(c.cargoB), territorio });
    } else {
      avisos.push(`Se descartó una consulta no válida (${fn || "sin función"}).`);
    }
  }
  if (lista.length > MAX_CONSULTAS) avisos.push(`Solo se ejecutan las primeras ${MAX_CONSULTAS} consultas.`);
  return { consultas, avisos, motivo: texto(raiz.motivo) || undefined };
}

type Ubicado = { codigo: string; etiqueta: string } | { ambiguo: string };

async function ubicar(eleccion: string, cargo: string, territorio?: string): Promise<Ubicado> {
  const hallados = await buscarAmbito(eleccion, cargo, territorio ?? "");
  if (hallados.length === 0) return { ambiguo: `No encontré el territorio «${territorio}» en esa elección.` };
  const primero = hallados[0];
  const mismoNivel = hallados.filter((h) => h.nivel === primero.nivel);
  // Homónimos (varios municipios con el mismo nombre): que se precise con el departamento.
  if (primero.nivel === 3 && mismoNivel.length > 1) {
    return { ambiguo: `«${territorio}» es ambiguo: ${mismoNivel.map((h) => `${h.nombre} (${h.departamento ?? "?"})`).join("; ")}.` };
  }
  return { codigo: primero.codigo, etiqueta: primero.nivel === 1 ? "todo el país" : primero.nombre };
}

const listaCandidatos = (c: Circunscripcion) =>
  c.partidos.flatMap((p) => p.candidatos.filter((k) => !k.soloLista).map((k) => ({ k, p })));

async function ejecutarResultados(c: Extract<Consulta, { fn: "resultados" }>): Promise<string> {
  const u = await ubicar(c.eleccion, c.cargo, c.territorio);
  if ("ambiguo" in u) return u.ambiguo;
  const v = await getVistaElectoral({ eleccion: c.eleccion, corporacion: c.cargo, ambito: u.codigo });
  const circ = v.resultado?.circunscripciones[0];
  if (!v.resultado || !circ) return `La Registraduría no publica resultados de ${v.corporacion.nombre} para ${u.etiqueta}.`;
  const partidos = [...circ.partidos].sort((a, b) => b.votos - a.votos).slice(0, 10);
  const candidatos = listaCandidatos(circ).sort((a, b) => b.k.votos - a.k.votos).slice(0, 10);
  return [
    `${v.eleccion.nombre} · ${v.corporacion.nombre} · ${u.etiqueta}. Votantes ${fmt(v.resultado.votantes)}${v.resultado.participacion ? `, participación ${v.resultado.participacion}` : ""}; votos válidos ${fmt(circ.validos)}.`,
    "Partidos más votados: " + partidos.map((p) => `${p.nombre} ${fmt(p.votos)} (${p.pct}${p.curules ? `, ${p.curules} curules` : ""})`).join("; "),
    candidatos.length ? "Candidatos más votados: " + candidatos.map(({ k, p }) => `${k.nombre} (${p.nombre}) ${fmt(k.votos)}`).join("; ") : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function ejecutarCandidato(c: Extract<Consulta, { fn: "candidato" }>): Promise<string> {
  const u = await ubicar(c.eleccion, c.cargo, c.territorio);
  if ("ambiguo" in u) return u.ambiguo;
  const v = await getVistaElectoral({ eleccion: c.eleccion, corporacion: c.cargo, ambito: u.codigo });
  const circs = v.resultado?.circunscripciones ?? [];
  let mejor: { circ: Circunscripcion; p: PartidoResultado; k: Candidato } | undefined;
  for (const circ of circs) {
    for (const p of circ.partidos) {
      for (const k of p.candidatos) {
        if (!k.soloLista && mismaPersona(k.nombre, c.nombre) && (!mejor || k.votos > mejor.k.votos)) mejor = { circ, p, k };
      }
    }
  }
  const encabezado = `${v.eleccion.nombre} · ${v.corporacion.nombre} · ${u.etiqueta}`;
  if (!mejor) return `${encabezado}: «${c.nombre}» no aparece entre los candidatos de ese territorio y elección.`;
  const { circ, p, k } = mejor;
  const ranking = listaCandidatos(circ).sort((a, b) => b.k.votos - a.k.votos);
  const puesto = ranking.findIndex((x) => x.k === k) + 1;
  const lineas = [
    `${encabezado}. ${k.nombre} (${p.nombre}): ${fmt(k.votos)} votos, ${k.pct} de los válidos; puesto ${puesto} de ${ranking.length} candidatos${k.electo ? "; obtuvo curul o fue electo" : ""}.`,
  ];
  const votos = await getVotosCandidato({ eleccion: c.eleccion, corporacion: c.cargo, ambito: u.codigo, circunscripcion: circ.codigo, partido: p.codigo, candidato: k.codigo });
  const hijos = votos.hijos.filter((h) => h.votos !== null).sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0));
  if (hijos.length) {
    lineas.push(`Sus votos por subterritorio (${hijos.length}${votos.pendientes ? `, faltaron ${votos.pendientes}` : ""}), de mayor a menor: ` + hijos.slice(0, 10).map((h) => `${h.nombre} ${fmt(h.votos ?? 0)}`).join("; "));
  }
  return lineas.join("\n");
}

async function ejecutarComparar(c: Extract<Consulta, { fn: "comparar" }>): Promise<string> {
  const u = await ubicar(c.eleccionB, c.cargoB, c.territorio);
  if ("ambiguo" in u) return u.ambiguo;
  const cmp = await getComparacion({
    a: { eleccion: c.eleccionA, corporacion: c.cargoA },
    b: { eleccion: c.eleccionB, corporacion: c.cargoB },
    ambito: u.codigo,
    persona: c.nombre,
  });
  if (cmp.noSoportado) return "La comparación funciona para el país, un departamento o un municipio; ese territorio es demasiado pequeño.";
  const t = calcularTransferencia(cmp.filas);
  const nombreDe = (clave: string) => {
    const [id, sigla] = clave.split("|");
    const e = findEleccion(id);
    return `${e?.corporaciones.find((x) => x.sigla === sigla)?.nombre ?? sigla} ${e?.fecha.slice(0, 4) ?? ""}`.trim();
  };
  if (t.votosA === 0 && t.votosB === 0) return `«${c.nombre}» no aparece en ${nombreDe(cmp.a.clave)} ni en ${nombreDe(cmp.b.clave)} en ${u.etiqueta}.`;
  const f = (x: (typeof t.filas)[number]) => `${x.nombre} ${fmt(x.a.votos)}→${fmt(x.b.votos)} (${x.delta >= 0 ? "+" : ""}${fmt(x.delta)})`;
  return [
    `Cambio de ${cmp.b.nombre ?? cmp.a.nombre ?? c.nombre} entre ${nombreDe(cmp.a.clave)} y ${nombreDe(cmp.b.clave)} (de la más antigua a la más reciente) en ${u.etiqueta}, por ${cmp.filas.length} de ${cmp.total} territorios${cmp.pendientes ? ` (faltaron ${cmp.pendientes})` : ""}.`,
    `Votos ${fmt(t.votosA)} → ${fmt(t.votosB)} (${t.delta >= 0 ? "+" : ""}${fmt(t.delta)}); cuota ${t.cuotaA.toFixed(1)}% → ${t.cuotaB.toFixed(1)}% de los válidos. Creció en ${t.crecimiento.territorios} territorios y cayó en ${t.fugas.territorios}.`,
    t.filas.some((x) => x.delta < 0) ? "Mayores caídas: " + t.filas.filter((x) => x.delta < 0).slice(0, 5).map(f).join("; ") : "",
    t.filas.some((x) => x.delta > 0) ? "Mayores crecimientos: " + [...t.filas].reverse().filter((x) => x.delta > 0).slice(0, 5).map(f).join("; ") : "",
    t.herederos.length ? "Partidos que ganaron donde bajó: " + t.herederos.slice(0, 3).map((h) => `${h.partido} +${fmt(h.ganados)}`).join("; ") : "",
    "(Es el cambio entre territorios, no un flujo de electores.)",
  ]
    .filter(Boolean)
    .join("\n");
}

function describir(c: Consulta): string {
  const lugar = (t?: string) => t ?? "todo el país";
  const nombre = (id: string, sigla: string) => `${findEleccion(id)?.corporaciones.find((x) => x.sigla === sigla)?.nombre ?? sigla} ${findEleccion(id)?.fecha.slice(0, 4) ?? ""}`.trim();
  if (c.fn === "resultados") return `Resultados de ${nombre(c.eleccion, c.cargo)} en ${lugar(c.territorio)}`;
  if (c.fn === "candidato") return `Votos de ${c.nombre} en ${nombre(c.eleccion, c.cargo)}, ${lugar(c.territorio)}`;
  return `Cambio de ${c.nombre} entre ${nombre(c.eleccionA, c.cargoA)} y ${nombre(c.eleccionB, c.cargoB)}, ${lugar(c.territorio)}`;
}

export async function ejecutarConsulta(c: Consulta): Promise<Hecha> {
  const descripcion = describir(c);
  try {
    const datos = c.fn === "resultados" ? await ejecutarResultados(c) : c.fn === "candidato" ? await ejecutarCandidato(c) : await ejecutarComparar(c);
    return { descripcion, ok: true, datos };
  } catch (err) {
    return { descripcion, ok: false, datos: `La consulta falló: ${err instanceof Error ? err.message : "error desconocido"}.` };
  }
}

export async function preguntar(pregunta: string, generar: Generar = generarTexto): Promise<Respuesta> {
  const bruto = await generar({ system: SISTEMA_PLAN(), user: pregunta, maxTokens: 800 });
  const plan = validarPlan(extraerJson(bruto));
  if (plan.consultas.length === 0) {
    const respuesta = await generar({
      system: SISTEMA_RESPUESTA,
      user: `Pregunta: ${pregunta}\n\nNo se pudo armar ninguna consulta con los datos disponibles.${plan.motivo ? ` Motivo: ${plan.motivo}` : ""}${plan.avisos.length ? ` ${plan.avisos.join(" ")}` : ""}\nExplica al usuario qué datos sí hay (resultados, votos de un candidato por territorio y cambio entre elecciones, de 2018 a 2026) y cómo reformular la pregunta.`,
      maxTokens: 600,
    });
    return { respuesta, consultas: [] };
  }
  const consultas: Hecha[] = [];
  for (const c of plan.consultas) consultas.push(await ejecutarConsulta(c));
  const respuesta = await generar({
    system: SISTEMA_RESPUESTA,
    user: `Pregunta: ${pregunta}\n\nDatos oficiales:\n${consultas.map((h, i) => `[${i + 1}] ${h.descripcion}\n${h.datos}`).join("\n\n")}${plan.avisos.length ? `\n\nAvisos: ${plan.avisos.join(" ")}` : ""}`,
    maxTokens: 1200,
  });
  return { respuesta, consultas };
}
