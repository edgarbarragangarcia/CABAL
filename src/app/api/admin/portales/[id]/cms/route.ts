import { NextResponse } from "next/server";

import { UUID, idNoValido, respuestaError } from "@/lib/portales/cms/rutas";
import { SQL_PORTALES_CMS_PRO } from "@/lib/portales/cms/sql-pro";
import { esPro, olvidarPro } from "@/lib/portales/cms/store";
import { correoConfigurado } from "@/lib/portales/crm/correo";

export const runtime = "nodejs";

const editorSql = () => {
  const ref = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : "";
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : undefined;
};

/** Qué piezas del CMS avanzado están listas (medios, versiones, páginas, boletines) y si hay proveedor de correo. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return idNoValido();
  try {
    if (new URL(req.url).searchParams.get("revisar") === "1") olvidarPro();
    const pro = await esPro();
    return NextResponse.json({ pro, correo: correoConfigurado(), ...(pro ? {} : { sql: SQL_PORTALES_CMS_PRO, editorSql: editorSql() }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return respuestaError(e);
  }
}
