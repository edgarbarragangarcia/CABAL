import { NextResponse } from "next/server";

import { indicadores, perfilCandidato } from "@/lib/dane/contexto";
import { FUENTE_DANE, anioDisponible, poblacionDe, poblacionPais } from "@/lib/dane/poblacion";
import { findEleccion } from "@/lib/gov-data/elecciones/catalogo";
import { getVotosCandidato } from "@/lib/gov-data/elecciones/resultados";

// Como /candidato: un departamento son decenas de municipios, un archivo cada uno.
export const maxDuration = 60;

/**
 * Dónde le va mejor a un candidato según el tipo de municipio (ruralidad, tamaño,
 * edades), con la población de cada uno (DANE). Solo país y departamentos: sus
 * hijos son departamentos o municipios, que tienen código DANE.
 * `?e=&c=&a=&circ=&p=&k=`. Si quedan territorios sin consultar (`pendientes`), el
 * cliente vuelve a pedirla.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!q.get("p") || !q.get("k")) return NextResponse.json({ error: "Falta el partido o el candidato." }, { status: 400 });
  try {
    const votos = await getVotosCandidato({
      eleccion: q.get("e") ?? "",
      corporacion: q.get("c") ?? "",
      ambito: q.get("a"),
      circunscripcion: q.get("circ") ?? "",
      partido: q.get("p")!,
      candidato: q.get("k")!,
    });
    const anio = anioDisponible(Number(findEleccion(q.get("e"))?.fecha.slice(0, 4)) || 2026);
    const propia = votos.ambito.nivel === 1 ? poblacionPais(anio) : poblacionDe(votos.ambito.dane, anio);
    const perfil = perfilCandidato(
      votos.hijos.filter((h) => h.votos !== null).map((h) => ({ nombre: h.nombre, votos: h.votos ?? 0, poblacion: poblacionDe(h.dane, anio) }))
    );
    return NextResponse.json(
      {
        ambito: votos.ambito,
        anio,
        fuente: FUENTE_DANE,
        contexto: propia ? indicadores(propia) : null,
        votos: votos.votos,
        perfil,
        total: votos.hijos.length,
        pendientes: votos.pendientes,
      },
      { headers: { "Cache-Control": votos.pendientes ? "no-store" : "private, max-age=600" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No fue posible cargar el contexto." }, { status: 502 });
  }
}
