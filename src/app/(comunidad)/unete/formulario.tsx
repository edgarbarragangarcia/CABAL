"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, ScanLine, ShieldCheck, Users } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

import { registroSchema } from "@/lib/comunidad/esquemas";
import { ELECTORAL_DEPARTMENTS } from "@/lib/electoral-places";
import { Cedula3D, Escena } from "../escena";
import { CapturaCedula, type DatosCedula, type Via } from "./captura";

type Campos = {
  nombres: string; apellidos: string; cedula: string; fechaNacimiento: string;
  telefono: string; email: string;
  departamento: string; municipio: string; barrio: string; direccion: string;
  password: string; consentimiento: boolean; website: string;
};
const VACIO: Campos = { nombres: "", apellidos: "", cedula: "", fechaNacimiento: "", telefono: "", email: "", departamento: "", municipio: "", barrio: "", direccion: "", password: "", consentimiento: false, website: "" };

const DEPARTAMENTOS = Object.values(ELECTORAL_DEPARTMENTS).map((d) => d.display).sort((a, b) => a.localeCompare(b, "es"));

/** Qué campos valida cada paso (el esquema del servidor es el mismo). */
const PASOS: { titulo: string; sub: string; campos: (keyof Campos)[] }[] = [
  { titulo: "Bienvenido", sub: "Súmate a la comunidad", campos: [] },
  { titulo: "¿Quién eres?", sub: "Revisa que tus datos estén bien", campos: ["nombres", "apellidos", "cedula", "fechaNacimiento"] },
  { titulo: "¿Cómo te contactamos?", sub: "Solo para tu cuenta y avisos de la comunidad", campos: ["telefono", "email"] },
  { titulo: "¿Dónde vives?", sub: "Te unimos a los grupos de tu municipio y tu barrio", campos: ["departamento", "municipio", "barrio", "direccion"] },
  { titulo: "Crea tu cuenta", sub: "Último paso", campos: ["password", "consentimiento"] },
];

const entrada = "w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3.5 text-base shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)] outline-none transition placeholder:text-black/35 focus:border-emerald-600 focus:bg-white focus:shadow-[0_0_0_4px_rgba(16,185,129,0.18),inset_0_2px_6px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/30 dark:focus:bg-white/10";

