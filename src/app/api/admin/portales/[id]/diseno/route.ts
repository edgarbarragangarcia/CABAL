import { NextResponse } from "next/server";
import { z } from "zod";

import { articulosPublicados } from "@/lib/portales/cms/store";
import { paginasPublicadas } from "@/lib/portales/cms/paginas";
import { eventosPublicados } from "@/lib/portales/crm/store";
import { tematicaDe } from "@/lib/portales/cms/tematicas";
import { UUID, idNoValido, respuestaError } from "@/lib/portales/cms/rutas";
import { COOKIE_VISTA, deshacerPublicacion, descartarBorrador, estadoDiseno, guardarBorrador, publicarDiseno } from "@/lib/portales/diseno/store";
import { obtener } from "@/lib/portales/store";

export const runtime = "nodejs";

/**
 * El diseño del portal para el editor: lo publicado, el borrador, y lo que el editor necesita para ofrecer opciones (el menú
 * posible, las notas, las secciones del inicio). Al abrir el editor deja una cookie de corta vida que activa la vista previa del
 * borrador en el sitio, solo para el administrador (el sitio la acepta únicamente junto con la sesión del panel).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    const portal = await obtener(id);
    const [estado, articulos, eventos, paginas] = await Promise.all([
      estadoDiseno(id),
      articulosPublicados(id, { limite: 60 }).catch(() => []),
      eventosPublicados(id, { limite: 40 }).catch(() => []),
      paginasPublicadas(id).catch(() => []),
    ]);
    const c = portal.config;
    const seccion = tematicaDe(portal.plantilla).seccion.nombre;
    // Los mismos enlaces que arma el encabezado del sitio (ver Cabecera en components/portales/marco.tsx).
    const menu = [
      { id: "inicio", texto: "Inicio" },
      ...(c.secciones.servicios ? [{ id: "seccion:servicios", texto: "La comunidad" }] : []),
      ...(eventos.length > 0 ? [{ id: "eventos", texto: "Eventos" }] : []),
      ...(articulos.length > 0 ? [{ id: "articulos", texto: seccion }] : []),
      ...(c.secciones.pasos ? [{ id: "seccion:pasos", texto: "Cómo participar" }] : []),
      { id: "seccion:suscribir", texto: "Súmate" },
      ...(c.secciones.preguntas ? [{ id: "seccion:preguntas", texto: "Preguntas" }] : []),
      ...paginas.filter((p) => p.enMenu).map((p) => ({ id: `pagina:${p.slug}`, texto: p.titulo })),
    ];
    const res = NextResponse.json({
      ...estado,
      portal: { slug: portal.slug, nombre: portal.nombre, plantilla: portal.plantilla, colorPrimario: c.colorPrimario },
      menu,
      articulos: articulos.map((a) => ({ id: a.id, titulo: a.titulo, categoria: a.categoria })),
      secciones: { servicios: c.secciones.servicios, pasos: c.secciones.pasos, preguntas: c.secciones.preguntas, articulos: articulos.length > 0, eventos: eventos.length > 0 },
    });
    res.cookies.set({ name: COOKIE_VISTA, value: id, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/p", maxAge: 2 * 60 * 60 });
    return res;
  } catch (e) {
    return respuestaError(e);
  }
}

/** Guarda el borrador (autoguardado del editor). El diseño pasa por el saneador: lo inválido se corrige o se descarta. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const cuerpo = (await req.json().catch(() => null)) as { diseno?: unknown } | null;
  if (!cuerpo || typeof cuerpo !== "object" || !("diseno" in cuerpo)) return NextResponse.json({ error: "Faltan los datos." }, { status: 400 });
  try {
    await obtener(id);
    return NextResponse.json({ borrador: await guardarBorrador(id, cuerpo.diseno) });
  } catch (e) {
    return respuestaError(e);
  }
}

const accion = z.object({ accion: z.enum(["publicar", "deshacer", "descartar", "salir-vista"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  const p = accion.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Acción no válida." }, { status: 422 });
  try {
    await obtener(id);
    if (p.data.accion === "salir-vista") {
      const res = NextResponse.json({ ok: true });
      res.cookies.set({ name: COOKIE_VISTA, value: "", path: "/p", maxAge: 0 });
      return res;
    }
    if (p.data.accion === "descartar") {
      await descartarBorrador(id);
      return NextResponse.json({ ...(await estadoDiseno(id)) });
    }
    return NextResponse.json(p.data.accion === "publicar" ? await publicarDiseno(id) : await deshacerPublicacion(id));
  } catch (e) {
    return respuestaError(e);
  }
}
