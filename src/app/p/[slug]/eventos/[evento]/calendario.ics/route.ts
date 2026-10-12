import { cargarSitio } from "@/lib/portales/cms/sitio";
import { calendario } from "@/lib/portales/cms/salidas";
import { eventoPublicado } from "@/lib/portales/crm/store";

export const dynamic = "force-dynamic";

/** Archivo .ics del evento, para agregarlo al calendario del teléfono o del correo. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; evento: string }> }) {
  const { slug, evento: enlace } = await params;
  const sitio = await cargarSitio(slug);
  if (!sitio || sitio.estado !== "en-linea" || !/^[a-z0-9-]{3,90}$/.test(enlace)) return new Response("No encontrado", { status: 404 });
  const ev = await eventoPublicado(sitio.portal.id, enlace).catch(() => null);
  if (!ev || ev.estado !== "publicado") return new Response("No encontrado", { status: 404 });
  const lugar = ev.modalidad === "virtual" ? "En línea" : [ev.lugar, ev.ciudad].filter(Boolean).join(", ");
  const cuerpo = calendario({ id: ev.id, titulo: ev.titulo, descripcion: ev.descripcion, iniciaEn: ev.iniciaEn, terminaEn: ev.terminaEn, lugar, url: `${new URL(req.url).origin}${sitio.datos.urlBase}/eventos/${ev.slug}`, portal: sitio.portal.nombre });
  return new Response(cuerpo, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${ev.slug}.ics"`, "Cache-Control": "public, max-age=300" } });
}
