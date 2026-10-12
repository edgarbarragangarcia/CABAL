import { NextResponse } from "next/server";
import { z } from "zod";

import { generarArticulo, generarIdeas } from "@/lib/portales/cms/generar";
import { EXTENSIONES } from "@/lib/portales/cms/ia";
import { UUID, idNoValido, mensajeValidacion, respuestaError } from "@/lib/portales/cms/rutas";
import { crearArticulo, leerAjustes } from "@/lib/portales/cms/store";
import { tematicaDe } from "@/lib/portales/cms/tematicas";
import { obtener } from "@/lib/portales/store";

export const runtime = "nodejs";
// Un artículo largo tarda en llegar del modelo.
export const maxDuration = 60;

const pedido = z.discriminatedUnion("modo", [
  z.object({
    modo: z.literal("articulo"),
    tema: z.string().trim().min(5, "Cuéntale a la IA de qué quieres que trate el artículo.").max(300),
    tipoId: z.string().trim().max(30).optional(),
    categoria: z.string().trim().max(40).optional(),
    extension: z.enum(Object.keys(EXTENSIONES) as [keyof typeof EXTENSIONES, ...(keyof typeof EXTENSIONES)[]]).default("medio"),
    palabraClave: z.string().trim().max(80).optional(),
    datos: z.string().trim().max(1200).optional(),
  }),
  z.object({ modo: z.literal("ideas"), enfoque: z.string().trim().max(300).optional() }),
]);

/**
 * Generación con IA. «ideas» propone títulos; «articulo» escribe un artículo completo y lo deja guardado como BORRADOR marcado
 * «generado con IA» (sin revisar): nunca se publica solo. Usa el proveedor y la clave de Configuración.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = pedido.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: mensajeValidacion(p.error) }, { status: 422 });
  try {
    const portal = await obtener(id);
    const contexto = { nombre: portal.config.nombre, ciudad: portal.config.ciudad, tematica: tematicaDe(portal.plantilla), ajustes: await leerAjustes(id) };
    if (p.data.modo === "ideas") return NextResponse.json({ ideas: await generarIdeas(contexto, 8, p.data.enfoque) });
    const borrador = await generarArticulo(contexto, p.data);
    const articulo = await crearArticulo(id, {
      titulo: borrador.titulo,
      resumen: borrador.resumen,
      cuerpo: borrador.cuerpo,
      categoria: borrador.categoria,
      tipo: borrador.tipo,
      etiquetas: borrador.etiquetas,
      estado: "borrador",
      destacado: false,
      generadoConIa: true,
      revisado: false,
      autor: "",
      seoDescripcion: borrador.seoDescripcion,
      portadaUrl: "",
      portadaAlt: "",
      publicarEn: "",
      notaRevision: "",
    });
    return NextResponse.json({ articulo }, { status: 201 });
  } catch (e) {
    // Sin clave de IA, o el modelo no respondió: el mensaje ya está en español y se muestra tal cual.
    if (e instanceof Error && /clave API|respondió|IA |Vuelve a intentarlo/.test(e.message)) return NextResponse.json({ error: e.message }, { status: 502 });
    return respuestaError(e);
  }
}
