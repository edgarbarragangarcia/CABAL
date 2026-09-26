import { NextResponse } from "next/server";

import { SEGMENTO_NOMBRE, calcularOportunidad } from "@/lib/gov-data/elecciones/oportunidad";
import { getDatosOportunidad, getVistaElectoral, getVotosCandidato } from "@/lib/gov-data/elecciones/resultados";
import { generarTexto } from "@/lib/ia-config";

export const maxDuration = 60;

/**
 * Análisis con IA de los votos de un candidato en un territorio: dónde es
 * fuerte, dónde flojo y dónde tiene margen de mejora. Solo con los datos
 * oficiales del preconteo que se le pasan; no inventa cifras.
 * POST { e, c, a, circ, p, k, oportunidad? }. Con `oportunidad`, agrega el cálculo por puesto
 * de votación (ver oportunidad.ts) y pide un plan de trabajo por puestos.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body?.e || !body.c || !body.p || !body.k) {
    return NextResponse.json({ error: "Faltan la elección, el cargo o el candidato." }, { status: 400 });
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

    // Oportunidad por puesto (solo bajo un municipio); usa los archivos ya en caché o los consulta.
    let oportunidad = "";
    if (body.oportunidad) {
      const d = await getDatosOportunidad({ ...params, circunscripcion: body.circ ?? "", partido: body.p, candidato: body.k });
      if (d.demasiados) {
        return NextResponse.json({ error: "Elige un municipio, una localidad o una zona: hay demasiados puestos." }, { status: 400 });
      }
      const o = calcularOportunidad(d.puestos);
      const pc = (n: number) => `${(n * 100).toFixed(1)}%`;
      oportunidad = [
        "",
        `OPORTUNIDAD POR PUESTO DE VOTACIÓN (${o.puestos.length} de ${d.total} puestos${d.pendientes ? `; faltaron ${d.pendientes} por consultar` : ""}):`,
        `Participación media ${pc(o.participacionMedia)}; cuota media del candidato ${pc(o.cuotaMedia)}; votos por ganar (si cada puesto votara como el promedio) ${o.potencialTotal}.`,
        "Perfiles: " + o.segmentos.map((x) => `${SEGMENTO_NOMBRE[x.segmento]} ${x.puestos} puestos (${x.potencial} por ganar)`).join("; "),
        "Los 15 puestos con más votos por ganar:",
        ...o.puestos
          .slice(0, 15)
          .map(
            (x) =>
              `- ${x.nombre}${x.zona ? ` (${x.zona})` : ""}: ${x.votos} votos, cuota ${pc(x.cuota)}, participación ${pc(x.participacion)}, abstención ${x.abstencion}, por ganar ${Math.round(x.potencial)}, perfil ${SEGMENTO_NOMBRE[x.segmento]}`
          ),
      ].join("\n");
    }

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
    ].join("\n") + oportunidad;

    const texto = await generarTexto({
      maxTokens: 2000,
      system:
        (body.oportunidad
          ? "Eres analista electoral en Colombia. Con los datos oficiales que te dan (preconteo de la Registraduría), arma un plan de trabajo por puestos de votación. Explica en '## Dónde está la oportunidad' cuántos votos hay por ganar y en qué puestos concentrarse, en '## Por perfil' qué hacer en Movilizar, Persuadir, Bastión y Difícil, y en '## Prioridades' una lista de 5 a 8 puestos con la acción concreta para cada uno. Usa solo las cifras dadas; 'por ganar' es aritmética (abstención al promedio × cuota), no una proyección: dilo. No inventes causas demográficas ni encuestas. Español, claro."
          : "Eres analista electoral en Colombia. Analiza SOLO con los datos oficiales que te dan (preconteo de la Registraduría); no inventes cifras, encuestas ni datos demográficos. Escribe en español, claro y accionable, con estas secciones en markdown: '## Resumen', '## Dónde es fuerte', '## Dónde debe mejorar' (territorios con pocos votos o bajo porcentaje frente a su promedio, con cifras), '## Recomendaciones' (3 a 5, concretas y ligadas a los territorios). Si faltan datos, dilo."),
      user: datos,
    });
    return NextResponse.json({ analisis: texto });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible generar el análisis." },
      { status: 502 }
    );
  }
}
