import { NextResponse } from "next/server";

import { UUID, idNoValido, respuestaError } from "@/lib/portales/cms/rutas";
import { MAX_BYTES_IMAGEN } from "@/lib/portales/cms/medios-puro";
import { listarMedios, subirMedio } from "@/lib/portales/cms/medios";
import { usuarioActual } from "@/lib/documentos/usuario";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    return NextResponse.json({ medios: await listarMedios(id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}

/** Sube una imagen (multipart, campo `archivo`). Se valida por su firma real, no por su nombre ni su tipo declarado. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const largo = Number(req.headers.get("content-length") ?? 0);
  if (largo > MAX_BYTES_IMAGEN + 64 * 1024) return NextResponse.json({ error: "La imagen pesa más de 4 MB." }, { status: 413 });
  try {
    const form = await req.formData();
    const archivo = form.get("archivo");
    if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
    const medio = await subirMedio(id, { nombre: archivo.name, bytes: new Uint8Array(await archivo.arrayBuffer()) }, (await usuarioActual()) ?? "");
    return NextResponse.json({ medio }, { status: 201 });
  } catch (e) {
    return respuestaError(e);
  }
}
