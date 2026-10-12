import * as React from "react";
import { CalendarBlank, MapPin, Users } from "@phosphor-icons/react/dist/ssr";

import type { PlantillaId } from "@/lib/portales/plantillas";
import { Avatar, Ic } from "./piezas";

/**
 * Pantallas de ejemplo que van dentro de la maqueta de celular de cada portal: cómo se ve la comunidad (el próximo encuentro,
 * lo último que se publicó y quiénes participan). Son ilustraciones de interfaz: los títulos son ilustrativos y no
 * representan datos reales.
 */

type Guion = { saludo: string; encuentro: { titulo: string; cuando: string; donde: string }; titulares: string[]; icono: string; boton: string };

const GUIONES: Record<PlantillaId, Guion> = {
  salud: {
    saludo: "Tu comunidad de salud",
    encuentro: { titulo: "Jornada de prevención", cuando: "Sábado · 9:00 a. m.", donde: "Auditorio del barrio" },
    titulares: ["Qué cambia en la salud este año", "Guía: derechos del paciente"],
    icono: "heartbeat",
    boton: "Quiero sumarme",
  },
  belleza: {
    saludo: "Tu comunidad de belleza",
    encuentro: { titulo: "Taller de tendencias", cuando: "Sábado · 3:30 p. m.", donde: "Espacio de la comunidad" },
    titulares: ["Tendencias de la temporada", "Cuidados que sí funcionan"],
    icono: "sparkle",
    boton: "Quiero sumarme",
  },
  "motos-autos": {
    saludo: "La comunidad de la ruta",
    encuentro: { titulo: "Rodada de la comunidad", cuando: "Domingo · 7:00 a. m.", donde: "Punto de encuentro" },
    titulares: ["Normas que cambian este mes", "Seguridad vial: lo esencial"],
    icono: "moto",
    boton: "Quiero sumarme",
  },
  "hogar-cuidado": {
    saludo: "Cuidar en comunidad",
    encuentro: { titulo: "Encuentro de cuidadores", cuando: "Jueves · 6:00 p. m.", donde: "Sala virtual" },
    titulares: ["Guía: un hogar seguro", "Apoyos disponibles para cuidadores"],
    icono: "house",
    boton: "Quiero sumarme",
  },
};

/** La pantalla de ejemplo de cada plantilla: el mismo esquema, con el tema de cada comunidad. */
export function Pantalla({ id }: { id: PlantillaId }) {
  const g = GUIONES[id];
  const oscuro = id === "motos-autos";
  const base = oscuro ? "bg-[#0e1218] text-white" : id === "hogar-cuidado" ? "bg-[#fbf7f0] text-[#2a2a24]" : id === "belleza" ? "bg-[#fffaf7] text-[#0f172a]" : "bg-gradient-to-b from-[var(--ps)] to-white text-[#0f172a]";
  const tarjeta = oscuro ? "bg-white/[0.06]" : "bg-white shadow-sm";
  const suave = oscuro ? "text-white/55" : "text-slate-400";
  return (
    <div className={`flex h-full flex-col gap-3 px-4 pt-9 pb-4 text-[0.7rem] leading-tight ${base}`}>
      <div className="flex items-center justify-between">
        <div><p className={`text-[0.62rem] ${suave}`}>Bienvenida</p><p className="text-[0.95rem] font-extrabold">{g.saludo}</p></div>
        <span className="grid size-9 place-items-center rounded-full bg-[var(--p)] text-[var(--sobre)]"><Ic id={g.icono} weight="duotone" className="size-5" /></span>
      </div>

      <div className={`rounded-2xl p-3 ${tarjeta}`}>
        <p className="mb-1.5 flex items-center gap-1 font-bold text-[var(--p)]"><CalendarBlank weight="fill" className="size-3.5" /> Próximo encuentro</p>
        <p className="text-[0.82rem] font-extrabold">{g.encuentro.titulo}</p>
        <p className={`mt-0.5 ${suave}`}>{g.encuentro.cuando}</p>
        <p className={`flex items-center gap-1 ${suave}`}><MapPin weight="fill" className="size-3" /> {g.encuentro.donde}</p>
      </div>

      <p className="mt-0.5 text-[0.8rem] font-extrabold">Lo último</p>
      <ul className="space-y-2">
        {g.titulares.map((t) => (
          <li key={t} className={`flex items-center gap-2.5 rounded-2xl p-2.5 ${tarjeta}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ps)] text-[var(--p)]"><Ic id={g.icono} className="size-4" /></span>
            <p className="font-bold">{t}</p>
          </li>
        ))}
      </ul>

      <div className={`flex items-center gap-2 rounded-2xl p-2.5 ${tarjeta}`}>
        <div className="flex -space-x-2">{["Ana", "Luis", "Marta", "Juan"].map((n) => <Avatar key={n} nombre={n} className="size-7 text-[0.6rem] ring-2 ring-white" />)}</div>
        <p className={`flex items-center gap-1 ${suave}`}><Users weight="fill" className="size-3.5" /> La comunidad crece</p>
      </div>

      <div className="mt-auto rounded-2xl bg-gradient-to-r from-[var(--p)] to-[var(--p2)] py-3 text-center font-extrabold text-[var(--sobre)] shadow-[0_14px_26px_-12px_var(--p)]">{g.boton}</div>
    </div>
  );
}
