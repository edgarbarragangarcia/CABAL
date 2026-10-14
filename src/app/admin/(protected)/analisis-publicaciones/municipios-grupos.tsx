"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { usePeticion } from "./peticion";

type Grupo = { nombre: string; que: string; accion: string };
type Municipio = { dane: string; nombre: string; departamento: string; poblacion: number; estructura: number; grupo: 1 | 2 | 3 | 4; pdet: boolean; coca: boolean; victimas: number };
type Respuesta = { conectado: boolean; municipios: Municipio[]; estructuraTotal: number; grupos: Record<string, Grupo> };

const COLOR = { 1: "#10b981", 2: "#0ea5e9", 3: "#f59e0b", 4: "#94a3b8" } as const;
const n = (v: number) => v.toLocaleString("es-CO");

/** Los municipios del país en cuatro grupos según la estructura que hay y las condiciones locales. */
export function MunicipiosGrupos() {
  const r = usePeticion<Respuesta>("/api/admin/territorio/clasificacion");
  const [grupo, setGrupo] = React.useState<1 | 2 | 3 | 4>(3);
  const [q, setQ] = React.useState("");
  if (r.estado === "cargando") return <p className="p-4 text-sm text-muted-foreground">Clasificando los municipios…</p>;
  if (r.estado === "error") return <p className="p-4 text-sm text-red-700">{r.error}</p>;
  const d = r.data;
  const resumen = ([1, 2, 3, 4] as const).map((g) => {
    const m = d.municipios.filter((x) => x.grupo === g);
    return { g, municipios: m.length, poblacion: m.reduce((s, x) => s + x.poblacion, 0) };
  });
  const filtro = q.trim().toLowerCase();
  const lista = d.municipios.filter((m) => m.grupo === grupo && (!filtro || `${m.nombre} ${m.departamento}`.toLowerCase().includes(filtro)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
          {n(d.municipios.length)} municipios clasificados por la estructura que ya hay ({n(d.estructuraTotal)} personas ubicadas entre afiliados y contactos de portales) y por su población. Es una primera clasificación: crece a medida que se carguen más contactos y datos.
        </p>
        <a href="/api/admin/territorio/clasificacion?formato=csv" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-surface-muted"><Download className="size-3.5" aria-hidden="true" />Descargar hoja de cálculo</a>
      </div>
      {!d.conectado && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs">Supabase no está conectado: la estructura sale en cero y todos los municipios quedan por población.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {resumen.map(({ g, municipios, poblacion }) => (
          <button key={g} type="button" onClick={() => setGrupo(g)} className={`rounded-2xl border p-4 text-left transition ${grupo === g ? "border-brand ring-2 ring-brand/30" : "border-border hover:bg-surface-muted"}`}>
            <span className="inline-block size-2.5 rounded-full" style={{ background: COLOR[g] }} />
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Grupo {g}</p>
            <p className="font-semibold">{d.grupos[g].nombre}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{n(municipios)}</p>
            <p className="text-xs text-muted-foreground">{n(poblacion)} habitantes</p>
            <p className="mt-2 text-xs text-muted-foreground">{d.grupos[g].que}</p>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border p-4">
        <p className="text-sm"><strong>Grupo {grupo} · {d.grupos[grupo].nombre}.</strong> {d.grupos[grupo].accion}</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar municipio o departamento…" className="mt-3 w-full rounded-full border border-border bg-surface px-4 py-2 text-sm" />
        <div className="mt-3 max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Municipio</th><th>Departamento</th><th className="text-right">Población</th><th className="text-right">Organizados</th><th>Condiciones</th></tr></thead>
            <tbody>
              {lista.slice(0, 300).map((m) => (
                <tr key={m.dane} className="border-t border-border/60">
                  <td className="py-1.5 font-medium">{m.nombre}</td>
                  <td className="text-muted-foreground">{m.departamento}</td>
                  <td className="text-right tabular-nums">{n(m.poblacion)}</td>
                  <td className="text-right tabular-nums">{m.estructura}</td>
                  <td className="text-xs text-muted-foreground">{[m.pdet && "PDET", m.coca && "coca", m.victimas > 0 && `${n(m.victimas)} víctimas`].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length > 300 && <p className="mt-2 text-xs text-muted-foreground">Se muestran 300 de {n(lista.length)}: usa el buscador o descarga la hoja de cálculo.</p>}
          {lista.length === 0 && <p className="py-3 text-sm text-muted-foreground">Ningún municipio en este grupo.</p>}
        </div>
      </div>
    </div>
  );
}
