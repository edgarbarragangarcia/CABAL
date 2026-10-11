import * as React from "react";
import { ArrowRight, ArrowUpRight, Check, EnvelopeSimple, Plus, Quotes, SealCheck, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";

import type { ConfigPortal, PlantillaId } from "@/lib/portales/plantillas";
import type { AjustesPortal, ArticuloLista } from "@/lib/portales/cms/tipos";
import { HeroArte } from "./heroes";
import { Pantalla } from "./pantallas";
import { Avatar, Ic, Malla, Telefono, iniciales } from "./piezas";
import { BOTON, Encabezado, Enlace, MarcoPortal, construirAmbiente, type Amb, type DatosCms } from "./marco";
import { BandaUnete, EspacioAnuncio, SeccionArticulos } from "./cms";

/**
 * Visor de un portal: dibuja una plantilla con la configuración que se le pase. Sin estado ni hooks: sirve igual en el
 * servidor (página pública /p/<enlace>) y en el cliente (vista previa del generador). Se adapta al ANCHO DE SU CONTENEDOR
 * (container queries), no al de la pantalla: en la vista previa de celular del panel se ve como en un celular.
 *
 * Cada plantilla tiene su propia dirección visual (ver TEMAS en marco.tsx): clínica y limpia, editorial y cálida, nocturna y
 * técnica, y hogareña y amable. Las «imágenes» son ilustraciones y maquetas dibujadas por código; no hay fotografías.
 */

/** Los últimos dos o tres términos del título van en degradado: es la frase que se recuerda. */
function partirTitulo(s: string): [string, string] {
  const p = s.trim().split(/\s+/);
  if (p.length < 4) return [s, ""];
  const n = p.length >= 6 ? 3 : 2;
  return [p.slice(0, -n).join(" "), p.slice(-n).join(" ")];
}

/* ------------------------------------------------------------------ fondos */

function FondoHero({ id }: { id: PlantillaId }) {
  const capa = {
    salud: "bg-[radial-gradient(60%_55%_at_92%_0%,color-mix(in_oklab,var(--p)_16%,transparent),transparent_70%),radial-gradient(45%_45%_at_0%_100%,color-mix(in_oklab,var(--p2)_14%,transparent),transparent_70%)]",
    belleza: "bg-[radial-gradient(55%_60%_at_100%_0%,color-mix(in_oklab,var(--p)_18%,transparent),transparent_70%),radial-gradient(40%_40%_at_0%_90%,color-mix(in_oklab,#f5b942_22%,transparent),transparent_70%)]",
    "motos-autos": "bg-[radial-gradient(50%_60%_at_82%_18%,color-mix(in_oklab,var(--p)_34%,transparent),transparent_72%)]",
    "hogar-cuidado": "bg-[radial-gradient(55%_55%_at_95%_5%,color-mix(in_oklab,var(--p)_20%,transparent),transparent_70%),radial-gradient(45%_50%_at_0%_100%,color-mix(in_oklab,#f2cc8f_55%,transparent),transparent_70%)]",
  }[id];
  return (
    <>
      <div aria-hidden className={`absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,#000_60%,transparent)] ${capa}`} />
      {id === "motos-autos" && <div aria-hidden className="absolute inset-0 -z-10 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(75%_65%_at_72%_28%,#000,transparent)]" />}
      <div aria-hidden className="bg-grain absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay" />
    </>
  );
}

/* ---------------------------------------------------------------- secciones */

function Hero({ a }: { a: Amb }) {
  const { c, t, id, k } = a;
  const [ini, fin] = partirTitulo(c.titulo);
  return (
    <section className="relative isolate overflow-hidden">
      <FondoHero id={id} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-12 pb-20 @2xl:px-8 @4xl:grid-cols-[1.02fr_0.98fr] @4xl:pt-20 @4xl:pb-28">
        <div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold backdrop-blur ${k.pildora}`}>
            <span className="size-1.5 rounded-full bg-[var(--p)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--p)_25%,transparent)]" /> {t.nombre}{c.ciudad ? ` · ${c.ciudad}` : ""}
          </span>
          <h1 className={`mt-6 text-[clamp(2.4rem,7.4cqi,4.4rem)] leading-[1.02] text-balance ${a.tit}`}>
            {ini}{ini && fin ? " " : ""}
            {fin && <span className="bg-gradient-to-r from-[var(--p)] to-[var(--p2)] bg-clip-text text-transparent">{fin}</span>}
          </h1>
          <p className={`mt-6 max-w-xl text-[1.08rem] leading-relaxed ${k.suave}`}>{c.eslogan}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Enlace a={a} href={a.hrefCta} className={BOTON}>{a.textoCta} <ArrowRight weight="bold" className="size-4" /></Enlace>
            {c.secciones.servicios && <Enlace a={a} href={`${a.inicio}#${a.ancla("servicios")}`} className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold backdrop-blur transition ${k.boton2}`}>{t.hero.ctaSecundaria}</Enlace>}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
            {a.demo && (
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2.5">{["Ana", "Luis", "Marta", "Juan"].map((n) => <Avatar key={n} nombre={n} className="size-9 text-xs ring-2 ring-[var(--fondo)]" />)}</div>
                <p className={`text-xs leading-tight ${k.suave}`}>Personas de ejemplo<br />usando el portal</p>
              </div>
            )}
            <ul className="flex flex-wrap gap-2">
              {t.hero.puntos.map((p) => <li key={p} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${k.pildora}`}><Check weight="bold" className="size-3.5 text-[var(--p)]" />{p}</li>)}
            </ul>
          </div>
        </div>
        <HeroArte id={id} base={a.base} />
      </div>
    </section>
  );
}

function Servicios({ a }: { a: Amb }) {
  const { t, k } = a;
  const [grande, ...resto] = t.servicios.items;
  return (
    <section id={a.ancla("servicios")} className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
        <Encabezado a={a} etiqueta="Servicios" titulo={t.servicios.titulo} texto="Todo lo que necesitas, reunido y fácil de pedir." />
        <ul className="mt-12 grid gap-4 @xl:grid-cols-2 @4xl:auto-rows-[minmax(11.5rem,auto)] @4xl:grid-cols-4">
          <li className="group relative isolate flex min-h-60 flex-col justify-between gap-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--p)] to-[var(--pd)] p-8 text-[var(--sobre)] shadow-[0_40px_70px_-36px_var(--p)] @xl:col-span-2 @4xl:row-span-2">
            <Ic id={grande.icono} weight="duotone" className="pointer-events-none absolute -right-10 -bottom-12 -z-10 size-72 opacity-[0.14] transition duration-700 group-hover:scale-110 group-hover:rotate-6" />
            <span className="grid size-16 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur"><Ic id={grande.icono} weight="duotone" className="size-9" /></span>
            <div><h3 className="text-2xl leading-tight font-bold">{grande.titulo}</h3><p className="mt-2 max-w-sm text-sm leading-relaxed opacity-85">{grande.texto}</p></div>
          </li>
          {resto.map((s, i) => (
            <li key={s.titulo} className={`group relative flex min-h-44 flex-col justify-between gap-6 overflow-hidden rounded-[1.75rem] p-6 transition duration-300 hover:-translate-y-1 hover:border-[var(--p)]/40 ${k.tarjeta} ${i === 4 ? "@xl:col-span-2" : ""}`}>
              <span className="grid size-12 place-items-center rounded-2xl bg-[var(--p)]/10 text-[var(--p)] transition group-hover:bg-[var(--p)] group-hover:text-[var(--sobre)]"><Ic id={s.icono} weight="duotone" className="size-7" /></span>
              <div><h3 className="text-lg font-bold">{s.titulo}</h3><p className={`mt-1 text-sm leading-relaxed ${k.suave}`}>{s.texto}</p></div>
            </li>
          ))}
          <li className="relative isolate flex min-h-36 items-center justify-between gap-4 overflow-hidden rounded-[1.75rem] border border-dashed border-[var(--p)]/40 bg-[var(--p)]/[0.06] p-6 @xl:col-span-2">
            <div><p className="text-lg font-bold">¿Necesitas algo más?</p><p className={`mt-1 text-sm ${k.suave}`}>Cuéntanos qué buscas y te ayudamos a encontrarlo.</p></div>
            <Enlace a={a} href={a.hrefCta} className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--p)] text-[var(--sobre)] transition hover:scale-110"><ArrowUpRight weight="bold" className="size-5" /></Enlace>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Pasos({ a }: { a: Amb }) {
  const { t, k, tema } = a;
  return (
    <section id={a.ancla("pasos")} className="relative isolate scroll-mt-24 overflow-hidden py-20" style={{ background: tema.alterno }}>
      <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
        <Encabezado a={a} etiqueta="Paso a paso" titulo={t.pasos.titulo} />
        <ol className="relative mt-14 grid gap-10 @3xl:grid-cols-3 @3xl:gap-8">
          <span aria-hidden className="absolute top-8 right-[17%] left-[17%] hidden border-t-2 border-dashed border-[var(--p)]/30 @3xl:block" />
          {t.pasos.items.map((p, i) => (
            <li key={p.titulo} className="relative text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-[1.4rem] bg-gradient-to-br from-[var(--p)] to-[var(--p2)] text-2xl font-extrabold text-[var(--sobre)] shadow-[0_20px_36px_-16px_var(--p)] ring-8 ring-[var(--alt)]">{i + 1}</span>
              <h3 className="mt-6 text-xl font-bold">{p.titulo}</h3>
              <p className={`mx-auto mt-2 max-w-xs text-sm leading-relaxed ${k.suave}`}>{p.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Proveedores({ a }: { a: Amb }) {
  const { t, k } = a;
  return (
    <section id={a.ancla("proveedores")} className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
        <Encabezado a={a} etiqueta="Directorio" titulo={t.proveedores.titulo} texto="Conoce a quienes prestan el servicio." />
        <ul className="mt-12 grid gap-5 @2xl:grid-cols-3">
          {t.proveedores.items.map((p, i) => {
            const patron = a.ancla(`puntos-${i}`);
            return (
              <li key={p.nombre} className={`group overflow-hidden rounded-[1.75rem] transition duration-300 hover:-translate-y-1.5 ${k.tarjeta}`}>
                <div className="relative h-28 overflow-hidden bg-gradient-to-br from-[var(--p)] to-[var(--p2)]">
                  <svg aria-hidden className="absolute inset-0 size-full text-white/25" fill="none"><defs><pattern id={patron} width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="currentColor" /></pattern></defs><rect width="100%" height="100%" fill={`url(#${patron})`} /></svg>
                  <span className="absolute top-3 right-3 rounded-full bg-black/25 px-2.5 py-1 text-[0.62rem] font-bold tracking-wide text-white uppercase backdrop-blur">Ejemplo</span>
                </div>
                <div className="px-6 pb-6">
                  <Avatar nombre={p.nombre} className={`relative -mt-9 size-[4.5rem] text-xl ring-4 ${k.anillo}`} />
                  <h3 className="mt-3 text-lg font-bold">{p.nombre}</h3>
                  <p className="text-sm font-medium text-[var(--p)]">{p.especialidad}</p>
                  <p className={`mt-3 flex items-center gap-2 text-sm ${k.suave}`}><SealCheck weight="fill" className="size-4 shrink-0 text-[var(--p)]" /> {p.detalle}</p>
                  <div className={`mt-5 flex items-center justify-between border-t pt-4 text-sm ${k.linea}`}><span className="inline-flex items-center gap-1.5 font-medium"><span className="size-2 rounded-full bg-emerald-500" /> Disponible hoy</span><span className="inline-flex items-center gap-1 font-bold text-[var(--p)]">Ver perfil <ArrowRight weight="bold" className="size-3.5 transition group-hover:translate-x-1" /></span></div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Testimonios({ a }: { a: Amb }) {
  const { t, k, tema } = a;
  return (
    <section className="py-20" style={{ background: tema.alterno }}>
      <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
        <Encabezado a={a} etiqueta="Opiniones" titulo={t.testimonios.titulo} />
        <ul className="mt-12 grid gap-5 @3xl:grid-cols-2">
          {t.testimonios.items.map((q, i) => (
            <li key={q.texto} className={`relative isolate overflow-hidden rounded-[2rem] p-8 ${i === 0 ? "bg-gradient-to-br from-[var(--p)] to-[var(--pd)] text-[var(--sobre)] shadow-[0_40px_70px_-36px_var(--p)]" : k.tarjeta}`}>
              <Quotes weight="fill" className={`absolute -top-2 right-6 -z-10 size-28 ${i === 0 ? "opacity-[0.16]" : "text-[var(--p)] opacity-[0.12]"}`} />
              <p className={`text-xl leading-snug ${tema.serif ? "font-display" : "font-semibold"}`}>“{q.texto}”</p>
              <div className="mt-6 flex items-center gap-3">
                {i === 0
                  ? <span aria-hidden className="grid size-11 place-items-center rounded-full bg-white/20 text-sm font-bold ring-1 ring-white/30">{iniciales(q.autor)}</span>
                  : <Avatar nombre={q.autor} className="size-11 text-sm" />}
                <div className="leading-tight"><p className="font-bold">{q.autor}</p><p className={`text-sm ${i === 0 ? "opacity-75" : k.suave}`}>{q.rol}</p></div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Preguntas({ a }: { a: Amb }) {
  const { t, k } = a;
  return (
    <section id={a.ancla("preguntas")} className="scroll-mt-24 py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 @2xl:px-8 @4xl:grid-cols-[0.8fr_1.2fr]">
        <Encabezado a={a} etiqueta="Dudas" titulo={t.preguntas.titulo} texto="Lo que más nos preguntan antes de empezar." />
        <div className="space-y-3">
          {t.preguntas.items.map((q) => (
            <details key={q.pregunta} className={`group rounded-2xl p-1 open:shadow-lg ${k.tarjeta}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 font-bold [&::-webkit-details-marker]:hidden">
                {q.pregunta}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--p)]/10 text-[var(--p)] transition group-open:rotate-45 group-open:bg-[var(--p)] group-open:text-[var(--sobre)]"><Plus weight="bold" className="size-4" /></span>
              </summary>
              <p className={`px-5 pb-5 text-sm leading-relaxed ${k.suave}`}>{q.respuesta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contacto({ a }: { a: Amb }) {
  const { c, id, t } = a;
  const frase = { salud: "Cuida hoy lo que más importa", belleza: "Tu próxima cita te espera", "motos-autos": "Pon tu vehículo a punto", "hogar-cuidado": "Cuéntanos qué necesita tu familia" }[id];
  return (
    <section id={a.ancla("contacto")} className="scroll-mt-24 px-5 py-20 @2xl:px-8">
      <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[var(--p)] via-[var(--p)] to-[var(--pd)] px-8 py-16 text-[var(--sobre)] shadow-[0_50px_90px_-40px_var(--p)] @3xl:px-14 @3xl:py-20">
        <Malla lleno colores={["#ffffff", "var(--p2)", "var(--pd)"]} intensidad={0.22} />
        <Ic id={t.icono} weight="thin" className="pointer-events-none absolute -bottom-16 left-[38%] -z-10 hidden size-80 opacity-[0.12] @3xl:block" />
        <div className="max-w-xl">
          <h2 className={`text-[clamp(2rem,5.6cqi,3.4rem)] leading-[1.05] ${a.tema.serif ? "font-display font-light" : "font-sans font-extrabold tracking-tight"}`}>{frase}</h2>
          <p className="mt-4 max-w-md opacity-85">Escríbenos y te respondemos en el menor tiempo posible{c.ciudad ? ` en ${c.ciudad}` : ""}.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {a.wa && <a href={a.wa} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#111827] shadow-xl transition hover:-translate-y-0.5"><WhatsappLogo weight="fill" className="size-5 text-[#25a244]" /> Escribir por WhatsApp</a>}
            {c.correo && <a href={`mailto:${c.correo}`} className="inline-flex items-center gap-2 rounded-full border-2 border-current/40 px-6 py-3 text-sm font-bold transition hover:bg-white/10"><EnvelopeSimple weight="bold" className="size-5" /> {c.correo}</a>}
            {!a.wa && !c.correo && <span className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-current/40 px-6 py-3 text-sm font-semibold opacity-85">Agrega un WhatsApp o un correo en el generador</span>}
          </div>
        </div>
        <Telefono oscuro={a.tema.oscuro} className="absolute -right-4 -bottom-52 hidden rotate-6 scale-90 @4xl:block"><Pantalla id={id} /></Telefono>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- visor */

export type ContenidoCms = {
  datos: DatosCms;
  ajustes: AjustesPortal;
  /** Los artículos más recientes (el inicio muestra los primeros). */
  articulos: ArticuloLista[];
};

export function PortalView({ plantilla, config: c, demo = true, enlaces = true, idBase = "portal", cms }: { plantilla: PlantillaId; config: ConfigPortal; demo?: boolean; enlaces?: boolean; idBase?: string; cms?: ContenidoCms }) {
  const { a, vars } = construirAmbiente({ plantilla, config: c, demo, enlaces, idBase, cms: cms?.datos, desdeInicio: true });
  const secciones = [
    c.secciones.servicios && { id: "servicios", texto: "Servicios" },
    cms && cms.articulos.length > 0 && { id: "articulos", texto: "Artículos" },
    c.secciones.pasos && { id: "pasos", texto: "Cómo funciona" },
    c.secciones.proveedores && !cms && { id: "proveedores", texto: "Directorio" },
    c.secciones.preguntas && { id: "preguntas", texto: "Preguntas" },
  ].filter(Boolean) as { id: string; texto: string }[];
  // Un portal publicado no muestra personas de ejemplo (proveedores y testimonios de la plantilla): no son reales.
  const ejemplos = !cms;

  return (
    <MarcoPortal a={a} vars={vars} secciones={secciones}>
      <Hero a={a} />
      {cms && <EspacioAnuncio a={a} espacio="cabecera" />}
      {c.secciones.servicios && <Servicios a={a} />}
      {cms && cms.articulos.length > 0 && <SeccionArticulos a={a} articulos={cms.articulos.slice(0, 3)} />}
      {c.secciones.pasos && <Pasos a={a} />}
      {c.secciones.proveedores && ejemplos && <Proveedores a={a} />}
      {c.secciones.testimonios && ejemplos && <Testimonios a={a} />}
      {c.secciones.preguntas && <Preguntas a={a} />}
      {cms && <EspacioAnuncio a={a} espacio="pie" />}
      {cms && <BandaUnete a={a} />}
      {a.contacto && <Contacto a={a} />}
    </MarcoPortal>
  );
}
