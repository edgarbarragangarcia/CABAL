import { NextResponse } from "next/server";

import { extensionDe, extraerTexto } from "@/lib/documentos/extraer";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Un archivo de trabajo se lee en el momento (no se guarda): el servidor admite cuerpos de hasta ~4,5 MB. */
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CARACTERES = 160_000;

/** POST multipart (archivo) → su texto, para que el asistente lo analice o escriba a partir de él. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!(archivo instanceof File)) return NextResponse.json({ error: "No llegó ningún archivo." }, { status: 422 });
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: "El archivo pesa más de 4 MB. Para archivos grandes, súbelos al Gestor documental y pregúntame por ellos." }, { status: 413 });
  try {
    const r = await extraerTexto(Buffer.from(await archivo.arrayBuffer()), archivo.name);
    const texto = r.paginas.map((p) => (p.numero ? `[página ${p.numero}] ${p.texto}` : p.texto)).join("\n\n").replace(/[ \t]+/g, " ").trim();
    return NextResponse.json({ nombre: archivo.name, extension: extensionDe(archivo.name), texto: texto.slice(0, MAX_CARACTERES), caracteres: r.caracteres, paginas: r.totalPaginas, recortado: texto.length > MAX_CARACTERES });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer el archivo." }, { status: 422 });
  }
}
