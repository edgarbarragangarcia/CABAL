import "server-only";

import { getSupabaseServerClient } from "./supabase-server";

/**
 * Registro guardado de la revisión de un candidato para Avales: las 3
 * verificaciones manuales (no automatizables, ver `gov-data/avales.ts`) y el
 * veredicto final. Vive en una tabla propia de Supabase (`avales_revisiones`)
 * porque es un registro de decisión que debe verse igual desde cualquier
 * sesión del panel, no un borrador de un solo navegador. Igual que
 * `supabase-server.ts`, degrada con gracia (`configured: false`) si el
 * proyecto de Supabase de CABAL aún no está conectado.
 */

export type EstadoRevision = "no_revisado" | "verificado_sin_novedad" | "verificado_con_novedad";
export type Atestacion = { estado: EstadoRevision; nota: string; url: string };
export type Atestaciones = {
  antecedentesJudiciales: Atestacion;
  certificadoProcuraduria: Atestacion;
  certificadoContraloria: Atestacion;
};
export type Veredicto = "pendiente" | "aval_recomendado" | "aval_no_recomendado";

export type RevisionAval = {
  cedula: string;
  nombre: string;
  atestaciones: Atestaciones;
  veredicto: Veredicto;
  notaVeredicto: string;
  revisadoPor: string | null;
  actualizadoEn: string;
};

type FilaRevision = {
  cedula: string;
  nombre: string | null;
  atestaciones: Partial<Atestaciones> | null;
  veredicto: Veredicto | null;
  nota_veredicto: string | null;
  revisado_por: string | null;
  actualizado_en: string;
};

const TABLA = "avales_revisiones";

const ATESTACION_VACIA: Atestacion = { estado: "no_revisado", nota: "", url: "" };

const atestacionesVacias = (): Atestaciones => ({
  antecedentesJudiciales: { ...ATESTACION_VACIA },
  certificadoProcuraduria: { ...ATESTACION_VACIA },
  certificadoContraloria: { ...ATESTACION_VACIA },
});

function desdeFila(fila: FilaRevision): RevisionAval {
  const base = atestacionesVacias();
  const guardadas = fila.atestaciones ?? {};
  return {
    cedula: fila.cedula,
    nombre: fila.nombre ?? "",
    atestaciones: {
      antecedentesJudiciales: { ...base.antecedentesJudiciales, ...guardadas.antecedentesJudiciales },
      certificadoProcuraduria: { ...base.certificadoProcuraduria, ...guardadas.certificadoProcuraduria },
      certificadoContraloria: { ...base.certificadoContraloria, ...guardadas.certificadoContraloria },
    },
    veredicto: fila.veredicto ?? "pendiente",
    notaVeredicto: fila.nota_veredicto ?? "",
    revisadoPor: fila.revisado_por,
    actualizadoEn: fila.actualizado_en,
  };
}

export async function getRevisionAval(cedula: string): Promise<{ configured: boolean; revision: RevisionAval | null }> {
  const client = getSupabaseServerClient();
  if (!client) return { configured: false, revision: null };

  const { data, error } = await client.from(TABLA).select("*").eq("cedula", cedula).maybeSingle();
  if (error) throw new Error(`No fue posible leer la revisión guardada: ${error.message}`);
  return { configured: true, revision: data ? desdeFila(data as FilaRevision) : null };
}

export async function saveRevisionAval(input: {
  cedula: string;
  nombre: string;
  atestaciones: Atestaciones;
  veredicto: Veredicto;
  notaVeredicto: string;
  revisadoPor: string | null;
}): Promise<{ configured: boolean; revision?: RevisionAval }> {
  const client = getSupabaseServerClient();
  if (!client) return { configured: false };

  const { data, error } = await client
    .from(TABLA)
    .upsert(
      {
        cedula: input.cedula,
        nombre: input.nombre,
        atestaciones: input.atestaciones,
        veredicto: input.veredicto,
        nota_veredicto: input.notaVeredicto || null,
        revisado_por: input.revisadoPor,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "cedula" }
    )
    .select("*")
    .single();
  if (error) throw new Error(`No fue posible guardar la revisión: ${error.message}`);
  return { configured: true, revision: desdeFila(data as FilaRevision) };
}
