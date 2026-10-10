import "server-only";

import { NextResponse } from "next/server";

import { ErrorPortales } from "./store";

/** Respuesta JSON de error para las rutas del administrador de portales. */
export function respuestaError(e: unknown) {
  if (e instanceof ErrorPortales) {
    const estado = e.codigo === "duplicado" ? 409 : e.codigo === "no_encontrado" ? 404 : e.codigo === "sin_db" || e.codigo === "sin_tabla" ? 503 : 400;
    return NextResponse.json({ error: e.message, codigo: e.codigo }, { status: estado });
  }
  console.error("[portales]", e);
  return NextResponse.json({ error: "No fue posible completar la acción." }, { status: 500 });
}
