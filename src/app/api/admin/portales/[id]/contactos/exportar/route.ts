import { UUID, idNoValido, respuestaError } from "@/lib/portales/cms/rutas";
import { exportarContactos } from "@/lib/portales/crm/store";
import { filtroDe } from "../route";

export const runtime = "nodejs";

/** CSV de las personas que cumplen el filtro actual (se abre en Excel o Google Sheets). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    const csv = await exportarContactos(id, filtroDe(new URL(req.url).searchParams));
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="comunidad-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return respuestaError(e);
  }
}
