import { NextResponse } from "next/server";
import { z } from "zod";

import { SQL_TERRITORIO } from "@/lib/territorio/sql";
import { FUENTES_CARGA, INDICADORES } from "@/lib/territorio/catalogo";
import { cargarFuente } from "@/lib/territorio/fuentes";
import { estadoDeFuentes } from "@/lib/territorio/indicadores";

export const runtime = "nodejs";
// Cada fuente son unas pocas consultas agregadas al portal de datos abiertos y unas miles de filas a Supabase.
export const maxDuration = 60;

const editorSql = () => {
  const ref = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : "";
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : undefined;
};

/** Qué fuentes hay y cuánto de cada una está guardado en Supabase (o el SQL para crear la tabla, si falta). */
export async function GET() {
  try {
    const { tabla, fuentes } = await estadoDeFuentes();
    const resumen = Object.entries(FUENTES_CARGA).map(([clave, f]) => {
      const propias = fuentes.filter((x) => f.indicadores.includes(x.indicador));
      return {
        clave,
        nombre: f.nombre,
        indicadores: f.indicadores.map((i) => INDICADORES[i]?.etiqueta ?? i),
        filas: propias.reduce((s, x) => s + x.filas, 0),
        corte: propias.map((x) => x.corte).filter(Boolean).sort().at(-1) ?? null,
        actualizadoEn: propias.map((x) => x.actualizadoEn).filter(Boolean).sort().at(-1) ?? null,
      };
    });
    return NextResponse.json(tabla ? { tabla, fuentes: resumen } : { tabla, fuentes: resumen, sql: SQL_TERRITORIO, editorSql: editorSql() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer el estado de las fuentes." }, { status: 502 });
  }
}

const cuerpo = z.object({ fuente: z.string().refine((f) => f in FUENTES_CARGA, "Fuente no válida.") });

/** POST { fuente }: trae esa fuente de datos.gov.co y la guarda en Supabase. */
export async function POST(req: Request) {
  const p = cuerpo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  try {
    return NextResponse.json(await cargarFuente(p.data.fuente));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible cargar la fuente." }, { status: 502 });
  }
}
