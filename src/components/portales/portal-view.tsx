import * as React from "react";
import {
  ArrowRight,
  Baby,
  Brain,
  Broom,
  CalendarCheck,
  Car,
  CaretDown,
  Check,
  ClipboardText,
  EnvelopeSimple,
  FirstAid,
  Flask,
  Flower,
  Gear,
  Hand,
  HandHeart,
  Heart,
  Heartbeat,
  HouseLine,
  MapPin,
  MagnifyingGlass,
  Motorcycle,
  PaintBrush,
  PaintBucket,
  PersonSimpleWalk,
  Quotes,
  Scissors,
  SealCheck,
  ShieldCheck,
  Sparkle,
  Star,
  Stethoscope,
  Tire,
  Tooth,
  VideoCamera,
  Wheelchair,
  WhatsappLogo,
  Wrench,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon, IconProps } from "@phosphor-icons/react";

import { PLANTILLAS, plantillaPorId, type ConfigPortal, type PlantillaId } from "@/lib/portales/plantillas";

/**
 * Visor de un portal: dibuja una plantilla con la configuración que se le pase. Sin estado ni hooks: sirve igual en el
 * servidor (página pública /p/<enlace>) y en el cliente (vista previa del generador). Se adapta al ANCHO DE SU CONTENEDOR
 * (container queries), no al de la pantalla: en la vista previa móvil del panel se ve como en un celular.
 */

const ICONOS: Record<string, Icon> = {
  stethoscope: Stethoscope, heartbeat: Heartbeat, flask: Flask, brain: Brain, tooth: Tooth, video: VideoCamera,
  scissors: Scissors, razor: Star, hand: Hand, brush: PaintBrush, flower: Flower, sparkle: Sparkle,
  wrench: Wrench, paint: PaintBucket, tire: Tire, clipboard: ClipboardText, shield: ShieldCheck, gear: Gear, car: Car, moto: Motorcycle,
  house: HouseLine, wheelchair: Wheelchair, firstaid: FirstAid, handheart: HandHeart, walk: PersonSimpleWalk, baby: Baby, broom: Broom,
};
/** Ícono por identificador (los datos de la plantilla no importan React). Componente de nivel superior: no se crea al renderizar. */
const Ic = ({ id, ...p }: { id: string } & IconProps) => React.createElement(ICONOS[id] ?? Sparkle, p);

/** Negro o blanco según el color de fondo, para que el texto sobre el color de marca siempre se lea. */
function textoSobre(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "#111827" : "#ffffff";
}

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.18em] text-[var(--p)] uppercase"><span className="h-px w-6 bg-[var(--p)]" aria-hidden />{children}</span>;
}

/** Arco con el semicírculo arriba y esquinas suaves abajo. Con radios en % las esquinas de abajo no se encogen (a diferencia de `rounded-t-full`). */
const ARCO: React.CSSProperties = { borderRadius: "50% 50% 2.5rem 2.5rem / 40% 40% 2.5rem 2.5rem" };

/* --------------------------------------------------------------- visual del hero */

