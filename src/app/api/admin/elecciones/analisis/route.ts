import { NextResponse } from "next/server";

import { calcularTransferencia } from "@/lib/gov-data/elecciones/comparacion";
import { SEGMENTO_NOMBRE, calcularOportunidad } from "@/lib/gov-data/elecciones/oportunidad";
import { getComparacion, getDatosOportunidad, getVistaElectoral, getVotosCandidato } from "@/lib/gov-data/elecciones/resultados";
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
    // Base del CRM contra votos: el panel manda cifras agregadas por territorio (sin personas).
    if (body.crm) {
      type Fila = { n: string; v: number; c: number; e: string };
      const r = JSON.parse(body.crm) as { lugar: string; nivel: number; demo: boolean; sinUbicar: number; sinEmparejar: number; filas: Fila[] };
      const datos = [
        `Territorio: ${r.lugar} (por ${r.nivel === 1 ? "departamento" : "municipio"}).${r.demo ? " OJO: el CRM es de ejemplo, con contactos inventados." : ""}`,
        `Contactos sin ubicar: ${r.sinUbicar + r.sinEmparejar}.`,
        "Territorio: votos del candidato · contactos del CRM · lectura",
        ...r.filas.map((f) => `- ${f.n}: ${f.v} votos · ${f.c} contactos · ${f.e}`),
      ].join("\n");
      const texto = await generarTexto({
        maxTokens: 1800,
        system:
          "Eres analista de campaña en Colombia. Con estas cifras agregadas por territorio (votos oficiales del preconteo y contactos de un CRM), explica dónde hay base sin votos (movilizar), votos sin base (construir presencia) y dónde van parejos. Estructura en markdown: '## Resumen', '## Base sin votos', '## Votos sin base', '## Qué hacer'. Usa solo las cifras dadas, no inventes causas ni datos demográficos. Recuerda que los contactos del CRM no son votantes verificados ni todos los simpatizantes. Si el CRM es de ejemplo, dilo al principio. Español, claro y breve.",
        user: datos,
      });
      return NextResponse.json({ analisis: texto });
    }

    // Cambio entre dos elecciones: no necesita ubicar al candidato en una lista.
    if (body.comparar) {
      const c = await getComparacion({
        a: { eleccion: body.ea, corporacion: body.ca },
        b: { eleccion: body.eb, corporacion: body.cb },
        ambito: body.a || null,
        persona: body.persona,
      });
      if (c.noSoportado) {
        return NextResponse.json({ error: "Sube a un país, un departamento o un municipio para comparar." }, { status: 400 });
      }
      const t = calcularTransferencia(c.filas);
      const fila = (f: (typeof t.filas)[number]) =>
        `- ${f.nombre}: ${f.a.votos} → ${f.b.votos} (${f.delta >= 0 ? "+" : ""}${f.delta}); cuota ${f.cuotaA.toFixed(1)}% → ${f.cuotaB.toFixed(1)}%`;
      const datos = [
        `Candidato: ${c.a.nombre ?? body.persona} (${c.a.partido ?? "s/d"}) en la primera elección; ${c.b.nombre ?? "sin datos"} (${c.b.partido ?? "s/d"}) en la segunda.`,
        `Territorio: ${c.ambito.nombre}. Territorios comparados: ${c.filas.length} de ${c.total}${c.pendientes ? ` (faltaron ${c.pendientes})` : ""}.`,
        `Votos: ${t.votosA} → ${t.votosB} (${t.delta >= 0 ? "+" : ""}${t.delta}); cuota ${t.cuotaA.toFixed(1)}% → ${t.cuotaB.toFixed(1)}% de los válidos.`,
        `Cayó en ${t.fugas.territorios} territorios (${t.fugas.votosPerdidos} votos menos) y creció en ${t.crecimiento.territorios} (${t.crecimiento.votosGanados} votos más).`,
        "Mayores caídas:",
        ...t.filas.filter((f) => f.delta < 0).slice(0, 10).map(fila),
        "Mayores crecimientos:",
        ...[...t.filas].reverse().filter((f) => f.delta > 0).slice(0, 10).map(fila),
        "Partidos que más votos sumaron en los territorios donde el candidato bajó:",
        ...t.herederos.map((h) => `- ${h.partido}${h.esPropio ? " (su partido en la segunda elección)" : ""}: +${h.ganados} votos en ${h.territorios} territorios`),
      ].join("\n");
      const texto = await generarTexto({
        maxTokens: 2000,
        system:
          "Eres analista electoral en Colombia. Con los datos oficiales que te dan (preconteo de la Registraduría), explica el cambio de votos de un candidato entre dos elecciones. Estructura en markdown: '## Resumen', '## Dónde perdió y dónde ganó', '## Quién ganó donde perdió' y '## Qué revisar'. Aclara siempre que es un cambio entre territorios y no un flujo de electores: con resultados agregados no se sabe a quién votó cada persona, y la participación y los candidatos cambian entre elecciones. No inventes causas, encuestas ni cifras que no estén en los datos. Español, claro.",
        user: datos,
      });
      return NextResponse.json({ analisis: texto });
    }

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
