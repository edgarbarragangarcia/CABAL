import * as React from "react";
import { CalendarCheck, Check, Heart, MagnifyingGlass, MapPin, Wrench } from "@phosphor-icons/react/dist/ssr";

import type { PlantillaId } from "@/lib/portales/plantillas";
import { Avatar, Ic } from "./piezas";

/**
 * Pantallas de ejemplo que van dentro de la maqueta de celular de cada portal. Son ilustraciones de interfaz: nombres,
 * horarios y estados son ficticios y no representan datos reales.
 */

export function PantallaSalud() {
  const medicos: [string, string, string][] = [["Dra. Ejemplo", "Medicina general", "4:30 pm"], ["Dr. Ejemplo", "Pediatría", "5:00 pm"], ["Dra. Ejemplo", "Cardiología", "Mañana"]];
  return (
    <div className="flex h-full flex-col gap-3 bg-gradient-to-b from-[var(--ps)] to-white px-4 pt-9 pb-4 text-[0.7rem] leading-tight">
      <div className="flex items-center justify-between">
        <div><p className="text-[0.62rem] text-slate-400">Buenos días</p><p className="text-[0.95rem] font-extrabold">Hola, Ana</p></div>
        <Avatar nombre="Ana Ejemplo" className="size-9 text-xs" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-slate-400 shadow-sm"><MagnifyingGlass className="size-4" /> Buscar especialista</div>
      <div className="flex gap-1.5">{["Todos", "Pediatría", "Corazón"].map((t, i) => <span key={t} className={`rounded-full px-3 py-1 font-semibold ${i === 0 ? "bg-[var(--p)] text-[var(--sobre)]" : "bg-white text-slate-500"}`}>{t}</span>)}</div>
      <p className="mt-1 text-[0.8rem] font-extrabold">Disponibles hoy</p>
      <ul className="space-y-2">
        {medicos.map(([n, e, h]) => (
          <li key={e} className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-sm">
            <Avatar nombre={n} className="size-9 text-[0.65rem]" />
            <div className="min-w-0 flex-1"><p className="truncate font-bold">{n}</p><p className="truncate text-slate-400">{e}</p></div>
            <span className="rounded-lg bg-[var(--ps)] px-2 py-1 font-bold text-[var(--p)]">{h}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto rounded-2xl bg-gradient-to-r from-[var(--p)] to-[var(--p2)] py-3 text-center font-extrabold text-[var(--sobre)] shadow-[0_14px_26px_-12px_var(--p)]">Confirmar cita</div>
    </div>
  );
}

export function PantallaBelleza() {
  const dias = ["L", "M", "X", "J", "V", "S", "D"];
  const horas = ["10:00", "11:30", "2:00", "3:30", "5:00", "6:30"];
  return (
    <div className="flex h-full flex-col gap-3 bg-[#fffaf7] px-4 pt-9 pb-4 text-[0.7rem] leading-tight">
      <div className="flex items-center justify-between"><p className="font-display text-[1.1rem] font-semibold">Reserva tu cita</p><span className="grid size-8 place-items-center rounded-full bg-white text-[var(--p)] shadow-sm"><Heart weight="fill" className="size-4" /></span></div>
      <div className="flex gap-1.5">{[["scissors", "Corte"], ["brush", "Color"], ["hand", "Uñas"]].map(([i, t], k) => <span key={t} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 font-semibold ${k === 1 ? "bg-[var(--p)] text-[var(--sobre)]" : "bg-white text-slate-600 shadow-sm"}`}><Ic id={i} className="size-3.5" />{t}</span>)}</div>
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex justify-between text-center">{dias.map((d, i) => <div key={d} className={`grid w-7 gap-0.5 rounded-xl py-1.5 ${i === 5 ? "bg-gradient-to-b from-[var(--p)] to-[var(--p2)] text-[var(--sobre)] shadow-[0_10px_18px_-8px_var(--p)]" : "text-slate-500"}`}><span className="text-[0.55rem] opacity-70">{d}</span><b>{12 + i}</b></div>)}</div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">{horas.map((h, i) => <span key={h} className={`rounded-lg py-1.5 text-center font-semibold ${i === 3 ? "bg-[var(--ps)] text-[var(--p)] ring-1 ring-[var(--p)]/40" : "bg-slate-50 text-slate-500"}`}>{h}</span>)}</div>
      </div>
      <div className="flex items-center gap-2.5 rounded-2xl bg-white p-2.5 shadow-sm"><Avatar nombre="Estilista Ejemplo" className="size-9 text-[0.65rem]" /><div className="min-w-0 flex-1"><p className="truncate font-bold">Estilista Ejemplo</p><p className="text-slate-400">Color y corte</p></div><Check weight="bold" className="size-4 text-[var(--p)]" /></div>
      <div className="mt-auto rounded-2xl bg-gradient-to-r from-[var(--p)] to-[var(--p2)] py-3 text-center font-extrabold text-[var(--sobre)] shadow-[0_14px_26px_-12px_var(--p)]">Reservar</div>
    </div>
  );
}

export function PantallaMotos() {
  const servicios = ["Frenos", "Cambio de aceite", "Alineación y balanceo"];
  return (
    <div className="flex h-full flex-col gap-3 bg-[#0e1218] px-4 pt-9 pb-4 text-[0.7rem] leading-tight text-white">
      <div className="flex items-center justify-between"><p className="text-[0.95rem] font-extrabold">Cotiza tu servicio</p><Wrench weight="duotone" className="size-5 text-[var(--p)]" /></div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.06] p-1 text-center font-bold"><span className="rounded-lg bg-[var(--p)] py-1.5 text-[var(--sobre)]">Carro</span><span className="py-1.5 text-white/55">Moto</span></div>
      <div className="flex items-center justify-between rounded-xl bg-[#f6c90e] px-3 py-2 font-mono text-[0.95rem] font-black tracking-[0.18em] text-black"><span>ABC 123</span><span className="text-[0.55rem] tracking-normal">COLOMBIA</span></div>
      <ul className="space-y-1.5">
        {servicios.map((s, i) => <li key={s} className="flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-3 py-2.5"><span className={`grid size-4.5 place-items-center rounded-md ${i < 2 ? "bg-[var(--p)] text-[var(--sobre)]" : "ring-1 ring-white/25"}`}>{i < 2 && <Check weight="bold" className="size-3" />}</span><span className="font-semibold">{s}</span></li>)}
      </ul>
      <div className="rounded-xl border border-white/10 bg-gradient-to-r from-[var(--p)]/25 to-transparent p-3"><p className="text-white/60">Talleres cerca de ti</p><p className="mt-0.5 flex items-center gap-1 font-bold"><MapPin weight="fill" className="size-3.5 text-[var(--p)]" /> Cotizaciones en camino</p></div>
      <div className="mt-auto rounded-2xl bg-gradient-to-r from-[var(--p)] to-[var(--p2)] py-3 text-center font-extrabold text-[var(--sobre)] shadow-[0_14px_26px_-12px_var(--p)]">Ver cotizaciones</div>
    </div>
  );
}

export function PantallaHogar() {
  const pasos: [string, boolean][] = [["Solicitud recibida", true], ["Cuidadora asignada", true], ["Visita programada", false]];
  return (
    <div className="flex h-full flex-col gap-3 bg-[#fbf7f0] px-4 pt-9 pb-4 text-[0.7rem] leading-tight text-[#2a2a24]">
      <p className="font-display text-[1.05rem] leading-snug font-semibold">Tu familia, en buenas manos</p>
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2.5"><Avatar nombre="Cuidadora Ejemplo" className="size-11 text-xs" /><div className="min-w-0 flex-1"><p className="truncate font-bold">Cuidadora Ejemplo</p><p className="text-slate-400">Adultos mayores</p></div><Heart weight="fill" className="size-4 text-[#e07a5f]" /></div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">{["Turno 8 h", "Con referencias", "Lun–Vie"].map((t) => <span key={t} className="rounded-full bg-[var(--ps)] px-2.5 py-1 font-semibold text-[var(--p)]">{t}</span>)}</div>
      </div>
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <p className="mb-2 font-bold">Estado del servicio</p>
        <ol className="space-y-2">{pasos.map(([t, ok]) => <li key={t} className="flex items-center gap-2.5"><span className={`grid size-5 place-items-center rounded-full ${ok ? "bg-[var(--p)] text-[var(--sobre)]" : "bg-slate-100 text-slate-300"}`}>{ok ? <Check weight="bold" className="size-3" /> : <CalendarCheck className="size-3" />}</span><span className={ok ? "font-semibold" : "text-slate-400"}>{t}</span></li>)}</ol>
      </div>
      <div className="mt-auto rounded-2xl bg-gradient-to-r from-[var(--p)] to-[var(--p2)] py-3 text-center font-extrabold text-[var(--sobre)] shadow-[0_14px_26px_-12px_var(--p)]">Solicitar cuidado</div>
    </div>
  );
}

/** La pantalla de ejemplo de cada plantilla. */
export function Pantalla({ id }: { id: PlantillaId }) {
  if (id === "belleza") return <PantallaBelleza />;
  if (id === "motos-autos") return <PantallaMotos />;
  if (id === "hogar-cuidado") return <PantallaHogar />;
  return <PantallaSalud />;
}
