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

/** Los leads de Supabase, o el motivo por el que no se pudo (sin Supabase, sin tabla, tabla vacía…): entonces se usa Bitrix24 como antes. */
export type DesdeSupabase = { snapshot: CrmSnapshot } | { motivo: string };

/** Copia en memoria: la red se arma con miles de leads y no cambia entre un clic y otro. `refresh` la ignora. */
let guardada: { en: number; datos: DesdeSupabase } | null = null;
const VIGENCIA_MS = 10 * 60_000;

export async function snapshotDesdeSupabase({ refresh = false } = {}): Promise<DesdeSupabase> {
  if (!refresh && guardada && Date.now() - guardada.en < VIGENCIA_MS && "snapshot" in guardada.datos) return guardada.datos;
  const datos = await armar();
  if ("snapshot" in datos) guardada = { en: Date.now(), datos };
  return datos;
}

async function armar(): Promise<DesdeSupabase> {
  const c = getSupabaseServerClient();
  if (!c) return { motivo: "El servidor no tiene conexión con Supabase (faltan SUPABASE_URL y la llave de servicio)." };
  try {
    // El conteo estimado es instantáneo, pero tras una carga masiva puede venir en cero hasta que Postgres actualiza sus estadísticas: si pasa, se cuenta bien.
    let { count, error: eCount } = await c.from("crm_leads").select("id", { count: "estimated", head: true });
    if (!eCount && !count) ({ count, error: eCount } = await c.from("crm_leads").select("id", { count: "exact", head: true }));
    if (eCount) {
      const falta = /does not exist|could not find the table|PGRST205|42P01/i.test(`${eCount.code ?? ""} ${eCount.message}`);
      return { motivo: falta ? "En Supabase falta la tabla crm_leads: ejecuta supabase/crm.sql en el SQL Editor del proyecto." : `Supabase no dejó leer crm_leads (${eCount.message}).` };
    }
    if (!count) return { motivo: "La tabla crm_leads de Supabase está vacía: se llena en Red Cabal → Todos los leads → «Guardar todos los leads»." };

    const columnas = ["id", "nombre", ...CAMPOS.map((x) => x.columna)].join(", ");
    // Las páginas se piden todas a la vez (antes, una tras otra): 5 consultas de ~0,5 s pasan de 2,5 s a 0,5 s.
    const paginas = await Promise.all(
      Array.from({ length: TOPE / PAGINA }, (_, i) => c.from("crm_leads").select(columnas).not("ciudad", "is", null).order("id", { ascending: false }).range(i * PAGINA, (i + 1) * PAGINA - 1))
    );
    const falla = paginas.find((r) => r.error);
    if (falla?.error) return { motivo: `Supabase no dejó leer los leads (${falla.error.message}).` };
    const filas: Fila[] = paginas.flatMap((r) => (r.data ?? []) as unknown as Fila[]);
    if (filas.length === 0) return { motivo: "Ningún lead guardado en Supabase tiene ciudad." };

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
      snapshot: {
        portal: "Supabase (leads guardados)",
        fetchedAt: new Date().toISOString(),
        entidad: "lead",
        total: count,
        fields: usados.map((i) => campos[i]),
        contacts: contactos.map((ct) => ({ ...ct, v: ct.v.map(([i, vs]) => [nuevo.get(i)!, vs] as [number, number[]]) })),
      },
    };
  } catch (e) {
    return { motivo: `No se pudo leer Supabase (${e instanceof Error ? e.message : "error"}).` };
  }
}
