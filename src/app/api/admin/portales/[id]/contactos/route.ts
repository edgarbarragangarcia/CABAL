import { NextResponse } from "next/server";

import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { IDS_ETAPA, IDS_ORIGEN, contactoSchema, type FiltroContactos } from "@/lib/portales/crm/tipos";
import { crearContacto, listarContactos } from "@/lib/portales/crm/store";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";

export function filtroDe(p: URLSearchParams): FiltroContactos {
  const etapa = p.get("etapa");
  const origen = p.get("origen");
  return {
    q: p.get("q")?.slice(0, 80) || undefined,
    etapa: etapa && (IDS_ETAPA as string[]).includes(etapa) ? (etapa as FiltroContactos["etapa"]) : undefined,
    origen: origen && (IDS_ORIGEN as string[]).includes(origen) ? (origen as FiltroContactos["origen"]) : undefined,
    etiqueta: p.get("etiqueta")?.slice(0, 40) || undefined,
    ciudad: p.get("ciudad")?.slice(0, 80) || undefined,
    sinConsentimiento: p.get("sinConsentimiento") === "1",
    pagina: Number(p.get("pagina")) || 1,
    porPagina: Number(p.get("porPagina")) || 50,
  };
}

/** Las personas de la comunidad del portal, con filtros y paginación. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    return NextResponse.json(await listarContactos(id, filtroDe(new URL(req.url).searchParams)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}

/** Agrega a una persona a mano. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = contactoSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    return NextResponse.json({ contacto: await crearContacto(id, p.data, (await usuarioActual()) ?? "") }, { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}