function VisualHero({ id, ico }: { id: PlantillaId; ico: string }) {
  if (id === "belleza")
    return (
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[22rem]">
        <span aria-hidden style={ARCO} className="absolute -inset-3 translate-x-3 translate-y-3 border border-[var(--p)]/35" />
        <div style={ARCO} className="relative size-full overflow-hidden bg-gradient-to-b from-[var(--pm)] via-[var(--p)] to-[var(--pd)]">
          <Sparkle weight="fill" className="absolute top-[18%] left-[16%] size-10 text-white/40" />
          <Sparkle weight="fill" className="absolute top-[40%] right-[14%] size-6 text-white/50" />
          <Scissors weight="thin" className="absolute right-[10%] bottom-[10%] size-28 -rotate-12 text-white/25" />
          <Ic id={ico} weight="duotone" className="absolute top-1/2 left-1/2 size-32 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-lg" />
        </div>
      </div>
    );
  if (id === "motos-autos")
    return (
      <div className="relative mx-auto aspect-[5/4] w-full max-w-[30rem]">
        <div className="absolute inset-0 -skew-x-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--p)] to-[var(--pd)]">
          <span aria-hidden className="absolute -inset-y-4 left-[18%] w-6 skew-x-[-18deg] bg-white/15" />
          <span aria-hidden className="absolute -inset-y-4 left-[30%] w-2 skew-x-[-18deg] bg-white/25" />
          <Gear weight="thin" className="absolute -right-6 -bottom-8 size-44 text-white/20" />
        </div>
        <Car weight="duotone" className="absolute top-[22%] left-[10%] size-36 text-white drop-shadow-lg" />
        <Motorcycle weight="duotone" className="absolute right-[8%] bottom-[14%] size-28 text-white/90 drop-shadow-lg" />
      </div>
    );
  if (id === "hogar-cuidado")
    return (
      <div className="relative mx-auto aspect-[5/4] w-full max-w-[30rem]">
        <span aria-hidden className="absolute inset-x-[8%] top-0 bottom-[6%] rounded-[2.5rem] bg-[var(--ps)]" />
        <div className="absolute inset-x-[8%] top-[8%] bottom-0 [clip-path:polygon(50%_0,100%_26%,100%_100%,0_100%,0_26%)] rounded-b-[2.5rem] bg-gradient-to-b from-[var(--p)] to-[var(--pd)]">
          <Heart weight="fill" className="absolute top-[48%] left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow" />
          <HandHeart weight="thin" className="absolute right-[10%] bottom-[8%] size-24 text-white/25" />
          <Heart weight="fill" className="absolute top-[58%] left-[22%] size-7 text-white/35" />
        </div>
        <HouseLine weight="duotone" className="absolute -top-1 right-[6%] size-14 text-[var(--p)]" />
      </div>
    );
  // salud
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
      <span aria-hidden className="absolute inset-0 rounded-full bg-[var(--ps)]" />
      <span aria-hidden className="absolute inset-[9%] rounded-full border border-dashed border-[var(--p)]/30" />
      <div className="absolute inset-[18%] grid place-items-center rounded-full bg-gradient-to-br from-[var(--p)] to-[var(--pd)] shadow-xl">
        <Ic id={ico} weight="duotone" className="size-1/2 text-white" />
      </div>
      <svg aria-hidden viewBox="0 0 400 80" className="absolute inset-x-0 bottom-[10%] w-full text-[var(--p)]" fill="none">
        <path d="M0 40 H120 L145 8 L175 70 L200 28 L215 40 H400" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------- visor */

export function PortalView({ plantilla: id, config: c, demo = true, enlaces = true, idBase = "portal" }: { plantilla: PlantillaId; config: ConfigPortal; demo?: boolean; enlaces?: boolean; idBase?: string }) {
  const t = plantillaPorId(id) ?? PLANTILLAS[0];
  const sobre = textoSobre(c.colorPrimario);
  const vars = {
    "--p": c.colorPrimario,
    "--ps": `color-mix(in oklab, ${c.colorPrimario} 9%, white)`,
    "--pm": `color-mix(in oklab, ${c.colorPrimario} 55%, white)`,
    "--pd": `color-mix(in oklab, ${c.colorPrimario} 62%, black)`,
    "--sobre": sobre,
  } as React.CSSProperties;
  const serif = id === "belleza" || id === "hogar-cuidado";
  const titulo = serif ? "font-display font-light tracking-[-0.02em]" : "font-sans font-extrabold tracking-[-0.03em]";
  const ancla = (s: string) => `${idBase}-${s}`;
  const A = (href: string, className: string, children: React.ReactNode, llave?: string) => enlaces ? <a key={llave} href={href} className={className}>{children}</a> : <span key={llave} className={className}>{children}</span>;
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(`Hola, quiero información sobre ${c.nombre}.`)}` : "";
  const hrefCta = c.secciones.contacto ? `#${ancla("contacto")}` : wa || "#";
  const secciones = [
    c.secciones.servicios && { id: "servicios", texto: "Servicios" },
    c.secciones.pasos && { id: "pasos", texto: "Cómo funciona" },
    c.secciones.proveedores && { id: "proveedores", texto: "Proveedores" },
    c.secciones.preguntas && { id: "preguntas", texto: "Preguntas" },
  ].filter(Boolean) as { id: string; texto: string }[];
  const boton = "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--p)] px-6 py-3 text-sm font-bold text-[var(--sobre)] shadow-[0_14px_30px_-14px_var(--p)] transition hover:brightness-110";
  const botonSec = "inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--p)]/30 px-6 py-3 text-sm font-bold text-[var(--p)] transition hover:bg-[var(--ps)]";

  return (
    <div style={vars} className="@container relative isolate w-full overflow-hidden bg-white text-[#1b2430]">
      {demo && <div className="bg-[#111827] px-4 py-1.5 text-center text-[0.7rem] font-medium tracking-wide text-white/85">Portal de demostración · el contenido es de ejemplo</div>}

      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3 @2xl:px-8">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--p)] text-[var(--sobre)]"><Ic id={t.icono} weight="duotone" className="size-6" /></span>
          <div className="min-w-0 leading-tight"><p className={`truncate text-lg font-bold ${serif ? "font-display" : ""}`}>{c.nombre}</p>{c.ciudad && <p className="flex items-center gap-1 text-[0.7rem] text-black/50"><MapPin className="size-3" /> {c.ciudad}</p>}</div>
          <nav className="mx-auto hidden items-center gap-6 text-sm font-medium text-black/65 @3xl:flex">
            {secciones.map((s) => A(`#${ancla(s.id)}`, "transition hover:text-[var(--p)]", s.texto, s.id))}
          </nav>
          {A(hrefCta, `${boton} ml-auto !px-5 !py-2.5 @3xl:ml-0`, c.cta)}
        </div>
      </header>

      <section className="relative">
        <span aria-hidden className="absolute inset-y-0 right-0 hidden w-[44%] bg-[var(--ps)] [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)] @3xl:block" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 @2xl:px-8 @3xl:grid-cols-[1.1fr_0.9fr] @3xl:py-20">
          <div>
            <Etiqueta>{t.nombre}</Etiqueta>
            <h1 className={`mt-4 text-[clamp(2.1rem,6cqi,3.6rem)] leading-[1.04] text-balance ${titulo}`}>{c.titulo}</h1>
            <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-black/65">{c.eslogan}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {A(hrefCta, boton, <>{c.cta} <ArrowRight weight="bold" className="size-4" /></>)}
              {c.secciones.servicios && A(`#${ancla("servicios")}`, botonSec, t.hero.ctaSecundaria)}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-black/70">
              {t.hero.puntos.map((p) => <li key={p} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-[var(--p)] text-[var(--sobre)]"><Check weight="bold" className="size-3" /></span>{p}</li>)}
            </ul>
          </div>
          <VisualHero id={id} ico={t.icono} />
        </div>
      </section>

      {c.secciones.servicios && (
        <section id={ancla("servicios")} className="scroll-mt-20 bg-[var(--ps)]/60 py-16">
          <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
            <Etiqueta>Servicios</Etiqueta>
            <h2 className={`mt-3 max-w-2xl text-3xl @2xl:text-4xl ${titulo}`}>{t.servicios.titulo}</h2>
            <ul className="mt-9 grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
              {t.servicios.items.map((s) => {
                return (
                  <li key={s.titulo} className="group rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <span className="grid size-12 place-items-center rounded-xl bg-[var(--ps)] text-[var(--p)] transition group-hover:bg-[var(--p)] group-hover:text-[var(--sobre)]"><Ic id={s.icono} weight="duotone" className="size-7" /></span>
                    <h3 className="mt-4 text-lg font-bold">{s.titulo}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-black/60">{s.texto}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {c.secciones.pasos && (
        <section id={ancla("pasos")} className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
            <Etiqueta>Paso a paso</Etiqueta>
            <h2 className={`mt-3 text-3xl @2xl:text-4xl ${titulo}`}>{t.pasos.titulo}</h2>
            <ol className="mt-9 grid gap-6 @3xl:grid-cols-3">
              {t.pasos.items.map((p, i) => (
                <li key={p.titulo} className="relative rounded-2xl border border-black/5 p-6">
                  <span className={`text-5xl leading-none text-[var(--p)]/25 ${serif ? "font-display" : "font-extrabold"}`}>{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-bold">{p.titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-black/60">{p.texto}</p>
                  {i === 0 && <MagnifyingGlass weight="duotone" className="absolute top-5 right-5 size-6 text-[var(--p)]/50" />}
                  {i === 2 && <CalendarCheck weight="duotone" className="absolute top-5 right-5 size-6 text-[var(--p)]/50" />}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {c.secciones.proveedores && (
        <section id={ancla("proveedores")} className="scroll-mt-20 bg-[var(--ps)]/60 py-16">
          <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
            <Etiqueta>Directorio</Etiqueta>
            <h2 className={`mt-3 text-3xl @2xl:text-4xl ${titulo}`}>{t.proveedores.titulo}</h2>
            <ul className="mt-9 grid gap-4 @2xl:grid-cols-3">
              {t.proveedores.items.map((p) => (
                <li key={p.nombre} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--p)] text-base font-bold text-[var(--sobre)]">{p.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold leading-tight">{p.nombre}<span className="rounded-full bg-black/5 px-2 py-0.5 text-[0.62rem] font-semibold tracking-wide text-black/50 uppercase">Ejemplo</span></p>
                      <p className="mt-0.5 text-sm text-[var(--p)]">{p.especialidad}</p>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-black/60"><SealCheck weight="fill" className="size-4 text-[var(--p)]" /> {p.detalle}</p>
                  <p className="mt-4 text-sm font-bold text-[var(--p)]">Ver perfil →</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {c.secciones.testimonios && (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
            <Etiqueta>Opiniones</Etiqueta>
            <h2 className={`mt-3 text-3xl @2xl:text-4xl ${titulo}`}>{t.testimonios.titulo}</h2>
            <ul className="mt-9 grid gap-4 @3xl:grid-cols-2">
              {t.testimonios.items.map((q) => (
                <li key={q.texto} className="rounded-2xl bg-[var(--p)] p-7 text-[var(--sobre)]">
                  <Quotes weight="fill" className="size-8 opacity-60" />
                  <p className={`mt-3 text-lg leading-snug ${serif ? "font-display italic" : "font-medium"}`}>“{q.texto}”</p>
                  <p className="mt-4 text-sm opacity-75">{q.autor} · {q.rol}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {c.secciones.preguntas && (
        <section id={ancla("preguntas")} className="scroll-mt-20 bg-[var(--ps)]/60 py-16">
          <div className="mx-auto max-w-3xl px-5 @2xl:px-8">
            <Etiqueta>Dudas</Etiqueta>
            <h2 className={`mt-3 text-3xl @2xl:text-4xl ${titulo}`}>{t.preguntas.titulo}</h2>
            <div className="mt-8 divide-y divide-black/10 rounded-2xl border border-black/5 bg-white">
              {t.preguntas.items.map((q) => (
                <details key={q.pregunta} className="group p-5 open:bg-[var(--ps)]/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">{q.pregunta}<CaretDown weight="bold" className="size-4 shrink-0 text-[var(--p)] transition group-open:rotate-180" /></summary>
                  <p className="mt-2 text-sm leading-relaxed text-black/65">{q.respuesta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {c.secciones.contacto && (
        <section id={ancla("contacto")} className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--p)] to-[var(--pd)] px-7 py-12 text-[var(--sobre)] @2xl:px-12">
              <Ic id={t.icono} weight="thin" className="absolute -right-6 -bottom-10 size-56 opacity-15" />
              <h2 className={`max-w-xl text-3xl @2xl:text-4xl ${serif ? "font-display font-light" : "font-sans font-extrabold tracking-tight"}`}>{id === "salud" ? "Cuida hoy lo que más importa" : id === "belleza" ? "Tu próxima cita te espera" : id === "motos-autos" ? "Pon tu vehículo a punto" : "Cuéntanos qué necesita tu familia"}</h2>
              <p className="mt-3 max-w-lg text-sm opacity-85">Escríbenos y te respondemos en el menor tiempo posible{c.ciudad ? ` en ${c.ciudad}` : ""}.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {wa && <a href={wa} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#111827] shadow-lg"><WhatsappLogo weight="fill" className="size-5 text-[#25a244]" /> Escribir por WhatsApp</a>}
                {c.correo && <a href={`mailto:${c.correo}`} className="inline-flex items-center gap-2 rounded-full border-2 border-current/40 px-6 py-3 text-sm font-bold"><EnvelopeSimple weight="bold" className="size-5" /> {c.correo}</a>}
                {!wa && !c.correo && <span className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-current/40 px-6 py-3 text-sm font-semibold opacity-85">Agrega un WhatsApp o un correo en el generador</span>}
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-black/10 bg-[#111827] text-white/75">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-8 text-sm @2xl:px-8">
          <p className="font-bold text-white">{c.nombre}{c.ciudad ? <span className="font-normal text-white/60"> · {c.ciudad}</span> : null}</p>
          {t.aviso && <p className="max-w-xl text-xs text-white/55">{t.aviso}</p>}
          <p className="ml-auto text-xs text-white/45">{demo ? "Plantilla de demostración · " : ""}Generado con el generador de portales de Escuela Libertad</p>
        </div>
      </footer>
    </div>
  );
}
