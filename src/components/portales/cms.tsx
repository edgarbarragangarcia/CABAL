import * as React from "react";
import { ArrowRight, CalendarBlank, Clock, MapPin, Sparkle, UsersThree, VideoCamera } from "@phosphor-icons/react/dist/ssr";

import { minutosDeLectura, parsearMarkdown, posicionAnuncioEnArticulo, type Bloque, type Trozo } from "@/lib/portales/cms/puro";
import { tematicaDe, type EspacioId } from "@/lib/portales/cms/tematicas";
import type { Articulo, ArticuloLista } from "@/lib/portales/cms/tipos";
import type { Evento } from "@/lib/portales/crm/tipos";
import { BOTON, Encabezado, Enlace, type Amb } from "./marco";
import { FormularioComunidad } from "./formularios";
import { Ic, Malla } from "./piezas";

/**
 * Piezas públicas del CMS de un portal: portadas dibujadas por código, tarjetas y listado de artículos, el artículo con su
 * texto en markdown (nunca se interpreta HTML), los espacios publicitarios y el llamado a sumarse a la comunidad. Sin estado ni
 * hooks; todo se tiñe con los colores y la tipografía de la temática del portal.
 */

const fechaLarga = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }) : "");

/** Un número estable a partir de un texto: así cada artículo tiene siempre la misma portada. */
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

// ----------------------------------------------------------------- portada ---

