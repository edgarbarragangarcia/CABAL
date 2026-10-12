import { cargarSitio } from "@/lib/portales/cms/sitio";
import { sitemap, type EntradaSitemap } from "@/lib/portales/cms/salidas";
import { eventosPublicados } from "@/lib/portales/crm/store";

export const dynamic = "force-dynamic";

/** Mapa del sitio del portal. Solo existe si el portal permite buscadores; si no, ni siquiera se anuncia. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sitio = await cargarSitio((await params).slug);
  if (!sitio || sitio.estado !== "en-linea" || !sitio.ajustes.buscadores) return new Response("No encontrado", { status: 404 });
  const origen = new URL(req.url).origin;
  const base = `${origen}${sitio.datos.urlBase}`;
  const eventos = await eventosPublicados(sitio.portal.id, { limite: 100 }).catch(() => []);
  const entradas: EntradaSitemap[] = [
    { url: base, frecuencia: "weekly", prioridad: 1 },
    ...(sitio.recientes.length ? [{ url: `${base}/articulos`, frecuencia: "daily" as const, prioridad: 0.8 }] : []),
    ...sitio.recientes.map((a) => ({ url: `${base}/articulos/${a.slug}`, fecha: a.actualizadoEn, frecuencia: "monthly" as const, prioridad: 0.7 })),
    ...(eventos.length ? [{ url: `${base}/eventos`, frecuencia: "weekly" as const, prioridad: 0.7 }] : []),
    ...eventos.filter((e) => e.estado === "publicado").map((e) => ({ url: `${base}/eventos/${e.slug}`, fecha: e.iniciaEn, prioridad: 0.6 })),
    ...sitio.paginas.map((p) => ({ url: `${base}/pagina/${p.slug}`, fecha: p.actualizadoEn, frecuencia: "monthly" as const, prioridad: 0.5 })),
  ];
  return new Response(sitemap(entradas), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
