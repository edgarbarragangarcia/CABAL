import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";

import type { CrmField, CrmContact, CrmSnapshot, Dimension } from "./types";

/**
 * La red de relaciones armada con los leads que ya están guardados en Supabase (tabla crm_leads, ver supabase/crm.sql): no depende de que
 * Bitrix24 responda y es mucho más rápida. Los campos que sirven para relacionar a las personas se agrupan en las mismas cuatro formas
 * de relación que usa la red (lugar, intereses, actividades). Se toman hasta 5.000 leads con ciudad (los más recientes).
 */
const TOPE = 5_000;
const PAGINA = 1_000;

/** Columna de crm_leads → cómo se llama el campo y qué relación expresa. */
const CAMPOS: { columna: string; etiqueta: string; auto: Dimension }[] = [
  { columna: "ciudad", etiqueta: "Ciudad", auto: "lugar" },
  { columna: "departamento", etiqueta: "Departamento", auto: "lugar" },
  { columna: "barrio", etiqueta: "Barrio", auto: "lugar" },
  { columna: "gremio", etiqueta: "Gremio", auto: "intereses" },
  { columna: "profesion", etiqueta: "Profesión", auto: "intereses" },
  { columna: "corporacion", etiqueta: "Corporación", auto: "intereses" },
  { columna: "origen_base", etiqueta: "Origen de la base", auto: "actividades" },
  { columna: "base", etiqueta: "Base", auto: "actividades" },
  { columna: "anio_campana", etiqueta: "Año de campaña", auto: "actividades" },
];

type Fila = Record<string, string | number | null>;

/** null si no hay Supabase, no existe la tabla o no tiene leads: ahí se usa Bitrix24 como antes. */
export async function snapshotDesdeSupabase(): Promise<CrmSnapshot | null> {
  const c = getSupabaseServerClient();
  if (!c) return null;
  try {
    const { count, error: eCount } = await c.from("crm_leads").select("id", { count: "exact", head: true });
    if (eCount || !count) return null;

    const columnas = ["id", "nombre", ...CAMPOS.map((x) => x.columna)].join(", ");
    const filas: Fila[] = [];
    for (let desde = 0; desde < TOPE; desde += PAGINA) {
      const { data, error } = await c.from("crm_leads").select(columnas).not("ciudad", "is", null).order("id", { ascending: false }).range(desde, desde + PAGINA - 1);
      if (error) return null;
      filas.push(...((data ?? []) as unknown as Fila[]));
      if ((data?.length ?? 0) < PAGINA) break;
    }
    if (filas.length === 0) return null;

    const indices = CAMPOS.map(() => new Map<string, number>());
    const campos: CrmField[] = CAMPOS.map((x) => ({ key: x.columna, label: x.etiqueta, type: "string", auto: x.auto, values: [], filled: 0 }));
    const contactos: CrmContact[] = filas.map((f) => {
      const v: [number, number[]][] = [];
      CAMPOS.forEach((x, i) => {
        const valor = f[x.columna];
        if (typeof valor !== "string" || !valor.trim()) return;
        const limpio = valor.trim();
        let k = indices[i].get(limpio);
        if (k === undefined) {
          k = campos[i].values.length;
          campos[i].values.push(limpio);
          indices[i].set(limpio, k);
        }
        campos[i].filled++;
        v.push([i, [k]]);
      });
      return { id: String(f.id), name: typeof f.nombre === "string" && f.nombre ? f.nombre : `Lead #${f.id}`, v };
    });
    // Los campos sin ningún valor no aportan: se quitan y se renumeran.
    const usados = campos.map((cm, i) => (cm.filled > 0 ? i : -1)).filter((i) => i >= 0);
    const nuevo = new Map(usados.map((viejo, n) => [viejo, n]));
    return {
      portal: "Supabase (leads guardados)",
      fetchedAt: new Date().toISOString(),
      entidad: "lead",
      total: count,
      fields: usados.map((i) => campos[i]),
      contacts: contactos.map((ct) => ({ ...ct, v: ct.v.map(([i, vs]) => [nuevo.get(i)!, vs] as [number, number[]]) })),
    };
  } catch {
    return null;
  }
}