/** Portada del artículo: degradado de la marca, mallas de color y el ícono de la temática, distinta en cada artículo. */
export function Portada({ a, semilla, etiqueta, className = "" }: { a: Amb; semilla: string; etiqueta?: string; className?: string }) {
  const h = hash(semilla);
  const giro = (h % 60) - 30;
  const x = 55 + (h % 30);
  const y = 40 + ((h >> 3) % 40);
  const anillos = [0, 1, 2].map((i) => 40 + i * 22 + ((h >> (i + 2)) % 10));
  return (
    <div aria-hidden className={`relative isolate overflow-hidden bg-gradient-to-br from-[var(--p)] to-[var(--pd)] text-[var(--sobre)] ${className}`}>
      <Malla lleno colores={["#ffffff", "var(--p2)", "var(--pd)"]} intensidad={0.3} />
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 -z-10 size-full opacity-30" fill="none" stroke="currentColor">
        {anillos.map((r, i) => <circle key={r} cx={x} cy={y} r={r} strokeWidth={0.6} strokeDasharray={i === 1 ? "2 4" : undefined} />)}
      </svg>
      <Ic id={a.t.icono} weight="duotone" className="absolute -z-10 size-[58%] opacity-[0.22]" style={{ left: `${x - 22}%`, top: `${y - 40}%`, transform: `rotate(${giro}deg)` }} />
      {etiqueta && <span className="absolute bottom-3 left-3 rounded-full bg-black/25 px-3 py-1 text-[0.68rem] font-bold tracking-wide uppercase backdrop-blur">{etiqueta}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- artículos ---

export function TarjetaArticulo({ a, art, grande = false }: { a: Amb; art: ArticuloLista; grande?: boolean }) {
  const cms = a.cms;
  const href = cms ? `${cms.urlBase}/articulos/${art.slug}` : "#";
  return (
    <Enlace a={a} href={href} className={`group flex h-full flex-col overflow-hidden rounded-[1.75rem] transition duration-300 hover:-translate-y-1 ${a.k.tarjeta}`}>
      <Portada a={a} semilla={art.slug} etiqueta={art.categoria || undefined} className={grande ? "aspect-[16/8]" : "aspect-[16/9]"} />
      <span className="flex flex-1 flex-col gap-2 p-6">
        <span className={`text-xs font-semibold ${a.k.suave}`}>{fechaLarga(art.publicadoEn)}</span>
        <span className={`${grande ? "text-2xl" : "text-lg"} leading-snug font-bold text-balance ${a.tema.serif ? "font-display font-normal" : ""}`}>{art.titulo}</span>
        {art.resumen && <span className={`line-clamp-3 text-sm leading-relaxed ${a.k.suave}`}>{art.resumen}</span>}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-bold text-[var(--p)]">Leer artículo <ArrowRight weight="bold" className="size-3.5 transition group-hover:translate-x-1" /></span>
      </span>
    </Enlace>
  );
}

/** Los últimos artículos en el inicio del portal. */
export function SeccionArticulos({ a, articulos }: { a: Amb; articulos: ArticuloLista[] }) {
  const seccion = tematicaDe(a.id).seccion;
  const cms = a.cms!;
  return (
    <section id={a.ancla("articulos")} className="scroll-mt-24 py-20" style={{ background: a.tema.alterno }}>
      <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Encabezado a={a} etiqueta="Artículos" titulo={seccion.nombre} texto={seccion.descripcion} />
          <Enlace a={a} href={`${cms.urlBase}/articulos`} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${a.k.boton2}`}>Ver todos <ArrowRight weight="bold" className="size-4" /></Enlace>
        </div>
        <ul className="mt-12 grid gap-5 @2xl:grid-cols-2 @4xl:grid-cols-3">
          {articulos.map((art) => <li key={art.id}><TarjetaArticulo a={a} art={art} /></li>)}
        </ul>
      </div>
    </section>
  );
}

// --------------------------------------------------------------- publicidad ---

/**
 * Un espacio publicitario: muestra el anuncio que le tocó (o nada, si ninguno está vigente: el espacio se pliega). El clic pasa
 * por el portal, que lo cuenta y redirige al anunciante. Siempre rotulado «Publicidad».
 */
export function EspacioAnuncio({ a, espacio, className = "" }: { a: Amb; espacio: EspacioId; className?: string }) {
  const an = a.cms?.elegidos[espacio];
  if (!a.cms || !an) return null;
  const href = a.cms.hrefAnuncio(an.id);
  const rotulo = <span className={`mb-1.5 block text-[0.62rem] font-bold tracking-[0.18em] uppercase ${a.k.suave}`}>Publicidad{an.anunciante ? ` · ${an.anunciante}` : ""}</span>;
  const enlace = { href, target: "_blank", rel: "sponsored noopener noreferrer" } as const;
  return (
    <aside aria-label="Publicidad" className={`${espacio === "cabecera" || espacio === "pie" ? "mx-auto max-w-6xl px-5 py-6 @2xl:px-8" : ""} ${className}`}>
      {rotulo}
      {an.formato === "imagen" ? (
        <a {...enlace} className={`block overflow-hidden rounded-2xl ${a.k.tarjeta}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- la imagen del anunciante vive en su propio servidor */}
          <img src={an.imagenUrl} alt={an.titulo || an.nombre} loading="lazy" referrerPolicy="no-referrer" className="block h-auto w-full" />
        </a>
      ) : (
        <a {...enlace} className={`group flex gap-4 rounded-2xl p-5 transition hover:-translate-y-0.5 ${espacio === "lateral" ? "flex-col items-start" : "flex-wrap items-center justify-between"} ${a.k.tarjeta}`}>
          <span className="min-w-0 flex-1">
            <span className="block text-lg leading-snug font-bold">{an.titulo}</span>
            {an.texto && <span className={`mt-1 block text-sm leading-relaxed ${a.k.suave}`}>{an.texto}</span>}
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--p)] px-5 py-2.5 text-sm font-bold text-[var(--sobre)]">{an.boton || "Conocer más"} <ArrowRight weight="bold" className="size-4" /></span>
        </a>
      )}
    </aside>
  );
}

// ---------------------------------------------------------- sumarse a la comunidad ---

