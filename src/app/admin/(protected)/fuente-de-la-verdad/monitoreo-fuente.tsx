"use client";

import * as React from "react";

import type { EstadoArchivo } from "@/lib/monitoreo/archivo";

import { usePeticion } from "../analisis-publicaciones/peticion";

type Mencion = { plataforma: string; fuente: string; titulo: string; fecha: string; enlace: string; tono?: string };

/** Lo que Monitoreo tiene guardado en Supabase (último mes): totales por red y la lista de menciones. Se alimenta desde Análisis › Monitoreo. */
export function MonitoreoFuente() {
  const estado = usePeticion<EstadoArchivo>("/api/admin/monitoreo/archivo");
  const lista = usePeticion<{ menciones: Mencion[] }>("/api/admin/monitoreo/menciones?archivo=1");
  const [filtro, setFiltro] = React.useState("");
  const e = estado.estado === "listo" ? estado.data : null;
  const todas = lista.estado === "listo" ? lista.data.menciones : [];
  const q = filtro.trim().toLowerCase();
  const vistas = todas.filter((m) => !q || `${m.titulo} ${m.fuente} ${m.plataforma}`.toLowerCase().includes(q)).slice(0, 300);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h3 className="font-semibold">Monitoreo · menciones guardadas</h3>
        <p className="text-sm text-muted-foreground">
          {e ? `${e.total.toLocaleString("es-CO")} menciones del último mes` : "Leyendo…"}
          {e?.ultimaActualizacion ? ` · actualizado ${new Date(e.ultimaActualizacion).toLocaleString("es-CO")}` : ""}. Para traer más: Análisis › Monitoreo › «Barrido de hoy».
        </p>
      </div>
      {e && !e.disponible && <p className="text-sm text-amber-700">Faltan las columnas del archivo en Supabase: ejecuta monitoreo.sql (Mapa de datos lo copia).</p>}
      {e && e.porPlataforma.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {e.porPlataforma.map((p) => (
            <span key={p.plataforma} className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold">{p.plataforma} {p.total}</span>
          ))}
        </div>
      )}
      <input value={filtro} onChange={(ev) => setFiltro(ev.target.value)} placeholder="Filtrar por título, medio o red…" className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm" />
      {lista.estado === "cargando" ? <p className="text-sm text-muted-foreground">Cargando…</p> : (
        <ul className="divide-y divide-border/60">
          {vistas.map((m) => (
            <li key={`${m.plataforma}|${m.enlace}`} className="py-2 text-sm">
              <a href={m.enlace} target="_blank" rel="noreferrer" className="font-medium hover:underline">{m.titulo}</a>
              <div className="text-xs text-muted-foreground">{m.plataforma} · {m.fuente} · {new Date(m.fecha).toLocaleDateString("es-CO")}{m.tono ? ` · ${m.tono}` : ""}</div>
            </li>
          ))}
          {vistas.length === 0 && <li className="py-3 text-sm text-muted-foreground">Sin menciones guardadas.</li>}
        </ul>
      )}
    </section>
  );
}
