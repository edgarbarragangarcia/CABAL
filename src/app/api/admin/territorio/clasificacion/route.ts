import { NextResponse } from "next/server";

import { clasificarMunicipios, GRUPOS, UMBRALES } from "@/lib/territorio/clasificacion";

export const maxDuration = 60;

/** Los municipios en cuatro grupos (estructura y condiciones locales). `?formato=csv` lo entrega como hoja de cálculo. */
export async function GET(req: Request) {
  try {
    const r = await clasificarMunicipios();
    if (new URL(req.url).searchParams.get("formato") === "csv") {
      const esc = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`;
      const filas = [["Código DANE", "Municipio", "Departamento", "Población 2026", "Personas organizadas", "Grupo", "Nombre del grupo", "PDET", "Con coca", "Víctimas"].map(esc).join(",")];
      for (const m of r.municipios) filas.push([m.dane, m.nombre, m.departamento, m.poblacion, m.estructura, m.grupo, GRUPOS[m.grupo].nombre, m.pdet ? "sí" : "no", m.coca ? "sí" : "no", m.victimas].map(esc).join(","));
      return new NextResponse("﻿" + filas.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="municipios-por-grupo.csv"', "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ ...r, grupos: GRUPOS, umbrales: UMBRALES }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No fue posible clasificar los municipios." }, { status: 502 });
  }
}
