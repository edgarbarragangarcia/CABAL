import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { ErrorPortales } from "../store";
import { hoyColombia } from "./puro";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;

export type PuntoDia = { dia: string; vistas: number; cta: number; anuncio: number; contactos: number };
export type Analitica = {
  dias: number;
  serie: PuntoDia[];
  totales: { vistas: number; cta: number; anuncioClics: number; contactosNuevos: number };
  /** Contra el periodo anterior de la misma duración (en %, null si antes no hubo nada). */
  cambios: { vistas: number | null; contactos: number | null };
  topArticulos: { id: string; titulo: string; slug: string; vistas: number; publicadoEn: string | null }[];
  eventos: { id: string; titulo: string; iniciaEn: string; inscritos: number; asistentes: number }[];
};

function db() {
  const c = getSupabaseServerClient();
  if (!c) throw new ErrorPortales("sin_db", "Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).");
  return c;
}

const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** El día (en Colombia, UTC-5) de un instante. */
const diaDe = (instante: string) => new Date(new Date(instante).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);

const cambio = (actual: number, anterior: number) => (anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null);

/** Cifras del portal en los últimos `dias` días (7, 30 o 90), con la serie diaria completa y la comparación con el periodo anterior. */
export async function analiticaDe(portalId: string, dias: number): Promise<Analitica> {
  const c = db();
  const n = [7, 30, 90].includes(dias) ? dias : 30;
  const hoy = hoyColombia();
  const desde = sumarDias(hoy, -(n - 1));
  const desdeAnterior = sumarDias(desde, -n);

  const [m, ct, top, ev] = await Promise.all([
    c.from("portal_metricas").select("dia,vistas,cta_clics,anuncio_clics").eq("portal_id", portalId).gte("dia", desdeAnterior).limit(400),
    c.from("portal_contactos").select("creado_en").eq("portal_id", portalId).gte("creado_en", `${desdeAnterior}T00:00:00-05:00`).limit(10_000),
    c.from("portal_articulos").select("id,titulo,slug,vistas,publicado_en").eq("portal_id", portalId).eq("estado", "publicado").order("vistas", { ascending: false }).limit(8),
    c.from("portal_eventos").select("id,titulo,inicia_en").eq("portal_id", portalId).order("inicia_en", { ascending: false }).limit(6),
  ]);
  if (m.error && !/does not exist|schema cache/i.test(m.error.message)) throw new ErrorPortales("invalido", "No fue posible leer las métricas.");

  const porDia = new Map<string, PuntoDia>();
  for (let i = 0; i < n; i++) {
    const dia = sumarDias(desde, i);
    porDia.set(dia, { dia, vistas: 0, cta: 0, anuncio: 0, contactos: 0 });
  }
  let vistasAnt = 0;
  for (const f of (m.data ?? []) as Fila[]) {
    if (f.dia < desde) vistasAnt += f.vistas ?? 0;
    else {
      const p = porDia.get(f.dia);
      if (p) {
        p.vistas += f.vistas ?? 0;
        p.cta += f.cta_clics ?? 0;
        p.anuncio += f.anuncio_clics ?? 0;
      }
    }
  }
  let contactosAnt = 0;
  for (const f of (ct.data ?? []) as Fila[]) {
    const dia = diaDe(f.creado_en);
    if (dia < desde) contactosAnt += 1;
    else {
      const p = porDia.get(dia);
      if (p) p.contactos += 1;
    }
  }
  const serie = [...porDia.values()];
  const totales = serie.reduce((t, p) => ({ vistas: t.vistas + p.vistas, cta: t.cta + p.cta, anuncioClics: t.anuncioClics + p.anuncio, contactosNuevos: t.contactosNuevos + p.contactos }), { vistas: 0, cta: 0, anuncioClics: 0, contactosNuevos: 0 });

  // Inscritos y asistentes de los eventos recientes.
  const eventos: Analitica["eventos"] = [];
  const eventosFilas = (ev.data ?? []) as Fila[];
  if (eventosFilas.length > 0) {
    const { data: ins } = await c.from("portal_inscripciones").select("evento_id,estado").eq("portal_id", portalId).in("evento_id", eventosFilas.map((e) => e.id)).limit(10_000);
    const cuenta = new Map<string, { i: number; a: number }>();
    for (const f of (ins ?? []) as Fila[]) {
      const x = cuenta.get(f.evento_id) ?? { i: 0, a: 0 };
      if (f.estado !== "cancelado") x.i += 1;
      if (f.estado === "asistio") x.a += 1;
      cuenta.set(f.evento_id, x);
    }
    for (const e of eventosFilas) eventos.push({ id: e.id, titulo: e.titulo, iniciaEn: e.inicia_en, inscritos: cuenta.get(e.id)?.i ?? 0, asistentes: cuenta.get(e.id)?.a ?? 0 });
  }

  return {
    dias: n,
    serie,
    totales,
    cambios: { vistas: cambio(totales.vistas, vistasAnt), contactos: cambio(totales.contactosNuevos, contactosAnt) },
    topArticulos: ((top.data ?? []) as Fila[]).map((f) => ({ id: f.id, titulo: f.titulo, slug: f.slug, vistas: f.vistas ?? 0, publicadoEn: f.publicado_en ?? null })),
    eventos,
  };
}