/** Banda ancha del inicio que invita a sumarse a la comunidad de María Fernanda Cabal. */
export function BandaUnete({ a }: { a: Amb }) {
  const cms = a.cms!;
  return (
    <section className="px-5 py-12 @2xl:px-8">
      <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-[#0c1017] px-8 py-14 text-white @3xl:px-14">
        <Malla lleno colores={["var(--p)", "var(--p2)", "var(--pd)"]} intensidad={0.35} />
        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[0.68rem] font-bold tracking-[0.16em] uppercase ring-1 ring-white/15"><UsersThree weight="fill" className="size-4" /> Comunidad</span>
            <h2 className={`mt-5 text-[clamp(1.9rem,5cqi,3rem)] leading-[1.08] text-balance ${a.tema.serif ? "font-display font-light" : "font-sans font-extrabold tracking-tight"}`}>{cms.union.titulo}</h2>
            <p className="mt-3 text-white/75">{cms.union.texto}</p>
            {cms.editor && <p className="mt-4 text-xs text-white/50">{cms.editor}</p>}
          </div>
          <Enlace a={a} href={cms.hrefUnete} className={BOTON}>{cms.union.boton} <ArrowRight weight="bold" className="size-4" /></Enlace>
        </div>
      </div>
    </section>
  );
}

/** El mismo llamado, en tarjeta: al final de cada artículo y en su columna lateral. */
export function CajaUnete({ a, className = "" }: { a: Amb; className?: string }) {
  const cms = a.cms!;
  return (
    <div className={`relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[var(--p)] to-[var(--pd)] p-7 text-[var(--sobre)] shadow-[0_30px_60px_-34px_var(--p)] ${className}`}>
      <Sparkle weight="fill" className="pointer-events-none absolute -top-3 -right-3 -z-10 size-28 opacity-[0.14]" />
      <UsersThree weight="duotone" className="size-8" />
      <p className={`mt-3 text-xl leading-snug font-bold text-balance ${a.tema.serif ? "font-display font-normal" : ""}`}>{cms.union.titulo}</p>
      <p className="mt-2 text-sm leading-relaxed opacity-90">{cms.union.texto}</p>
      <Enlace a={a} href={cms.hrefUnete} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#111827] shadow-lg transition hover:-translate-y-0.5">{cms.union.boton} <ArrowRight weight="bold" className="size-4" /></Enlace>
      {cms.editor && <p className="mt-4 text-[0.7rem] opacity-70">{cms.editor}</p>}
    </div>
  );
}

// --------------------------------------------------------------- el texto ---

function Trozos({ trozos }: { trozos: Trozo[] }) {
  return (
    <>
      {trozos.map((t, i) =>
        t.tipo === "negrita" ? <strong key={i} className="font-bold">{t.texto}</strong>
        : t.tipo === "cursiva" ? <em key={i}>{t.texto}</em>
        : t.tipo === "enlace" ? <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-[var(--p)] underline underline-offset-2">{t.texto}</a>
        : <React.Fragment key={i}>{t.texto}</React.Fragment>
      )}
    </>
  );
}

function BloqueTexto({ a, b }: { a: Amb; b: Bloque }) {
  const titulo = `${a.tema.serif ? "font-display font-normal" : "font-sans font-extrabold tracking-tight"} text-balance`;
  switch (b.tipo) {
    case "h2": return <h2 className={`mt-12 mb-4 text-[1.7rem] leading-tight ${titulo}`}><Trozos trozos={b.trozos} /></h2>;
    case "h3": return <h3 className={`mt-8 mb-3 text-xl leading-tight font-bold`}><Trozos trozos={b.trozos} /></h3>;
    case "p": return <p className="my-5 text-[1.075rem] leading-[1.8]"><Trozos trozos={b.trozos} /></p>;
    case "cita": return <blockquote className="my-8 rounded-2xl border-l-4 border-[var(--p)] bg-[var(--p)]/[0.07] px-6 py-4 text-[0.95rem] leading-relaxed italic"><Trozos trozos={b.trozos} /></blockquote>;
    case "hr": return <hr className={`my-10 ${a.k.linea}`} />;
    case "ul": return <ul className="my-5 space-y-2.5 pl-1">{b.items.map((it, i) => <li key={i} className="flex gap-3 text-[1.075rem] leading-[1.7]"><span aria-hidden className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-[var(--p)]" /><span><Trozos trozos={it} /></span></li>)}</ul>;
    case "ol": return <ol className="my-5 space-y-3">{b.items.map((it, i) => <li key={i} className="flex gap-3 text-[1.075rem] leading-[1.7]"><span aria-hidden className="mt-[0.25em] grid size-6 shrink-0 place-items-center rounded-full bg-[var(--p)] text-xs font-bold text-[var(--sobre)]">{i + 1}</span><span><Trozos trozos={it} /></span></li>)}</ol>;
  }
}

/** El markdown del artículo ya convertido en elementos; `insertar` pone algo (un anuncio) después de cierto bloque. */
export function Prosa({ a, bloques, insertar }: { a: Amb; bloques: Bloque[]; insertar?: { despuesDe: number; nodo: React.ReactNode } }) {
  return (
    <div>
      {bloques.map((b, i) => (
        <React.Fragment key={i}>
          <BloqueTexto a={a} b={b} />
          {insertar && insertar.despuesDe === i + 1 && insertar.nodo}
        </React.Fragment>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ páginas ---

function MetaArticulo({ a, art }: { a: Amb; art: Pick<ArticuloLista, "autor" | "publicadoEn"> & { cuerpo?: string } }) {
  return (
    <p className={`mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm ${a.k.suave}`}>
      {art.autor && <span className="font-semibold text-[var(--texto)]">{art.autor}</span>}
      {art.publicadoEn && <span className="inline-flex items-center gap-1.5"><CalendarBlank className="size-4" />{fechaLarga(art.publicadoEn)}</span>}
      {art.cuerpo && <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{minutosDeLectura(art.cuerpo)} min de lectura</span>}
    </p>
  );
}

/** La página de un artículo: titular, portada, texto con el anuncio dentro, llamado a sumarse, y más artículos del portal. */
export function VistaArticulo({ a, articulo, relacionados, lateral }: { a: Amb; articulo: Articulo; relacionados: ArticuloLista[]; lateral: ArticuloLista[] }) {
  const cms = a.cms!;
  const bloques = parsearMarkdown(articulo.cuerpo);
  const anuncio = a.cms?.elegidos.articulo;
  const posicion = anuncio ? posicionAnuncioEnArticulo(bloques) : -1;
  return (
    <>
      <EspacioAnuncio a={a} espacio="cabecera" />
      <article className="mx-auto max-w-6xl px-5 pt-10 pb-20 @2xl:px-8">
        <div className="mx-auto max-w-3xl @4xl:mx-0 @4xl:max-w-none">
          <Enlace a={a} href={`${cms.urlBase}/articulos`} className={`inline-flex items-center gap-1.5 text-sm font-semibold ${a.k.suave} hover:text-[var(--p)]`}>← Todos los artículos</Enlace>
        </div>
        <div className="mt-6 grid gap-12 @4xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="mx-auto w-full max-w-3xl @4xl:mx-0">
            {articulo.categoria && <span className={`inline-flex rounded-full px-3.5 py-1.5 text-[0.68rem] font-bold tracking-[0.16em] uppercase ${a.k.etiqueta}`}>{articulo.categoria}</span>}
            <h1 className={`mt-4 text-[clamp(2rem,5.6cqi,3.2rem)] leading-[1.08] text-balance ${a.tit}`}>{articulo.titulo}</h1>
            {articulo.resumen && <p className={`mt-5 text-xl leading-relaxed ${a.k.suave}`}>{articulo.resumen}</p>}
            <MetaArticulo a={a} art={articulo} />
            <Portada a={a} semilla={articulo.slug} className="mt-8 aspect-[16/8] rounded-[2rem]" />
            <div className="mt-6">
              <Prosa a={a} bloques={bloques} insertar={anuncio && posicion > 0 ? { despuesDe: posicion, nodo: <EspacioAnuncio a={a} espacio="articulo" className="my-10" /> } : undefined} />
              {anuncio && posicion < 0 && <EspacioAnuncio a={a} espacio="articulo" className="my-10" />}
            </div>
            {articulo.etiquetas.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-2">{articulo.etiquetas.map((e) => <li key={e} className={`rounded-full border px-3 py-1 text-xs font-semibold ${a.k.pildora}`}>#{e}</li>)}</ul>
            )}
            {articulo.generadoConIa && <p className={`mt-6 text-xs ${a.k.suave}`}>Este artículo se redactó con apoyo de inteligencia artificial y fue revisado por el equipo editorial antes de publicarse.</p>}
            <CajaUnete a={a} className="mt-10" />
          </div>
          <aside className="space-y-6 @4xl:sticky @4xl:top-28 @4xl:self-start">
            <EspacioAnuncio a={a} espacio="lateral" />
            <CajaUnete a={a} className="hidden @4xl:block" />
            {lateral.length > 0 && (
              <div className={`rounded-[1.75rem] p-6 ${a.k.tarjeta}`}>
                <p className="text-xs font-bold tracking-[0.16em] uppercase text-[var(--p)]">Lo más reciente</p>
                <ul className="mt-4 space-y-4">
                  {lateral.map((r) => <li key={r.id}><Enlace a={a} href={`${cms.urlBase}/articulos/${r.slug}`} className="block text-[0.95rem] leading-snug font-semibold hover:text-[var(--p)]">{r.titulo}</Enlace></li>)}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </article>
      {relacionados.length > 0 && (
        <section className="py-16" style={{ background: a.tema.alterno }}>
          <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
            <h2 className={`text-3xl ${a.tit}`}>Sigue leyendo</h2>
            <ul className="mt-8 grid gap-5 @2xl:grid-cols-2 @4xl:grid-cols-3">{relacionados.map((r) => <li key={r.id}><TarjetaArticulo a={a} art={r} /></li>)}</ul>
          </div>
        </section>
      )}
      <EspacioAnuncio a={a} espacio="pie" />
    </>
  );
}

/** El listado de artículos del portal, con sus categorías. */
export function VistaListado({ a, articulos, categorias, actual }: { a: Amb; articulos: ArticuloLista[]; categorias: string[]; actual: string }) {
  const cms = a.cms!;
  const seccion = tematicaDe(a.id).seccion;
  const [primero, ...resto] = articulos;
  const chip = (activa: boolean) => `rounded-full border px-4 py-1.5 text-sm font-semibold transition ${activa ? "border-transparent bg-[var(--p)] text-[var(--sobre)]" : `${a.k.pildora} hover:text-[var(--p)]`}`;
  return (
    <>
      <EspacioAnuncio a={a} espacio="cabecera" />
      <section className="mx-auto max-w-6xl px-5 pt-12 pb-20 @2xl:px-8">
        <Encabezado a={a} etiqueta="Artículos" titulo={seccion.nombre} texto={seccion.descripcion} />
        {categorias.length > 1 && (
          <ul className="mt-8 flex flex-wrap gap-2">
            <li><Enlace a={a} href={`${cms.urlBase}/articulos`} className={chip(!actual)}>Todos</Enlace></li>
            {categorias.map((c) => <li key={c}><Enlace a={a} href={`${cms.urlBase}/articulos?categoria=${encodeURIComponent(c)}`} className={chip(actual === c)}>{c}</Enlace></li>)}
          </ul>
        )}
        {articulos.length === 0 ? (
          <p className={`mt-12 rounded-2xl p-8 text-center ${a.k.tarjeta} ${a.k.suave}`}>Todavía no hay artículos en esta sección. Vuelve pronto.</p>
        ) : (
          <div className="mt-10 grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              {primero && <TarjetaArticulo a={a} art={primero} grande />}
              {resto.length > 0 && <ul className="mt-6 grid gap-5 @2xl:grid-cols-2">{resto.map((r) => <li key={r.id}><TarjetaArticulo a={a} art={r} /></li>)}</ul>}
            </div>
            <aside className="space-y-6 @4xl:sticky @4xl:top-28 @4xl:self-start">
              <EspacioAnuncio a={a} espacio="lateral" />
              <CajaUnete a={a} />
            </aside>
          </div>
        )}
      </section>
      <EspacioAnuncio a={a} espacio="pie" />
    </>
  );
}

// ------------------------------------------------------- eventos y comunidad ---

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const diaCorto = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" });
const mes = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { month: "short", timeZone: "America/Bogota" }).replace(".", "");
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", timeZone: "America/Bogota" });

function dondeEs(e: Pick<Evento, "modalidad" | "lugar" | "ciudad">) {
  if (e.modalidad === "virtual") return "Virtual";
  const sitio = [e.lugar, e.ciudad].filter(Boolean).join(", ");
  return e.modalidad === "mixta" ? `${sitio || "Presencial"} · y virtual` : sitio || "Presencial";
}

export function TarjetaEvento({ a, ev }: { a: Amb; ev: Evento }) {
  const cms = a.cms;
  const lleno = ev.cupo !== null && ev.inscritos >= ev.cupo;
  return (
    <Enlace a={a} href={cms ? `${cms.urlBase}/eventos/${ev.slug}` : "#"} className={`group flex h-full gap-5 rounded-[1.75rem] p-5 transition duration-300 hover:-translate-y-1 ${a.k.tarjeta}`}>
      <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--p)] to-[var(--pd)] text-center text-[var(--sobre)]">
        <span className="leading-none"><span className="block text-[0.65rem] font-bold tracking-wide uppercase">{mes(ev.iniciaEn)}</span><span className="block text-2xl font-extrabold">{dia(ev.iniciaEn)}</span></span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        {ev.estado === "cancelado" && <span className="w-fit rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[0.68rem] font-bold text-rose-600">Cancelado</span>}
        <span className="text-lg leading-snug font-bold text-balance">{ev.titulo}</span>
        <span className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm ${a.k.suave}`}>
          <span className="inline-flex items-center gap-1.5"><Clock className="size-4" />{hora(ev.iniciaEn)}</span>
          <span className="inline-flex items-center gap-1.5">{ev.modalidad === "virtual" ? <VideoCamera className="size-4" /> : <MapPin className="size-4" />}{dondeEs(ev)}</span>
        </span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-bold text-[var(--p)]">{lleno ? "Sin cupos · ver detalles" : "Ver y inscribirme"} <ArrowRight weight="bold" className="size-3.5 transition group-hover:translate-x-1" /></span>
      </span>
    </Enlace>
  );
}

/** Los próximos eventos en el inicio del portal. Sin eventos publicados, la sección no sale. */
export function SeccionEventos({ a, eventos }: { a: Amb; eventos: Evento[] }) {
  const cms = a.cms!;
  if (eventos.length === 0) return null;
  return (
    <section id={a.ancla("eventos")} className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-6xl px-5 @2xl:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Encabezado a={a} etiqueta="Agenda" titulo="Próximos encuentros" texto="Eventos de la comunidad: inscríbete y participa." />
          <Enlace a={a} href={`${cms.urlBase}/eventos`} className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${a.k.boton2}`}>Ver toda la agenda <ArrowRight weight="bold" className="size-4" /></Enlace>
        </div>
        <ul className="mt-12 grid gap-5 @2xl:grid-cols-2">{eventos.slice(0, 4).map((e) => <li key={e.id}><TarjetaEvento a={a} ev={e} /></li>)}</ul>
      </div>
    </section>
  );
}

/** «Sé parte»: el formulario para sumarse a la comunidad del portal (o su maqueta inerte en las vistas previas). */
export function SeccionSuscribir({ a, intereses }: { a: Amb; intereses: string[] }) {
  const cms = a.cms;
  const slug = cms ? cms.urlBase.replace(/^\/p\//, "") : "";
  const oscuro = a.tema.oscuro;
  return (
    <section id={a.ancla("suscribir")} className="scroll-mt-24 py-20" style={{ background: a.tema.alterno }}>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 @2xl:px-8 @4xl:grid-cols-[0.9fr_1.1fr] @4xl:items-center">
        <div>
          <Encabezado a={a} etiqueta="Sé parte" titulo={`Únete a ${a.c.nombre}`} texto="Recibe novedades, guías e invitaciones a los encuentros. Es gratis y puedes salirte cuando quieras." />
          <ul className={`mt-6 space-y-2.5 text-sm ${a.k.suave}`}>
            {a.t.hero.puntos.map((p) => <li key={p} className="flex items-start gap-2.5"><span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--p)]" />{p}</li>)}
          </ul>
        </div>
        <div className={`rounded-[2rem] p-6 @2xl:p-8 ${a.k.tarjeta}`}>
          {cms ? (
            <FormularioComunidad slug={slug} oscuro={oscuro} intereses={intereses} />
          ) : (
            <div className="space-y-3" aria-hidden>
              {["Tu nombre", "Correo", "Celular (opcional)"].map((t) => <div key={t} className={`rounded-xl border px-4 py-3 text-sm ${a.k.pildora}`}>{t}</div>)}
              <div className="rounded-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] px-6 py-3.5 text-center text-sm font-bold text-[var(--sobre)]">{a.c.cta}</div>
              <p className={`text-center text-xs ${a.k.suave}`}>Vista previa: en el portal publicado este formulario guarda a cada persona en su CRM.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** La agenda completa del portal: próximos eventos y, aparte, los que ya pasaron. */
export function VistaAgenda({ a, proximos, pasados }: { a: Amb; proximos: Evento[]; pasados: Evento[] }) {
  return (
    <>
      <EspacioAnuncio a={a} espacio="cabecera" />
      <section className="mx-auto max-w-6xl px-5 pt-12 pb-20 @2xl:px-8">
        <Encabezado a={a} etiqueta="Agenda" titulo="Eventos de la comunidad" texto="Encuentros, charlas, foros y jornadas. Inscríbete y participa." />
        {proximos.length === 0 ? (
          <p className={`mt-10 rounded-2xl p-8 text-center ${a.k.tarjeta} ${a.k.suave}`}>No hay eventos programados por ahora. Súmate a la comunidad y te avisamos cuando haya uno.</p>
        ) : (
          <ul className="mt-10 grid gap-5 @2xl:grid-cols-2">{proximos.map((e) => <li key={e.id}><TarjetaEvento a={a} ev={e} /></li>)}</ul>
        )}
        {pasados.length > 0 && (
          <div className="mt-16">
            <h2 className={`text-2xl ${a.tit}`}>Ya realizados</h2>
            <ul className="mt-6 grid gap-5 @2xl:grid-cols-2">{pasados.slice(0, 6).map((e) => <li key={e.id} className="opacity-75"><TarjetaEvento a={a} ev={e} /></li>)}</ul>
          </div>
        )}
      </section>
      <SeccionSuscribir a={a} intereses={[]} />
      <EspacioAnuncio a={a} espacio="pie" />
    </>
  );
}

/** La página de un evento: qué es, cuándo y dónde, y el formulario para inscribirse. */
export function VistaEvento({ a, evento, terminado }: { a: Amb; evento: Evento; terminado: boolean }) {
  const cms = a.cms!;
  const slug = cms.urlBase.replace(/^\/p\//, "");
  const lleno = evento.cupo !== null && evento.inscritos >= evento.cupo;
  const cerrado = evento.estado === "cancelado" || terminado || lleno;
  const motivo = evento.estado === "cancelado" ? "Este evento fue cancelado." : terminado ? "Este evento ya terminó." : "El evento ya no tiene cupos disponibles.";
  const bloques = parsearMarkdown(evento.descripcion);
  return (
    <>
      <EspacioAnuncio a={a} espacio="cabecera" />
      <article className="mx-auto max-w-6xl px-5 pt-10 pb-20 @2xl:px-8">
        <Enlace a={a} href={`${cms.urlBase}/eventos`} className={`inline-flex items-center gap-1.5 text-sm font-semibold ${a.k.suave} hover:text-[var(--p)]`}>← Toda la agenda</Enlace>
        <div className="mt-6 grid gap-12 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="max-w-3xl">
            {evento.categoria && <span className={`inline-flex rounded-full px-3.5 py-1.5 text-[0.68rem] font-bold tracking-[0.16em] uppercase ${a.k.etiqueta}`}>{evento.categoria}</span>}
            <h1 className={`mt-4 text-[clamp(2rem,5.6cqi,3.2rem)] leading-[1.08] text-balance ${a.tit}`}>{evento.titulo}</h1>
            <ul className={`mt-6 space-y-3 text-[1.02rem] ${a.k.suave}`}>
              <li className="flex items-start gap-3"><CalendarBlank className="mt-0.5 size-5 shrink-0 text-[var(--p)]" /><span className="capitalize">{diaCorto(evento.iniciaEn)}</span></li>
              <li className="flex items-start gap-3"><Clock className="mt-0.5 size-5 shrink-0 text-[var(--p)]" /><span>{hora(evento.iniciaEn)}{evento.terminaEn ? ` a ${hora(evento.terminaEn)}` : ""} (hora de Colombia)</span></li>
              <li className="flex items-start gap-3">{evento.modalidad === "virtual" ? <VideoCamera className="mt-0.5 size-5 shrink-0 text-[var(--p)]" /> : <MapPin className="mt-0.5 size-5 shrink-0 text-[var(--p)]" />}<span>{dondeEs(evento)}</span></li>
            </ul>
            {bloques.length > 0 && <div className="mt-8"><Prosa a={a} bloques={bloques} /></div>}
          </div>
          <aside className="@4xl:sticky @4xl:top-28 @4xl:self-start">
            <div className={`rounded-[2rem] p-6 ${a.k.tarjeta}`}>
              {cerrado ? (
                <>
                  <p className="text-lg font-bold">{motivo}</p>
                  <p className={`mt-1 text-sm ${a.k.suave}`}>Súmate a la comunidad para enterarte de los próximos encuentros.</p>
                  <Enlace a={a} href={`${cms.urlBase}#portal-suscribir`} className={`mt-5 ${BOTON}`}>Sumarme a la comunidad</Enlace>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold">Inscríbete</p>
                  {evento.cupo !== null && <p className={`mt-0.5 text-sm ${a.k.suave}`}>Quedan {Math.max(0, evento.cupo - evento.inscritos)} cupos.</p>}
                  <FormularioComunidad slug={slug} evento={evento.slug} oscuro={a.tema.oscuro} className="mt-5" gracias={evento.modalidad === "presencial" ? "Te esperamos. Guarda la fecha en tu calendario." : "Te esperamos. Aquí tienes el enlace de la sala:"} />
                </>
              )}
            </div>
          </aside>
        </div>
      </article>
      <EspacioAnuncio a={a} espacio="pie" />
    </>
  );
}
