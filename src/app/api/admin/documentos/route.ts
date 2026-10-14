import { NextResponse } from "next/server";
import { z } from "zod";

import { crearDocumento, enlaceOriginal, estadoDocumentos, obtenerDocumento } from "@/lib/documentos/almacen";
import { aPapelera, duplicadoDe, editarDocumentos, eliminarDefinitivo, agregarEtiquetas, listarCarpetas, listarDocumentos, registrar, restaurar } from "@/lib/documentos/gestor";
import { SQL_GESTOR } from "@/lib/documentos/sql-gestor";
import { usuarioActual } from "@/lib/documentos/usuario";
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
    const params = new URL(req.url).searchParams;
    const descargar = params.get("descargar");
    if (descargar) {
      const doc = await obtenerDocumento(descargar);
      const url = doc?.ruta ? await enlaceOriginal(doc.ruta) : null;
      if (url) await registrar(descargar, doc?.titulo ?? null, "descargado", await usuarioActual());
      return url ? NextResponse.json({ url }) : NextResponse.json({ error: "No hay archivo original guardado." }, { status: 404 });
    }
    const estado = await estadoDocumentos();
    if (!estado.configurada) return NextResponse.json({ ...estado, documentos: [] });
    if (!estado.tabla) return NextResponse.json({ ...estado, documentos: [], sql: SQL_DOCUMENTOS, editorSql: editorSql() });
    const [documentos, proveedor, carpetas, papelera] = await Promise.all([
      listarDocumentos(),
      proveedorDeVectores(),
      estado.gestor ? listarCarpetas() : Promise.resolve([]),
      estado.gestor ? listarDocumentos({ papelera: true }) : Promise.resolve([]),
    ]);
    return NextResponse.json({
      ...estado,
      documentos,
      papelera,
      carpetas,
      ...(estado.gestor ? {} : { sqlGestor: SQL_GESTOR, editorSql: editorSql() }),
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
  // Gestor documental
  carpetaId: z.string().uuid().nullable().optional(),
  descripcion: z.string().trim().max(1000).nullable().optional(),
  categoria: z.string().trim().max(60).nullable().optional(),
  autor: z.string().trim().max(120).nullable().optional(),
  fuente: z.string().trim().max(200).nullable().optional(),
  fechaDocumento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  confidencial: z.boolean().optional(),
  ambito: z.enum(["alianza", "partidos", "gremio"]).optional(),
  hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  /** Sube el archivo como una versión nueva de este documento. */
  versionDe: z.string().uuid().optional(),
  /** Guardarlo aunque ya exista uno idéntico. */
  duplicar: z.boolean().optional(),
});

/** Registra un documento nuevo: el navegador sube después el archivo por partes y pide procesarlo. */
export async function POST(req: Request) {
  const p = crear.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  const { titulo, archivo, bytes, etiquetas, versionDe, duplicar, hash, ...meta } = p.data;
  const ext = extensionDe(archivo);
  if (!(EXTENSIONES as readonly string[]).includes(ext)) {
    return NextResponse.json({ error: `No se pueden leer archivos .${ext || "sin extensión"}. Sube un PDF, un Word (.docx) o un archivo de texto, Markdown, CSV o HTML.` }, { status: 422 });
  }
  if (bytes > MAX_BYTES) return NextResponse.json({ error: `El archivo pesa más de ${MAX_BYTES / 1024 / 1024} MB.` }, { status: 422 });
  try {
    const estado = await estadoDocumentos();
    const usuario = await usuarioActual();
    if (hash && estado.gestor && !duplicar && !versionDe) {
      const igual = await duplicadoDe(hash);
      if (igual) return NextResponse.json({ error: `Ya existe un documento idéntico: «${igual.titulo}».`, duplicado: { id: igual.id, titulo: igual.titulo } }, { status: 409 });
    }
    let extras: Record<string, unknown> | undefined;
    if (estado.gestor) {
      extras = {
        carpeta_id: meta.carpetaId ?? null,
        descripcion: meta.descripcion ?? null,
        categoria: meta.categoria ?? null,
        autor: meta.autor ?? null,
        fuente: meta.fuente ?? null,
        fecha_documento: meta.fechaDocumento ?? null,
        confidencial: meta.confidencial ?? false,
        ambito: meta.ambito ?? "alianza",
        hash: hash ?? null,
        creado_por: usuario,
      };
      if (versionDe) {
        const base = await obtenerDocumento(versionDe);
        if (!base) return NextResponse.json({ error: "El documento al que se quiere agregar la versión no existe." }, { status: 422 });
        // La versión nueva hereda carpeta y metadatos; no sustituye a la anterior hasta que termina de procesarse.
        const { versionesDe } = await import("@/lib/documentos/gestor");
        const todas = await versionesDe(base);
        const grupo = base.grupoVersion ?? base.id;
        if (!base.grupoVersion) await editarGrupo(base.id, grupo);
        extras = { ...extras, carpeta_id: base.carpetaId, descripcion: base.descripcion, categoria: base.categoria, autor: base.autor, fuente: base.fuente, confidencial: base.confidencial, ambito: base.ambito, grupo_version: grupo, version: Math.max(...todas.map((d) => d.version), base.version) + 1, es_vigente: false };
      }
    }
    const doc = await crearDocumento({ titulo, archivo, tipo: ext, bytes, etiquetas, extras });
    await registrar(doc.id, titulo, versionDe ? "version" : "subido", usuario, { archivo, bytes });
    return NextResponse.json({ id: doc.id, tamParte: TAM_PARTE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible registrar el documento." }, { status: 502 });
  }
}

async function editarGrupo(id: string, grupo: string) {
  const { cliente } = await import("@/lib/documentos/almacen");
  await cliente().from("documentos").update({ grupo_version: grupo }).eq("id", id);
}

const editar = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  accion: z.enum(["editar", "restaurar", "papelera"]).default("editar"),
  titulo: z.string().trim().min(1).max(200).optional(),
  descripcion: z.string().trim().max(1000).nullable().optional(),
  categoria: z.string().trim().max(60).nullable().optional(),
  autor: z.string().trim().max(120).nullable().optional(),
  fuente: z.string().trim().max(200).nullable().optional(),
  fechaDocumento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  confidencial: z.boolean().optional(),
  ambito: z.enum(["alianza", "partidos", "gremio"]).optional(),
  etiquetas: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  agregarEtiquetas: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  carpetaId: z.string().uuid().nullable().optional(),
});

/** PATCH { ids, ...cambios } edita metadatos o mueve de carpeta; { ids, accion: "papelera" | "restaurar" }. Sirve para uno o muchos. */
export async function PATCH(req: Request) {
  const p = editar.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  const { ids, accion, agregarEtiquetas: suma, ...cambios } = p.data;
  const usuario = await usuarioActual();
  try {
    if (accion === "papelera") await aPapelera(ids, usuario);
    else if (accion === "restaurar") await restaurar(ids, usuario);
    else {
      if (Object.keys(cambios).length > 0) await editarDocumentos(ids, cambios, usuario);
      if (suma?.length) await agregarEtiquetas(ids, suma, usuario);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible guardar los cambios." }, { status: 502 });
  }
}

/** DELETE ?id=…[&definitivo=1]: a la papelera (se puede restaurar) o, con `definitivo`, borrado con sus fragmentos y archivos. */
export async function DELETE(req: Request) {
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Documento no válido." }, { status: 422 });
  try {
    const usuario = await usuarioActual();
    if (q.get("definitivo") === "1") await eliminarDefinitivo([id], usuario);
    else await aPapelera([id], usuario);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible borrar el documento." }, { status: 502 });
  }
}
