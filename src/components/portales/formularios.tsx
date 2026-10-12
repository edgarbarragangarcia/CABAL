"use client";

import * as React from "react";
import { ArrowRight, CheckCircle, SpinnerGap } from "@phosphor-icons/react";

/**
 * Formularios públicos de un portal: sumarse a la comunidad e inscribirse a un evento. Piden solo lo necesario (nombre y
 * correo; el resto es opcional), exigen la autorización expresa para tratar los datos y llevan un campo trampa invisible para
 * programas automáticos. Se tiñen con las variables de color del portal.
 */

type Props = {
  /** Enlace del portal (/p/<slug>). */
  slug: string;
  /** Si es de un evento, su enlace: la inscripción va a ese evento. */
  evento?: string;
  oscuro?: boolean;
  /** De dónde vino la suscripción, para el origen en el CRM. */
  desde?: "formulario" | "articulo";
  boton?: string;
  /** Lo que se muestra al terminar. */
  gracias?: string;
  /** Intereses entre los que la persona puede elegir (opcional). */
  intereses?: string[];
  className?: string;
};

export function FormularioComunidad({ slug, evento, oscuro = false, desde = "formulario", boton, gracias, intereses = [], className = "" }: Props) {
  const [f, setF] = React.useState({ nombre: "", email: "", telefono: "", ciudad: "", acepta: false, web: "" });
  const [elegidos, setElegidos] = React.useState<string[]>([]);
  const [estado, setEstado] = React.useState<"listo" | "enviando" | "ok">("listo");
  const [error, setError] = React.useState("");
  const [extra, setExtra] = React.useState("");

  const campo = `w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-[var(--p)]/30 ${oscuro ? "border-white/15 bg-white/[0.06] text-white placeholder:text-white/40" : "border-black/10 bg-white text-[#0f172a] placeholder:text-black/35"}`;
  const etiqueta = `mb-1 block text-xs font-semibold ${oscuro ? "text-white/70" : "text-black/60"}`;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (estado === "enviando") return;
    setEstado("enviando");
    setError("");
    try {
      const url = evento ? `/api/portales/${slug}/eventos/${evento}/inscribir` : `/api/portales/${slug}/suscribir`;
      const cuerpo = evento ? { nombre: f.nombre, email: f.email, telefono: f.telefono, ciudad: f.ciudad, acepta: f.acepta, web: f.web } : { ...f, intereses: elegidos, desde };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error ?? "No pudimos completar el registro. Intenta de nuevo.");
      setExtra(typeof b.enlaceVirtual === "string" ? b.enlaceVirtual : "");
      setEstado("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos completar el registro. Intenta de nuevo.");
      setEstado("listo");
    }
  }

  if (estado === "ok") {
    return (
      <div role="status" className={`rounded-2xl p-6 text-center ${oscuro ? "bg-white/[0.06] text-white" : "bg-white text-[#0f172a]"} ${className}`}>
        <CheckCircle weight="fill" className="mx-auto size-10 text-[var(--p)]" />
        <p className="mt-3 text-lg font-bold">{evento ? "¡Quedaste inscrito!" : "¡Ya eres parte de la comunidad!"}</p>
        <p className={`mt-1 text-sm ${oscuro ? "text-white/70" : "text-black/60"}`}>{gracias ?? (evento ? "Te esperamos. Guarda la fecha." : "Pronto recibirás novedades e invitaciones.")}</p>
        {extra && <a href={extra} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-full bg-[var(--p)] px-5 py-2.5 text-sm font-bold text-[var(--sobre)]">Enlace de la sala</a>}
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className={`space-y-3 ${className}`} noValidate>
      <div className="grid gap-3 @xl:grid-cols-2">
        <label className="block @xl:col-span-2"><span className={etiqueta}>Tu nombre</span><input className={campo} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required minLength={2} maxLength={120} autoComplete="name" /></label>
        <label className="block"><span className={etiqueta}>Correo</span><input type="email" className={campo} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required maxLength={160} autoComplete="email" /></label>
        <label className="block"><span className={etiqueta}>Celular (opcional)</span><input type="tel" inputMode="tel" className={campo} value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} maxLength={30} autoComplete="tel" /></label>
        <label className="block @xl:col-span-2"><span className={etiqueta}>Ciudad (opcional)</span><input className={campo} value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} maxLength={80} autoComplete="address-level2" /></label>
      </div>
      {!evento && intereses.length > 0 && (
        <fieldset>
          <legend className={etiqueta}>¿Qué te interesa? (opcional)</legend>
          <div className="flex flex-wrap gap-2">
            {intereses.map((i) => {
              const on = elegidos.includes(i);
              return (
                <button key={i} type="button" aria-pressed={on} onClick={() => setElegidos((l) => (on ? l.filter((x) => x !== i) : [...l, i].slice(0, 8)))} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? "border-transparent bg-[var(--p)] text-[var(--sobre)]" : oscuro ? "border-white/15 text-white/75" : "border-black/10 text-black/65"}`}>
                  {i}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {/* Campo trampa: fuera de la vista y del teclado; una persona nunca lo llena. */}
      <input type="text" name="web" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.web} onChange={(e) => setF({ ...f, web: e.target.value })} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <label className={`flex items-start gap-2.5 text-xs leading-relaxed ${oscuro ? "text-white/70" : "text-black/60"}`}>
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--p)]" checked={f.acepta} onChange={(e) => setF({ ...f, acepta: e.target.checked })} required />
        <span>Autorizo el tratamiento de mis datos personales por la comunidad de este portal y la Fundación Escuela Libertad para enviarme novedades e invitaciones, según la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold underline">política de privacidad</a> (Ley 1581 de 2012). Puedo pedir que los actualicen o los borren en cualquier momento.</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={estado === "enviando" || !f.acepta} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] px-6 py-3.5 text-sm font-bold text-[var(--sobre)] shadow-[0_18px_36px_-16px_var(--p)] transition hover:brightness-110 disabled:opacity-50">
        {estado === "enviando" ? <SpinnerGap className="size-4 animate-spin" /> : null}
        {boton ?? (evento ? "Inscribirme al evento" : "Quiero sumarme")} {estado !== "enviando" && <ArrowRight weight="bold" className="size-4" />}
      </button>
    </form>
  );
}
