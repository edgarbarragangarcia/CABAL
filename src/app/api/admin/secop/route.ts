import { NextResponse } from "next/server";

import { marcarNombre } from "@/lib/gov-data/secop/analisis";
import { buscarCandidatos } from "@/lib/gov-data/secop/candidatos";
import { entradaDocumento } from "@/lib/gov-data/secop/documento";
import { fichaDe } from "@/lib/gov-data/secop/ficha";
import type { Ficha, RespuestaBusqueda } from "@/lib/gov-data/secop/tipos";

export const maxDuration = 60;

/** `compacto`: para la ficha de Avales, que solo muestra un resumen: se recortan las listas largas (los totales no cambian). */
const recortar = (f: Ficha, n: number): Ficha => ({
  ...f,
  contratos: f.contratos.slice(0, n),
  comoRepresentante: f.comoRepresentante.slice(0, n),
  comoFuncionario: f.comoFuncionario.slice(0, n),
});

/**
 * Contratación pública (SECOP I y II) por cédula, NIT o nombre.
 * - modo=cedula|nit&q=…  → la ficha completa del documento (&nombre=… la contrasta con el nombre del SECOP).
 * - modo=nombre&q=…      → candidatos con ese nombre, para elegir uno y abrir su ficha.
 * `/api/admin/*` ya está protegido por `src/proxy.ts`.
 *
 * Sin caché en el navegador: la ficha ya se guarda una hora en el servidor (`fichaDe`) y, si el navegador
 * guardara también su respuesta, tras un despliegue que cambie su forma la pantalla recibiría datos viejos.
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const modo = p.get("modo");
  const q = (p.get("q") ?? "").replace(/\s+/g, " ").trim();

  try {
    if (modo === "nombre") {
      if (q.length < 3 || q.length > 100) return NextResponse.json({ error: "Escribe un nombre de entre 3 y 100 caracteres." }, { status: 400 });
      const r = await buscarCandidatos(q);
      const cuerpo: RespuestaBusqueda = { tipo: "candidatos", consulta: q, ...r };
      return NextResponse.json(cuerpo, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (modo === "cedula" || modo === "nit") {
      const e = entradaDocumento(q, modo);
      if (!e) return NextResponse.json({ error: modo === "nit" ? "NIT no válido." : "Cédula no válida." }, { status: 400 });
      const nombre = (p.get("nombre") ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || undefined;
      let ficha = marcarNombre(await fichaDe(e.numero, modo), nombre);
      if (p.get("compacto") === "1") ficha = recortar(ficha, 6);
      const cuerpo: RespuestaBusqueda = { tipo: "ficha", ficha };
      return NextResponse.json(cuerpo, { headers: { "Cache-Control": "private, no-store" } });
    }

    return NextResponse.json({ error: "Elige cédula, NIT o nombre." }, { status: 400 });
  } catch (err) {
    // «Escribe al menos un nombre…» es un error de uso, no del servicio.
    const mensaje = err instanceof Error ? err.message : "No fue posible consultar el SECOP.";
    return NextResponse.json({ error: mensaje }, { status: /^Escribe /.test(mensaje) ? 400 : 502 });
  }
}