function Campo({ etiqueta, error, children }: { etiqueta: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">{etiqueta}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

export function FormularioAfiliacion() {
  const router = useRouter();
  const [paso, setPaso] = React.useState(0);
  const [v, setV] = React.useState<Campos>(VACIO);
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  const [escaneando, setEscaneando] = React.useState(false);
  const [leidaDeCedula, setLeidaDeCedula] = React.useState<Via | "">("");
  const [enviando, setEnviando] = React.useState(false);
  const [errorGeneral, setErrorGeneral] = React.useState("");

  const set = <K extends keyof Campos>(k: K, valor: Campos[K]) => {
    setV((p) => ({ ...p, [k]: valor }));
    setErrores((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  const alLeer = React.useCallback((d: DatosCedula, via: Via) => {
    setV((p) => ({ ...p, cedula: d.cedula, nombres: d.nombres || p.nombres, apellidos: d.apellidos || p.apellidos, fechaNacimiento: d.fechaNacimiento ?? p.fechaNacimiento }));
    setLeidaDeCedula(via);
    setEscaneando(false);
    setPaso(1);
  }, []);

  /** Valida solo los campos del paso con el mismo esquema que usa el servidor. */
  function validar(campos: (keyof Campos)[]) {
    const r = registroSchema.safeParse({ ...v, consentimiento: v.consentimiento === true ? true : false });
    const mal: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) {
      const k = String(i.path[0]);
      if ((campos as string[]).includes(k) && !mal[k]) mal[k] = i.message === "Invalid input" || i.message.startsWith("Too small") ? "Revisa este dato." : i.message;
    }
    setErrores(mal);
    return Object.keys(mal).length === 0;
  }

  async function enviar() {
    if (!validar(PASOS[4].campos)) return;
    setEnviando(true);
    setErrorGeneral("");
    try {
      const res = await fetch("/api/comunidad/registro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No fue posible completar la afiliación.");
      router.push("/comunidad");
      router.refresh();
    } catch (e) {
      setErrorGeneral(e instanceof Error ? e.message : "No fue posible completar la afiliación.");
      setEnviando(false);
    }
  }

  const siguiente = () => (paso === 4 ? enviar() : validar(PASOS[paso].campos) && setPaso(paso + 1));
  const p = PASOS[paso];

  const quieto = useReducedMotion();
  const mx = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const my = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const rotY = useTransform(mx, [-0.5, 0.5], [-5, 5]);
  const rotX = useTransform(my, [-0.5, 0.5], [4, -4]);
  const inclinar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (quieto || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const soltar = () => { mx.set(0); my.set(0); };

  return (
    <div className="relative isolate min-h-dvh sm:py-8">
      <Escena />
      {escaneando && <CapturaCedula onLeida={alLeer} onCerrar={() => setEscaneando(false)} />}
      <div className="relative mx-auto max-w-md [perspective:1400px] sm:pt-2" onPointerMove={inclinar} onPointerLeave={soltar}>
       <motion.div style={{ rotateX: rotX, rotateY: rotY }} className="flex min-h-dvh flex-col sm:min-h-0 sm:overflow-hidden sm:rounded-[2.25rem] sm:border sm:border-white/20 sm:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] sm:backdrop-blur-sm [transform-style:preserve-3d]">

      <header className="relative px-5 pt-6 pb-10 text-white">
        <div className="relative flex items-center justify-between">
          {paso > 0 ? (
            <button type="button" onClick={() => setPaso(paso - 1)} aria-label="Atrás" className="grid size-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur"><ArrowLeft className="size-5" /></button>
          ) : (
            <Link href="/" aria-label="Volver al sitio" className="grid size-10 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur"><ArrowLeft className="size-5" /></Link>
          )}
          <Image src="/logo-mark.png" alt="Fundación Escuela Libertad" width={40} height={40} className="rounded-full bg-white/90 p-1 shadow-lg shadow-emerald-500/40" />
        </div>
        {paso === 0 && <Cedula3D className="mt-6" />}
        <div className="relative mt-5">
          <p className="text-xs font-medium tracking-[0.25em] text-emerald-200/90 uppercase">{paso === 0 ? "Comunidad Escuela Libertad" : `Paso ${paso} de ${PASOS.length - 1}`}</p>
          <h1 className="mt-1 font-display text-4xl leading-tight font-semibold drop-shadow-[0_4px_20px_rgba(16,185,129,0.45)]">{p.titulo}</h1>
          <p className="mt-1 text-sm text-white/80">{p.sub}</p>
          {paso > 0 && (
            <div className="mt-5 flex gap-1.5" aria-hidden>
              {PASOS.slice(1).map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < paso ? "bg-gradient-to-r from-amber-300 to-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" : "bg-white/20"}`} />)}
            </div>
          )}
        </div>
      </header>

      <div className="-mt-4 flex-1 rounded-t-[2rem] border-t border-white/40 bg-white/80 px-5 pt-7 pb-4 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0b1511]/85">
        {paso === 0 && (
          <div className="space-y-5">
            <ul className="space-y-3 text-sm">
              {[
                [Users, "Sigue a otros afiliados y a María Fernanda Cabal, y conversa con tu barrio y tu ciudad."],
                [ShieldCheck, "Tus datos personales no son públicos: solo ven tu nombre, tu barrio y lo que publiques."],
              ].map(([Icono, texto], i) => {
                const I = Icono as typeof Users;
                return <li key={i} className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><I className="size-5" /></span><span className="pt-1.5">{texto as string}</span></li>;
              })}
            </ul>
            <button type="button" onClick={() => setEscaneando(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a4f37] to-[#14825c] px-5 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/25 active:scale-[0.99]">
              <ScanLine className="size-5" /> Tomar foto de mi cédula
            </button>
            <button type="button" onClick={() => setPaso(1)} className="w-full rounded-2xl border border-border px-5 py-3.5 text-base font-semibold">Escribir mis datos</button>
            <p className="text-center text-sm text-muted-foreground">¿Ya eres afiliado? <Link href="/comunidad/ingresar" className="font-semibold text-brand">Inicia sesión</Link></p>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            {leidaDeCedula && (
              <p className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${leidaDeCedula === "telefono" ? "bg-amber-500/15 text-amber-800 dark:text-amber-300" : "bg-brand-soft text-brand"}`}>
                <Check className="mt-0.5 size-4 shrink-0" />
                {leidaDeCedula === "barras" ? "Leímos el código de barras de tu cédula. Confirma que todo esté bien." : leidaDeCedula === "ia" ? "Leímos tu foto con inteligencia artificial. Revisa cada dato." : "Leímos tu foto en el teléfono y puede tener errores: revisa cada dato y completa lo que falte."}
              </p>
            )}
            <Campo etiqueta="Nombres" error={errores.nombres}><input className={entrada} autoComplete="given-name" value={v.nombres} onChange={(e) => set("nombres", e.target.value)} /></Campo>
            <Campo etiqueta="Apellidos" error={errores.apellidos}><input className={entrada} autoComplete="family-name" value={v.apellidos} onChange={(e) => set("apellidos", e.target.value)} /></Campo>
            <Campo etiqueta="Número de cédula" error={errores.cedula}><input className={entrada} inputMode="numeric" value={v.cedula} onChange={(e) => set("cedula", e.target.value.replace(/\D/g, "").slice(0, 10))} /></Campo>
            <Campo etiqueta="Fecha de nacimiento" error={errores.fechaNacimiento}><input className={entrada} type="date" autoComplete="bday" value={v.fechaNacimiento} onChange={(e) => set("fechaNacimiento", e.target.value)} /></Campo>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <Campo etiqueta="Celular" error={errores.telefono}><input className={entrada} inputMode="tel" autoComplete="tel-national" placeholder="3001234567" value={v.telefono} onChange={(e) => set("telefono", e.target.value.replace(/\D/g, "").slice(0, 10))} /></Campo>
            <Campo etiqueta="Correo electrónico" error={errores.email}><input className={entrada} type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} /></Campo>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <Campo etiqueta="Departamento" error={errores.departamento}>
              <select className={entrada} value={v.departamento} onChange={(e) => set("departamento", e.target.value)}>
                <option value="">Elige…</option>
                {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Municipio o ciudad" error={errores.municipio}><input className={entrada} autoComplete="address-level2" value={v.municipio} onChange={(e) => set("municipio", e.target.value)} /></Campo>
            <Campo etiqueta="Barrio" error={errores.barrio}><input className={entrada} value={v.barrio} onChange={(e) => set("barrio", e.target.value)} /></Campo>
            <Campo etiqueta="Dirección" error={errores.direccion}><input className={entrada} autoComplete="street-address" placeholder="Calle 10 # 5-20" value={v.direccion} onChange={(e) => set("direccion", e.target.value)} /></Campo>
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-4">
            <Campo etiqueta="Contraseña" error={errores.password}><input className={entrada} type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={v.password} onChange={(e) => set("password", e.target.value)} /></Campo>
            <div aria-hidden className="absolute -left-[9999px]"><input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} /></div>
            <label className="flex gap-3 rounded-2xl bg-surface-muted p-4 text-sm">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#0a4f37]" checked={v.consentimiento} onChange={(e) => set("consentimiento", e.target.checked)} />
              <span>Autorizo a la Fundación Escuela Libertad a tratar mis datos personales para gestionar mi afiliación y la comunidad, según la <Link href="/privacidad" target="_blank" className="font-semibold text-brand underline">política de privacidad</Link> (Ley 1581 de 2012). Puedo pedir que los corrijan o los borren.</span>
            </label>
            {errores.consentimiento && <p className="text-xs text-destructive">{errores.consentimiento}</p>}
            {errorGeneral && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorGeneral}</p>}
          </div>
        )}
      </div>

      {paso > 0 && (
        <div className="sticky bottom-0 border-t border-black/5 bg-white/85 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0b1511]/90">
          <button type="button" onClick={siguiente} disabled={enviando} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a4f37] to-[#14825c] px-5 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/25 active:scale-[0.99] disabled:opacity-60">
            {enviando ? <><Loader2 className="size-5 animate-spin" /> Afiliándote…</> : paso === 4 ? <>Afiliarme <Check className="size-5" /></> : <>Continuar <ArrowRight className="size-5" /></>}
          </button>
        </div>
      )}
       </motion.div>
      </div>
    </div>
  );
}
