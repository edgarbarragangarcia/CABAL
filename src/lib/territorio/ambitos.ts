import "server-only";

import { ELECCIONES_DATA, GEOS } from "@/data/elecciones";
import { findEleccion } from "@/lib/gov-data/elecciones/catalogo";
import type { Circunscripcion, PartidoResultado, Candidato, Resultado } from "@/lib/gov-data/elecciones/resultados";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ambitosDe, normalizar } from "./jerarquia";
import { ELECCIONES_TERRITORIO, resumirResultado, type EleccionLugar } from "./votacion";

/**
 * Votos de una localidad o comuna, un barrio o un puesto de votación, leídos de Supabase (nunca de la fuente):
 *  - localidad o comuna: la suma de sus zonas del nomenclátor de cada elección;
 *  - barrio: la suma de sus puestos;
 *  - puesto: él mismo.
 * Cada elección tiene su propio nomenclátor, así que los códigos se buscan por zona y por nombre del puesto en el de cada una.
 */

type Fila = [string, string, number, number, number, string?];
type Indice = { zonas: Map<string, string>; puestos: Map<string, string> };
const indices = new Map<string, Promise<Indice | null>>();

const nn = (nombre: string) => (/(\d+)\s*$/.exec(nombre)?.[1] ?? "").padStart(2, "0");

function indiceDe(geoKey: string, dane: string): Promise<Indice | null> {
  const k = `${geoKey}|${dane}`;
  let p = indices.get(k);
  if (!p) {
    p = GEOS[geoKey]().then(({ default: d }) => {
      const filas = d as Fila[];
      const mpio = filas.findIndex((r) => r[2] === 3 && r[5] === dane);
      if (mpio < 0) return null;
      const zonas = new Map<string, string>();
      const puestos = new Map<string, string>();
      filas.forEach((r, i) => {
        if (r[4] !== mpio || (r[2] !== 4 && r[2] !== 5)) return;
        const z = nn(r[1]);
        zonas.set(z, r[0]);
        filas.forEach((q) => q[4] === i && q[2] === 6 && (puestos.set(`${z}|${normalizar(q[1])}`, q[0]), puestos.has(normalizar(q[1])) ? puestos.set(normalizar(q[1]), "") : puestos.set(normalizar(q[1]), q[0])));
      });
      return { zonas, puestos };
    });
    indices.set(k, p);
  }
  return p;
}

const pct = (v: number, t: number) => (t > 0 ? ((v / t) * 100).toFixed(2) : "0");

/** Suma varios resultados de una misma elección y cargo (zonas o puestos) en uno. */
export function sumarResultados(rs: Resultado[]): Resultado {
  const circ = new Map<string, Circunscripcion>();
  for (const r of rs) {
    for (const c of r.circunscripciones) {
      const t = circ.get(c.codigo) ?? { codigo: c.codigo, curules: c.curules, votantes: 0, validos: 0, blancos: 0, pctBlancos: "0", partidos: [], mapa: [] };
      t.votantes += c.votantes;
      t.validos += c.validos;
      t.blancos += c.blancos;
      for (const p of c.partidos) {
        let q = t.partidos.find((x) => x.codigo === p.codigo && x.nombre === p.nombre);
        if (!q) t.partidos.push((q = { ...p, votos: 0, curules: 0, candidatos: [] } as PartidoResultado));
        q.votos += p.votos;
        for (const k of p.candidatos) {
          let z = q.candidatos.find((x) => x.codigo === k.codigo && x.nombre === k.nombre);
          if (!z) q.candidatos.push((z = { ...k, votos: 0 } as Candidato));
          z.votos += k.votos;
        }
      }
      circ.set(c.codigo, t);
    }
  }
  const cs = [...circ.values()];
  for (const c of cs) {
    c.pctBlancos = pct(c.blancos, c.validos);
    for (const p of c.partidos) p.pct = pct(p.votos, c.validos);
  }
  const sum = (f: (r: Resultado) => number) => rs.reduce((s, r) => s + f(r), 0);
  return {
    corte: rs[0]?.corte ?? "",
    mesas: { total: sum((r) => r.mesas.total), informadas: sum((r) => r.mesas.informadas), pct: "" },
    censo: sum((r) => r.censo),
    votantes: sum((r) => r.votantes),
    participacion: "",
    nulos: sum((r) => r.nulos),
    noMarcados: sum((r) => r.noMarcados),
    curules: 0,
    circunscripciones: cs,
  };
}

/** Las elecciones de un lugar sub-municipal (id de `jerarquia.ts`). */
export async function eleccionesDeAmbito(id: string, dane: string): Promise<EleccionLugar[]> {
  const c = getSupabaseServerClient();
  if (!c) throw new Error("Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  const ambitos = await ambitosDe(id);
  if (!ambitos) return [];
  const porZonas = ambitos.zonas.length > 0;

  return Promise.all(
    ELECCIONES_TERRITORIO.map(async (e): Promise<EleccionLugar> => {
      const info = findEleccion(e.id);
      const vacio = { id: e.id, titulo: e.titulo, fecha: info?.fecha ?? "", corporacion: e.corporacion, validos: 0, partidos: [], candidatos: [], cabal: null, listaCerrada: false, partidoCabal: null, oposicion: null, ventajaOposicion: null };
      const datos = (await ELECCIONES_DATA[e.id as keyof typeof ELECCIONES_DATA]()).default as unknown as { corporaciones: { sigla: string; geo: string }[] };
      const geoKey = datos.corporaciones.find((x) => x.sigla === e.corporacion)?.geo;
      const ix = geoKey ? await indiceDe(geoKey, dane) : null;
      if (!ix) return { ...vacio, guardado: false };

      const codigos = porZonas
        ? ambitos.zonas.map((z) => ix.zonas.get(z))
        : ambitos.puestos.map((p) => ix.puestos.get(`${p.zona}|${normalizar(p.nombre)}`) || ix.puestos.get(normalizar(p.nombre)));
      const lista = [...new Set(codigos.filter((x): x is string => !!x))];
      const esperados = porZonas ? ambitos.zonas.length : ambitos.puestos.length;
      if (lista.length === 0) return { ...vacio, guardado: false, cobertura: { total: esperados, guardados: 0 } };

      const { data, error } = await c.from("resultados_electorales").select("vacio, datos").eq("eleccion", e.id).eq("corporacion", e.corporacion).in("ambito", lista);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as { vacio: boolean; datos: Resultado | null }[];
      const buenos = filas.filter((f) => !f.vacio && f.datos).map((f) => f.datos as Resultado);
      const cobertura = { total: esperados, guardados: buenos.length };
      if (buenos.length === 0) return { ...vacio, guardado: false, cobertura };
      return { ...vacio, ...resumirResultado(buenos.length === 1 ? buenos[0] : sumarResultados(buenos)), guardado: true, cobertura };
    })
  );
}
