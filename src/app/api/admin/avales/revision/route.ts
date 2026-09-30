import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import {
  getRevisionAval,
  saveRevisionAval,
  type Atestacion,
  type Atestaciones,
  type EstadoRevision,
  type Veredicto,
} from "@/lib/avales-store";

const ESTADOS = new Set<EstadoRevision>(["no_revisado", "verificado_sin_novedad", "verificado_con_novedad"]);
const VEREDICTOS = new Set<Veredicto>(["pendiente", "aval_recomendado", "aval_no_recomendado"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cedula = (searchParams.get("cedula") ?? "").trim();
  if (!/^\d{3,12}$/.test(cedula)) return NextResponse.json({ error: "Cédula no válida." }, { status: 400 });

  try {
    return NextResponse.json(await getRevisionAval(cedula));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible leer la revisión guardada." },
      { status: 502 }
    );
  }
}

function parseAtestacion(v: unknown): Atestacion | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  if (typeof a.estado !== "string" || !ESTADOS.has(a.estado as EstadoRevision)) return null;
  return {
    estado: a.estado as EstadoRevision,
    nota: typeof a.nota === "string" ? a.nota.slice(0, 2000) : "",
    url: typeof a.url === "string" ? a.url.slice(0, 500) : "",
  };
}

/** Guarda el checklist manual y el veredicto de un candidato. Requiere el proyecto de Supabase de CABAL conectado. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const cedula = typeof body?.cedula === "string" ? body.cedula.trim() : "";
  const nombre = typeof body?.nombre === "string" ? body.nombre.replace(/\s+/g, " ").trim() : "";
  const veredicto = typeof body?.veredicto === "string" ? body.veredicto : "";
  const notaVeredicto = typeof body?.notaVeredicto === "string" ? body.notaVeredicto.slice(0, 4000) : "";

  if (!/^\d{3,12}$/.test(cedula)) return NextResponse.json({ error: "Cédula no válida." }, { status: 400 });
  if (!VEREDICTOS.has(veredicto as Veredicto)) return NextResponse.json({ error: "Veredicto no válido." }, { status: 400 });

  const entradas = (body?.atestaciones ?? {}) as Record<string, unknown>;
  const atestaciones: Partial<Atestaciones> = {
    antecedentesJudiciales: parseAtestacion(entradas.antecedentesJudiciales) ?? undefined,
    certificadoProcuraduria: parseAtestacion(entradas.certificadoProcuraduria) ?? undefined,
    certificadoContraloria: parseAtestacion(entradas.certificadoContraloria) ?? undefined,
  };
  if (!atestaciones.antecedentesJudiciales || !atestaciones.certificadoProcuraduria || !atestaciones.certificadoContraloria) {
    return NextResponse.json({ error: "Faltan las atestaciones del checklist." }, { status: 400 });
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  try {
    const resultado = await saveRevisionAval({
      cedula,
      nombre,
      atestaciones: atestaciones as Atestaciones,
      veredicto: veredicto as Veredicto,
      notaVeredicto,
      revisadoPor: session?.email ?? null,
    });
    return NextResponse.json(resultado);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No fue posible guardar la revisión." },
      { status: 502 }
    );
  }
}
