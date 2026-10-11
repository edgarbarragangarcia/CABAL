import { NextResponse, after } from "next/server";
import { z } from "zod";

import { asegurarCatalogo, estadoAlmacen, reiniciarInterruptor } from "@/lib/gov-data/elecciones/almacen";
import { detenerCarga, ejecutarTramo, estadoDeCarga, iniciarCarga } from "@/lib/gov-data/elecciones/carga";
import { SQL_CARGA_ELECTORAL, SQL_ELECCIONES } from "@/lib/gov-data/elecciones/sql";
import { NIVELES_SINCRONIZACION, PARES, estadoSincronizacion, sincronizarLote } from "@/lib/gov-data/elecciones/sincronizar";

export const runtime = "nodejs";
// Cada lote pide territorios a la fuente durante unos 40 s; la carga en segundo plano sigue trabajando después de responder.
export const maxDuration = 60;

const editorSql = () => {
  const ref = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : "";
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : undefined;
};

/** La carga en segundo plano; si falta su tabla, el SQL que la crea. Nunca estorba al resto del estado. */
async function cargaEnSegundoPlano() {
  try {
    const e = await estadoDeCarga();
    return e.disponible ? e : { ...e, sql: SQL_CARGA_ELECTORAL, editorSql: editorSql() };
  } catch (err) {
    return { disponible: false, carga: null, error: err instanceof Error ? err.message : "No se pudo leer la carga." };
  }
}

/**
 * Estado de la copia de resultados en Supabase y cuánto hay guardado de cada cargo, más el de la carga en segundo plano.
 * `?solo=carga` devuelve únicamente lo segundo (es lo que consulta el panel cada pocos segundos mientras carga).
 * `/api/admin/*` ya exige la sesión del panel (src/proxy.ts).
 */
export async function GET(req: Request) {
  try {
    // Quien viene a comprobar acaba de crear las tablas, o de repararlas: que no pese el último fallo.
    reiniciarInterruptor();
    if (new URL(req.url).searchParams.get("solo") === "carga") return NextResponse.json({ carga: await cargaEnSegundoPlano() });
    const estado = await estadoAlmacen();
    if (!estado.configurada) return NextResponse.json({ ...estado, pares: [] });
    if (!estado.tabla) return NextResponse.json({ ...estado, pares: [], sql: SQL_ELECCIONES, editorSql: editorSql() });
    // El catálogo no depende de que alguien haya lanzado una sincronización: queda escrito en cuanto el panel comprueba las tablas.
    await asegurarCatalogo();
    const [pares, carga] = await Promise.all([estadoSincronizacion(), cargaEnSegundoPlano()]);
    return NextResponse.json({ ...estado, pares, carga });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible leer el estado." }, { status: 502 });
  }
}

const alcance = z.object({
  eleccion: z.string().min(1).max(60).optional(),
  corporacion: z.string().min(1).max(10).optional(),
  nivelMax: z.number().refine((n): n is (typeof NIVELES_SINCRONIZACION)[number] => (NIVELES_SINCRONIZACION as readonly number[]).includes(n), "Nivel no válido."),
});
const cargoValido = (v: { eleccion?: string; corporacion?: string }) => PARES.some((x) => (!v.eleccion || x.eleccion === v.eleccion) && (!v.corporacion || x.corporacion === v.corporacion));

const accion = z.union([
  alcance.extend({ accion: z.literal("iniciar") }),
  z.object({ accion: z.literal("detener") }),
  alcance.extend({ accion: z.literal("lote").optional() }),
]);

/**
 * Sin `accion` (o con «lote»): guarda un lote de territorios (los que falten) y devuelve cuánto va; el panel repite hasta que
 * `terminado`. Con «iniciar»: lanza la carga en segundo plano, que sigue sola aunque se cierre el panel. Con «detener»: la corta.
 */
export async function POST(req: Request) {
  const p = accion.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos." }, { status: 422 });
  const a = p.data;
  if ("eleccion" in a && !cargoValido(a)) return NextResponse.json({ error: "Elección o cargo no válido." }, { status: 422 });
  try {
    if (a.accion === "detener") {
      await detenerCarga();
      return NextResponse.json({ ok: true, carga: await estadoDeCarga() });
    }
    if (a.accion === "iniciar") {
      const inicio = await iniciarCarga(a);
      if (!inicio.ok) {
        return NextResponse.json(
          { error: inicio.motivo === "sin-tabla" ? "Falta crear la tabla de la carga en segundo plano: ejecuta el SQL que aparece en el panel." : "Ya hay una carga en marcha." },
          { status: 409 }
        );
      }
      // El primer tramo corre después de responder; cada tramo llama al siguiente.
      const origen = new URL(req.url).origin;
      after(() => ejecutarTramo(inicio.cadena, origen));
      return NextResponse.json({ ok: true, carga: await estadoDeCarga() });
    }
    return NextResponse.json(await sincronizarLote(a));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible sincronizar." }, { status: 502 });
  }
}
