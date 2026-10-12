import { NextResponse } from "next/server";
import { z } from "zod";

import { borrarDocumento, crearDocumento, enlaceOriginal, estadoDocumentos, listarDocumentos, obtenerDocumento } from "@/lib/documentos/almacen";
import { EXTENSIONES, MAX_BYTES, extensionDe } from "@/lib/documentos/extraer";
import { SQL_DOCUMENTOS } from "@/lib/documentos/sql";
import { TAM_PARTE } from "@/lib/documentos/servicio";
import { DIMENSIONES, proveedorDeVectores } from "@/lib/documentos/vectores";

export const runtime = "nodejs";

const editorSql = () => {
  const ref = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : "";
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : undefined;
};

/**
 * Estado de la biblioteca: si Supabase tiene lo necesario (tablas, pgvector y funciones), los documentos y con qué se vectoriza.
 * `?descargar=<id>` devuelve un enlace temporal al archivo original. `/api/admin/*` ya exige la sesión del panel (src/proxy.ts).
 */
export async function GET(req: Request) {
  try {
    const descargar = new URL(req.url).searchParams.get("descargar");
    if (descargar) {
      const doc = await obtenerDocumento(descargar);
      const url = doc?.ruta ? await enlaceOriginal(doc.ruta) : null;
      return url ? NextResponse.json({ url }) : NextResponse.json({ error: "No hay archivo original guardado." }, { status: 404 });
    }
    const estado = await estadoDocumentos();
    if (!estado.configurada) return NextResponse.json({ ...estado, documentos: [] });
    if (!estado.tabla) return NextResponse.json({ ...estado, documentos: [], sql: SQL_DOCUMENTOS, editorSql: editorSql() });
    const [documentos, proveedor] = await Promise.all([listarDocumentos(), proveedorDeVectores()]);
    return NextResponse.json({
      ...estado,
      documentos,
      vectores: proveedor ? { listo: true, proveedor: proveedor.proveedor, modelo: proveedor.modelo, dimensiones: DIMENSIONES } : { listo: false },
      limites: { maxBytes: MAX_BYTES, tamParte: TAM_PARTE, extensiones: EXTENSIONES },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer los documentos." }, { status: 502 });
  }
}

const crear = z.object({
  titulo: z.string().trim().min(1).max(200),
  archivo: z.string().trim().min(1).max(260),
  bytes: z.number().int().positive(),
  etiquetas: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

/** Registra un documento nuevo: el navegador sube después el archivo por partes y pide procesarlo. */
export async function POST(req: Request) {
  const p = crear.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  const { titulo, archivo, bytes, etiquetas } = p.data;
  const ext = extensionDe(archivo);
  if (!(EXTENSIONES as readonly string[]).includes(ext)) {
    return NextResponse.json({ error: `No se pueden leer archivos .${ext || "sin extensión"}. Sube un PDF, un Word (.docx) o un archivo de texto, Markdown, CSV o HTML.` }, { status: 422 });
  }
  if (bytes > MAX_BYTES) return NextResponse.json({ error: `El archivo pesa más de ${MAX_BYTES / 1024 / 1024} MB.` }, { status: 422 });
  try {
    const doc = await crearDocumento({ titulo, archivo, tipo: ext, bytes, etiquetas });
    return NextResponse.json({ id: doc.id, tamParte: TAM_PARTE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible registrar el documento." }, { status: 502 });
  }
}

/** Borra un documento con sus fragmentos y sus archivos. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Documento no válido." }, { status: 422 });
  try {
    await borrarDocumento(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible borrar el documento." }, { status: 502 });
  }
}
