import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { getVistaElectoral, getVotosCandidato } from "@/lib/gov-data/elecciones/resultados";

export const maxDuration = 60;

const MODEL = "claude-opus-5-5";

/**
 * Análisis con IA de los votos de un candidato en un territorio: dónde es
 * fuerte, dónde flojo y dónde tiene margen de mejora. Solo con los datos
 * oficiales del preconteo que se le pasan; no inventa cifras.
 * POST { e, c, a, circ, p, k }
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body?.e || !body.c || !body.p || !body.k) {
    return NextResponse.json({ error: "Faltan la elección, el cargo o el candidato." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY en Vercel." }, { status: 503 });
  }
  try {
    const params = { eleccion: body.e, corporacion: body.c, ambito: body.a || null };
    const [vista, votos] = await Promise.all([
      getVistaElectoral(params),
      getVotosCandidato({ ...params, circunscripcion: body.circ ?? "", partido: body.p, candidato: body.k }),
    ]);
    const circ =
      vista.resultado?.circunscripciones.find((x) => x.codigo === body.circ) ?? vista.resultado?.circunscripciones[0];
    const partido = circ?.partidos.find((x) => x.codigo === body.p);
    const candidato = partido?.candidatos.find((x) => x.codigo === body.k);
    if (!circ || !partido || !candidato) {
      return NextResponse.json({ error: "El candidato no aparece en este territorio." }, { status: 404 });
    }
    const ranking = circ.partidos
      .flatMap((x) => x.candidatos.filter((k) => !k.soloLista))
      .sort((a, b) => b.votos - a.votos);
    const lista = partido.candidatos.filter((k) => !k.soloLista).sort((a, b) => b.votos - a.votos);
    const hijos = votos.hijos
      .filter((h) => h.votos !== null)
      .sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0))
      .map((h) => `${h.nombre}: ${h.votos} votos (${h.pct || "s/d"} de los válidos)`);

    const datos = [
      `Elección: ${vista.eleccion.nombre} · ${vista.corporacion.nombre}`,
      `Territorio: ${vista.ruta.map((r) => r.nombre).join(" > ")}`,
      `Candidato: ${candidato.nombre} (${partido.nombre})${candidato.electo ? " — obtuvo curul" : ""}`,
      `Votos del candidato aquí: ${candidato.votos} (${candidato.pct} de los válidos)`,
      `Puesto entre ${ranking.length} candidatos: #${ranking.findIndex((k) => k === candidato) + 1}`,
      `Votos de su partido aquí: ${partido.votos} (${partido.pct}); puesto dentro de su lista: #${lista.indexOf(candidato) + 1} de ${lista.length}`,
      `Votantes del territorio: ${vista.resultado!.votantes}; participación ${vista.resultado!.participacion}`,
      `Votos por ${vista.hijos.length ? "subdivisión" : "—"} (de mayor a menor)${votos.pendientes ? `, faltan ${votos.pendientes} sin consultar` : ""}:`,
      ...hijos,
    ].join("\n");

    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system:
        "Eres analista electoral en Colombia. Analiza SOLO con los datos oficiales que te dan (preconteo de la Registraduría); no inventes cifras, encuestas ni datos demográficos. Escribe en español, claro y accionable, con estas secciones en markdown: '## Resumen', '## Dónde es fuerte', '## Dónde debe mejorar' (territorios con pocos votos o bajo porcentaje frente a su promedio, con cifras), '## Recomendaciones' (3 a 5, concretas y ligadas a los territorios). Si faltan datos, dilo.",
      messages: [{ role: "user", content: datos }],
    });
    const texto = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
    return NextResponse.json({ analisis: texto });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible generar el análisis." },
      { status: 502 }
    );
  }
}
