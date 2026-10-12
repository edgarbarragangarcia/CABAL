import { cargarSitio } from "@/lib/portales/cms/sitio";
import { rss } from "@/lib/portales/cms/salidas";

export const dynamic = "force-dynamic";

/** Suscripción RSS a los artículos del portal (para lectores de noticias). Solo si el portal permite buscadores. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sitio = await cargarSitio((await params).slug);
  if (!sitio || sitio.estado !== "en-linea" || !sitio.ajustes.buscadores) return new Response("No encontrado", { status: 404 });
  const origen = new URL(req.url).origin;
  const base = `${origen}${sitio.datos.urlBase}`;
  const xml = rss({
    titulo: sitio.portal.nombre,
    descripcion: sitio.portal.config.eslogan,
    url: base,
    urlFeed: `${base}/feed.xml`,
    items: sitio.recientes.slice(0, 30).map((a) => ({ titulo: a.titulo, url: `${base}/articulos/${a.slug}`, resumen: a.resumen, fecha: a.publicadoEn, categoria: a.categoria || undefined })),
  });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
