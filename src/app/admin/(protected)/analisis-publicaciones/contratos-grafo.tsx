"use client";

import * as React from "react";

import { pesosCorto } from "@/lib/gov-data/secop/formato";
import type { Ficha, Relaciones, Vinculo } from "@/lib/gov-data/secop/tipos";
import { consultaDe, type Navegar } from "./contratos-comun";
import { titulo } from "./nombres";

/**
 * Red de relaciones de una persona o empresa: ella al centro y, alrededor, las entidades que la
 * contratan, las empresas que representa, sus representantes y los funcionarios de sus contratos.
 * El grosor de cada línea es la cantidad de contratos. Cada nodo con documento se puede abrir.
 * Es un complemento visual: las listas de al lado dicen lo mismo en texto.
 */

type Grupo = { clave: keyof Relaciones; color: string; etiqueta: (t: Ficha["tipo"]) => string };

export const GRUPOS_GRAFO: Grupo[] = [
  { clave: "entidades", color: "#0ea5e9", etiqueta: (t) => (t === "empresa" ? "Entidades que la contratan" : "Entidades que lo contratan") },
  { clave: "empresas", color: "#8b5cf6", etiqueta: (t) => (t === "empresa" ? "La tienen como representante" : "Empresas que representa") },
  { clave: "representantes", color: "#d946ef", etiqueta: () => "Representantes legales" },
  { clave: "relacionadas", color: "#ec4899", etiqueta: () => "Mismo representante legal" },
  { clave: "funcionarios", color: "#f59e0b", etiqueta: () => "Funcionarios de sus contratos" },
  { clave: "supervisados", color: "#10b981", etiqueta: () => "A quiénes contrata o supervisa" },
];

const POR_GRUPO = 5;
const W = 760;
const H = 480;
const CX = W / 2;
const CY = H / 2;
const RX = 215;
const RY = 160;

const corto = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const iniciales = (s: string) =>
  s
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "·";

type Nodo = { v: Vinculo; g: Grupo; x: number; y: number; cos: number; sin: number };

export function ContratosGrafo({ f, navegar }: { f: Ficha; navegar: Navegar }) {
  const nombre = titulo(f.nombres[0]?.nombre ?? f.registros.find((r) => r.relacion === "propio")?.nombre ?? "Consultado");

  const grupos = GRUPOS_GRAFO.map((g) => ({ g, items: f.relaciones[g.clave].slice(0, POR_GRUPO) })).filter((x) => x.items.length > 0);
  const total = grupos.reduce((s, x) => s + x.items.length, 0);
  if (total === 0) return null;

  const maxN = Math.max(1, ...grupos.flatMap((x) => x.items.map((v) => v.n)));
  const maxValor = Math.max(1, ...grupos.flatMap((x) => x.items.map((v) => v.valor)));

  let i = 0;
  const nodos: Nodo[] = grupos.flatMap(({ g, items }) =>
    items.map((v) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * (i++ + 0.5)) / total;
      return { v, g, cos: Math.cos(ang), sin: Math.sin(ang), x: CX + RX * Math.cos(ang), y: CY + RY * Math.sin(ang) };
    })
  );

  return (
    <div className="hidden rounded-2xl border border-border bg-surface p-2 shadow-sm md:block">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Red de relaciones de ${nombre}: ${total} vínculos. Las listas de abajo tienen el mismo detalle.`} className="h-auto max-h-[30rem] w-full">
        {nodos.map((n) => {
          const peso = n.v.n > 0 ? 1.2 + 3.6 * Math.sqrt(n.v.n / maxN) : 1;
          return <line key={`l-${n.g.clave}-${n.v.clave}`} x1={CX} y1={CY} x2={n.x} y2={n.y} stroke={n.g.color} strokeOpacity={n.v.n > 0 ? 0.55 : 0.3} strokeWidth={peso} strokeDasharray={n.v.n > 0 ? undefined : "4 4"} />;
        })}

        {nodos.map((n) => {
          const r = 7 + 8 * Math.sqrt((n.v.valor > 0 ? n.v.valor / maxValor : n.v.n / maxN) || 0);
          // Solo el nodo casi exactamente arriba o abajo lleva la etiqueta centrada: los vecinos la abren hacia los lados y no se pisan.
          const lado = n.cos > 0.1 ? "start" : n.cos < -0.1 ? "end" : "middle";
          const lx = n.x + (lado === "start" ? r + 6 : lado === "end" ? -(r + 6) : 0);
          const ly = n.y + (lado === "middle" ? (n.sin > 0 ? r + 14 : -(r + 6)) : 4);
          const abrir = () => n.v.documento && navegar(consultaDe(n.v.documento));
          const detalle = `${titulo(n.v.nombre)} — ${n.v.n > 0 ? `${n.v.n} contratos · ${pesosCorto(n.v.valor)}` : "sin contratos registrados"}`;
          return (
            <g
              key={`n-${n.g.clave}-${n.v.clave}`}
              role={n.v.documento ? "button" : undefined}
              tabIndex={n.v.documento ? 0 : undefined}
              aria-label={n.v.documento ? `Abrir la ficha de ${detalle}` : undefined}
              onClick={abrir}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && abrir()}
              className={n.v.documento ? "cursor-pointer outline-none [&:focus-visible>circle]:stroke-foreground [&:hover>circle]:stroke-foreground" : ""}
            >
              <title>{detalle}</title>
              <circle cx={n.x} cy={n.y} r={r} fill={n.g.color} fillOpacity={0.9} stroke="transparent" strokeWidth={2} />
              <text x={lx} y={ly} textAnchor={lado} className="fill-foreground text-[11px] font-medium">
                {corto(titulo(n.v.nombre))}
              </text>
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r={30} className="fill-brand" />
        <text x={CX} y={CY + 5} textAnchor="middle" className="fill-white text-[15px] font-bold">
          {iniciales(nombre)}
        </text>
      </svg>

      <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {grupos.map(({ g, items }) => (
          <li key={g.clave} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
            {g.etiqueta(f.tipo)} ({items.length}
            {f.relaciones[g.clave].length > items.length ? ` de ${f.relaciones[g.clave].length}` : ""})
          </li>
        ))}
        <li className="basis-full text-center">Línea más gruesa = más contratos · punteada = registrada, sin contratos · clic en un nodo para abrir su ficha</li>
      </ul>
    </div>
  );
}
