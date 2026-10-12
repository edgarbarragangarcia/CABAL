import * as React from "react";
import { MapPin } from "@phosphor-icons/react/dist/ssr";

import { PLANTILLAS, plantillaPorId, type ConfigPortal, type Plantilla, type PlantillaId } from "@/lib/portales/plantillas";
import type { EspacioId } from "@/lib/portales/cms/tematicas";
import type { AjustesPortal, Anuncio } from "@/lib/portales/cms/tipos";
import { aplicarMenu, disenoCss } from "@/lib/portales/diseno/css";
import type { DisenoPortal } from "@/lib/portales/diseno/tipos";
import { AvisoBorrador, Emergente, SeleccionVista } from "./diseno-cliente";
import { Ic, textoSobre } from "./piezas";

/**
 * El marco de un portal: tema de color y tipografía de su temática, encabezado y pie. Lo comparten el inicio (`PortalView`) y
 * las páginas de artículos, así que todo el portal se ve de una pieza. Sin estado ni hooks: sirve igual en el servidor y en el
 * cliente, y se adapta al ancho de su contenedor (container queries), no al de la pantalla.
 */

export type Tema = { oscuro: boolean; serif: boolean; fondo: string; texto: string; alterno: string; sec: string; ter: string };
export const TEMAS: Record<PlantillaId, Tema> = {
  salud: { oscuro: false, serif: false, fondo: "#f4fafa", texto: "#0b2323", alterno: "#ffffff", sec: "#38bdf8", ter: "#a7f3d0" },
  belleza: { oscuro: false, serif: true, fondo: "#fffaf7", texto: "#2b1a22", alterno: "#fff1ec", sec: "#f59e0b", ter: "#fbcfe8" },
  "motos-autos": { oscuro: true, serif: false, fondo: "#0a0c10", texto: "#eef2f7", alterno: "#0e1117", sec: "#ef4444", ter: "#3b82f6" },
  "hogar-cuidado": { oscuro: false, serif: true, fondo: "#fbf7f0", texto: "#2a2a24", alterno: "#f6efe3", sec: "#e07a5f", ter: "#f2cc8f" },
};

export type Claves = { suave: string; tarjeta: string; cabecera: string; pildora: string; etiqueta: string; boton2: string; linea: string; anillo: string };
const CLARO: Claves = {
  suave: "text-black/60",
  tarjeta: "border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_22px_44px_-28px_rgba(15,23,42,0.28)]",
  cabecera: "border-black/5 bg-white/75 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.4)]",
  pildora: "border-black/[0.07] bg-white/70 text-black/70",
  etiqueta: "bg-[var(--p)]/10 text-[var(--p)]",
  boton2: "border border-black/10 bg-white/70 text-[var(--texto)] hover:bg-white",
  linea: "border-black/10",
  anillo: "ring-white",
};
const OSCURO: Claves = {
  suave: "text-white/60",
  tarjeta: "border border-white/[0.08] bg-white/[0.04] shadow-[0_22px_44px_-28px_rgba(0,0,0,0.8)] backdrop-blur",
  cabecera: "border-white/10 bg-[#0a0c10]/70 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]",
  pildora: "border-white/10 bg-white/[0.06] text-white/75",
  etiqueta: "bg-[var(--p)]/15 text-[var(--p)]",
  boton2: "border border-white/15 bg-white/[0.06] text-white hover:bg-white/10",
  linea: "border-white/10",
  anillo: "ring-[#12161d]",
};

/** Lo del centro de operaciones que el marco necesita: enlaces propios del portal publicado, su llamado a sumarse y los anuncios elegidos. */
export type DatosCms = {
  /** /p/<enlace> */
  urlBase: string;
  /** Hay artículos publicados: el encabezado y el pie los enlazan. */
  articulos: boolean;
  /** Hay eventos publicados: el encabezado y el pie enlazan la agenda. */
  eventos: boolean;
  /** Páginas fijas publicadas que salen en el menú y en el pie. */
  paginas: { slug: string; titulo: string }[];
  union: AjustesPortal["union"];
  editor: string;
  /** Enlace con conteo que lleva a la afiliación de la comunidad y recuerda de qué portal vino la persona. */
  hrefUnete: string;
  hrefAnuncio: (id: string) => string;
  /** El anuncio que toca mostrar en cada espacio (si lo hay). */
  elegidos: Partial<Record<EspacioId, Anuncio>>;
  /** El diseño del portal (colores, regiones, menú…); null = el de la plantilla tal cual. */
  diseno?: DisenoPortal | null;
  /** El administrador está viendo el borrador del diseño: no cuenta visitas ni lo ve nadie más. */
  vista?: boolean;
  /** Los últimos titulares, para el cintillo. */
  titulares?: { titulo: string; href: string }[];
  /** Para avisar del borrador y salir de la vista previa. */
  portalId?: string;
};

/** Todo lo que comparten las secciones: la plantilla, la configuración, el tema y cómo se arman los enlaces. */
export type Amb = {
  id: PlantillaId;
  t: Plantilla;
  c: ConfigPortal;
  tema: Tema;
  k: Claves;
  /** Clases tipográficas de los titulares (serifa ligera o sans en negrita). */
  tit: string;
  demo: boolean;
  enlaces: boolean;
  wa: string;
  hrefCta: string;
  /** Lo que dice el botón principal: sumarse a la comunidad. */
  textoCta: string;
  /** El segundo botón del inicio (la agenda, los artículos o, en las demos, las secciones) y su texto. */
  hrefSecundario: string;
  textoSecundario: string;
  base: string;
  ancla: (s: string) => string;
  /** Prefijo de los enlaces a las secciones del inicio: vacío dentro del inicio y `/p/<enlace>` en las demás páginas. */
  inicio: string;
  /** null en las demos y en las vistas previas del panel. */
  cms: DatosCms | null;
  /** Se muestra la sección de contacto: en un portal publicado, solo si tiene a dónde escribir. */
  contacto: boolean;
};

export const BOTON = "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] px-6 py-3 text-sm font-bold whitespace-nowrap text-[var(--sobre)] shadow-[0_18px_36px_-16px_var(--p)] transition hover:-translate-y-0.5 hover:brightness-110";

export type OpcionesAmbiente = {
  plantilla: PlantillaId;
  config: ConfigPortal;
  demo: boolean;
  enlaces: boolean;
  idBase: string;
  cms?: DatosCms | null;
  /** Para las páginas que no son el inicio. */
  desdeInicio?: boolean;
};

/** Las variables de color del portal y el ambiente que reciben todas sus piezas. */
export function construirAmbiente(o: OpcionesAmbiente): { a: Amb; vars: React.CSSProperties } {
  const c = o.config;
  const t = plantillaPorId(o.plantilla) ?? PLANTILLAS[0];
  let tema = TEMAS[t.id];
  const d = o.cms?.diseno ?? null;
  // El diseño puede forzar el modo claro u oscuro y cambiar los colores de ese modo; el acento reemplaza al color del portal.
  let p = c.colorPrimario;
  let sec = tema.sec;
  if (d) {
    const modo = d.base.modo === "plantilla" ? (tema.oscuro ? "oscuro" : "claro") : d.base.modo;
    if ((modo === "oscuro") !== tema.oscuro) {
      tema = modo === "oscuro" ? { ...tema, oscuro: true, fondo: "#0a0c10", texto: "#eef2f7", alterno: "#0e1117" } : { ...tema, oscuro: false, fondo: "#f7f8fa", texto: "#10161d", alterno: "#ffffff" };
    }
    const m = d.base[modo];
    tema = { ...tema, ...(m.fondo ? { fondo: m.fondo } : {}), ...(m.texto ? { texto: m.texto } : {}), ...(m.alterno ? { alterno: m.alterno } : {}) };
    if (m.acento) p = m.acento;
    if (m.acento2) sec = m.acento2;
  }
  const vars = {
    "--p": p,
    "--p2": `color-mix(in oklab, ${p} 52%, ${sec})`,
    "--ps": `color-mix(in oklab, ${p} 9%, white)`,
    "--pm": `color-mix(in oklab, ${p} 55%, white)`,
    "--pd": `color-mix(in oklab, ${p} 62%, black)`,
    "--sobre": textoSobre(p),
    "--fondo": tema.fondo,
    "--alt": tema.alterno,
    "--texto": tema.texto,
  } as React.CSSProperties;
  const wa = c.whatsapp ? `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(`Hola, quiero información sobre ${c.nombre}.`)}` : "";
  const ancla = (s: string) => `${o.idBase}-${s}`;
  const cms = o.cms ?? null;
  const inicio = o.desdeInicio && cms ? cms.urlBase : "";
  // En un portal publicado no se enseña «agrega un WhatsApp…»: sin a dónde escribir, la sección no sale y la acción lleva a sumarse.
  const contacto = c.secciones.contacto && (!cms || !!(wa || c.correo));
  return {
    vars,
    a: {
      id: t.id, t, c, tema, k: tema.oscuro ? OSCURO : CLARO, demo: o.demo, enlaces: o.enlaces, wa, base: o.idBase, ancla, inicio, cms, contacto,
      tit: tema.serif ? "font-display font-light tracking-[-0.02em]" : "font-sans font-extrabold tracking-[-0.035em]",
      // El botón principal de una comunidad lleva siempre al formulario para sumarse; en las demos, a la sección de contacto o al WhatsApp.
      hrefCta: cms ? `${inicio}#${ancla("suscribir")}` : contacto ? `${inicio}#${ancla("contacto")}` : wa || "#",
      textoCta: c.cta,
      hrefSecundario: cms ? (cms.eventos ? `${cms.urlBase}/eventos` : cms.articulos ? `${inicio}#${ancla("articulos")}` : "") : c.secciones.servicios ? `${inicio}#${ancla("servicios")}` : "",
      textoSecundario: cms ? (cms.eventos ? t.hero.ctaSecundaria : "Leer lo último") : "Conocer la comunidad",
    },
  };
}

/** En la vista previa del panel los enlaces no deben navegar: se dibujan como un `span` con la misma apariencia. */
export function Enlace({ a, href, className, children, region, nota }: { a: Amb; href: string; className: string; children: React.ReactNode; /** Región editable a la que pertenece (diseño del portal). */ region?: string; /** Id de la nota: su estilo propio del diseño. */ nota?: string }) {
  const attrs = { ...(region ? { "data-region": region } : {}), ...(nota ? { "data-nota": nota } : {}) };
  return a.enlaces ? <a href={href} className={className} {...attrs}>{children}</a> : <span className={className} {...attrs}>{children}</span>;
}

export function Encabezado({ a, etiqueta, titulo, texto }: { a: Amb; etiqueta: string; titulo: string; texto?: string }) {
  return (
    <div data-region="encabezado" className="max-w-2xl">
      <span className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[0.68rem] font-bold tracking-[0.16em] uppercase ${a.k.etiqueta}`}>{etiqueta}</span>
      <h2 className={`mt-4 text-[clamp(1.9rem,5.2cqi,3rem)] leading-[1.08] text-balance ${a.tit}`}>{titulo}</h2>
      {texto && <p className={`mt-3 text-[1.02rem] ${a.k.suave}`}>{texto}</p>}
    </div>
  );
}

type ItemNav = { href: string; texto: string };
type ItemMenuNav = ItemNav & { id: string };

/** El encabezado flotante: logo, enlaces y un botón de acción (en el inicio, la acción del portal; en los artículos, sumarse). */
export function Cabecera({ a, secciones, accion }: { a: Amb; secciones: { id: string; texto: string }[]; accion?: ItemNav }) {
  const { c, t, k } = a;
  const navBase: ItemMenuNav[] = [
    ...(a.cms ? [{ id: "inicio", href: a.cms.urlBase, texto: "Inicio" }] : []),
    // «Artículos» y «Eventos» tienen el mismo identificador en el inicio y en las demás páginas: el menú del diseño vale en ambas.
    ...secciones.map((s) => ({ id: s.id === "articulos" || s.id === "eventos" ? s.id : `seccion:${s.id}`, href: `${a.inicio}#${a.ancla(s.id)}`, texto: s.texto })),
    // En el inicio, «Artículos» ya viene entre las secciones (baja hasta ellos); en las demás páginas lleva al listado.
    ...(a.cms?.articulos && !secciones.some((s) => s.id === "articulos") ? [{ id: "articulos", href: `${a.cms.urlBase}/articulos`, texto: "Artículos" }] : []),
    ...(a.cms?.eventos && !secciones.some((s) => s.id === "eventos") ? [{ id: "eventos", href: `${a.cms.urlBase}/eventos`, texto: "Eventos" }] : []),
    ...(a.cms?.paginas ?? []).map((p) => ({ id: `pagina:${p.slug}`, href: `${a.cms!.urlBase}/pagina/${p.slug}`, texto: p.titulo })),
  ];
  // El editor puede reordenar, renombrar u ocultar los enlaces del menú.
  const nav = aplicarMenu(navBase, a.cms?.diseno?.menu ?? []);
  const boton = accion ?? { href: a.hrefCta, texto: a.textoCta };
  return (
    <header data-region="navbar" className="sticky top-0 z-30 px-3 pt-3 @2xl:px-6">
      <div className={`mx-auto flex max-w-6xl items-center gap-3 rounded-full border py-2 pr-2 pl-3 backdrop-blur-xl ${k.cabecera}`}>
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--p)] to-[var(--p2)] text-[var(--sobre)] shadow-[0_10px_20px_-10px_var(--p)]"><Ic id={t.icono} weight="duotone" className="size-6" /></span>
        <div className="min-w-0 leading-tight">
          <p className={`truncate text-[1.05rem] font-bold ${a.tema.serif ? "font-display" : ""}`}>{c.nombre}</p>
          {c.ciudad && <p className={`flex items-center gap-1 text-[0.68rem] ${k.suave}`}><MapPin weight="fill" className="size-3" />{c.ciudad}</p>}
        </div>
        <nav className={`mx-auto hidden items-center gap-1 text-sm font-medium @3xl:flex ${k.suave}`}>
          {nav.map((s) => <Enlace key={s.texto} a={a} href={s.href} className="rounded-full px-3.5 py-1.5 transition hover:bg-[var(--p)]/10 hover:text-[var(--p)]">{s.texto}</Enlace>)}
        </nav>
        <Enlace a={a} href={boton.href} className={`${BOTON} ml-auto !px-5 !py-2.5 @3xl:ml-0`}>{boton.texto}</Enlace>
      </div>
    </header>
  );
}

export function Pie({ a }: { a: Amb }) {
  const { c, t, tema, cms } = a;
  return (
    <footer data-region="pie" className="border-t border-white/10 bg-[#0c1017] text-white/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 @2xl:px-8 @3xl:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-[var(--p)] to-[var(--p2)] text-[var(--sobre)]"><Ic id={t.icono} weight="duotone" className="size-6" /></span><p className={`text-lg font-bold text-white ${tema.serif ? "font-display" : ""}`}>{c.nombre}</p></div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed">{c.eslogan}</p>
          {t.aviso && <p className="mt-4 max-w-sm text-xs leading-relaxed text-white/45">{t.aviso}</p>}
        </div>
        <div><p className="text-xs font-bold tracking-[0.16em] text-white/40 uppercase">La comunidad</p><ul className="mt-4 space-y-2.5 text-sm">{t.servicios.items.slice(0, 5).map((s) => <li key={s.titulo}>{s.titulo}</li>)}</ul></div>
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-white/40 uppercase">Portal</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {cms ? (
              <>
                <li><Enlace a={a} href={cms.urlBase} className="hover:text-white">Inicio</Enlace></li>
                {cms.articulos && <li><Enlace a={a} href={`${cms.urlBase}/articulos`} className="hover:text-white">Artículos</Enlace></li>}
                {cms.eventos && <li><Enlace a={a} href={`${cms.urlBase}/eventos`} className="hover:text-white">Eventos</Enlace></li>}
                {cms.paginas.map((p) => <li key={p.slug}><Enlace a={a} href={`${cms.urlBase}/pagina/${p.slug}`} className="hover:text-white">{p.titulo}</Enlace></li>)}
                <li><Enlace a={a} href={cms.hrefUnete} className="hover:text-white">Únete a la comunidad</Enlace></li>
              </>
            ) : (
              <><li>Cómo participar</li><li>Preguntas frecuentes</li><li>Contacto</li></>
            )}
            {c.ciudad && <li className="flex items-center gap-1.5"><MapPin className="size-3.5" />{c.ciudad}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/45">
        {cms ? cms.editor || "Portal editado por su equipo" : a.demo ? "Plantilla de demostración · contenido de ejemplo" : "Portal generado con el generador de portales"}
      </div>
    </footer>
  );
}

/** El cintillo de titulares (o de mensajes propios) bajo el encabezado, en movimiento continuo y detenido al pasar el cursor. */
function Cintillo({ a }: { a: Amb }) {
  const d = a.cms?.diseno;
  const c = d?.cintillo;
  if (!d || !c?.activo) return null;
  const items: { texto: string; href: string | null }[] =
    c.origen === "mensajes"
      ? c.mensajes.map((m) => ({ texto: m, href: null }))
      : (a.cms?.titulares ?? []).slice(0, c.cantidad).map((t) => ({ texto: t.titulo, href: t.href }));
  if (items.length === 0) return null;
  // De 1 (lento) a 10 (rápido): más titulares, más tiempo para recorrerlos.
  const segundos = Math.max(8, Math.round((items.length * 9 * (11 - c.velocidad)) / 4));
  const fila = (clave: string) => (
    <ul key={clave} aria-hidden={clave === "b" ? true : undefined} className="flex shrink-0 items-center">
      {items.map((it, i) => (
        <li key={`${clave}${i}`} className="flex shrink-0 items-center gap-6 pr-6 text-sm font-medium whitespace-nowrap">
          {it.href ? <Enlace a={a} href={it.href} className="hover:underline">{it.texto}</Enlace> : <span>{it.texto}</span>}
          <span aria-hidden="true" className="opacity-50">◆</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div role="region" aria-label="Titulares" data-cintillo className="relative z-20 mt-3 flex items-center overflow-hidden border-y border-black/10 bg-[var(--p)] text-[var(--sobre)]">
      <style>{`@keyframes portal-cintillo{from{transform:translateX(0)}to{transform:translateX(-50%)}}[data-cintillo] .pista{animation:portal-cintillo ${segundos}s linear infinite}[data-cintillo]:hover .pista{animation-play-state:paused}@media (prefers-reduced-motion:reduce){[data-cintillo] .pista{animation:none;overflow-x:auto}}`}</style>
      <span className="z-10 shrink-0 bg-black/25 px-4 py-2 text-xs font-bold tracking-[0.14em] uppercase">{c.etiqueta}</span>
      <div className="min-w-0 flex-1 overflow-hidden py-2 pl-4">
        <div className="pista flex w-max">{fila("a")}{fila("b")}</div>
      </div>
    </div>
  );
}

/** El portal completo alrededor de su contenido: raíz con las variables de color, cinta de demostración, encabezado y pie. */
export function MarcoPortal({ a, vars, secciones, accion, children }: { a: Amb; vars: React.CSSProperties; secciones: { id: string; texto: string }[]; accion?: ItemNav; children: React.ReactNode }) {
  const d = a.cms?.diseno ?? null;
  const vista = !!a.cms?.vista;
  return (
    // `overflow-x-clip` (y no `hidden`): recorta lo que se sale a los lados sin volver este bloque el contenedor de scroll, así el encabezado sí se queda pegado al desplazarse.
    <div data-portal-root data-modo={a.tema.oscuro ? "oscuro" : "claro"} style={vars} className="@container relative isolate w-full overflow-x-clip bg-[var(--fondo)] text-[var(--texto)]">
      {d && <style>{disenoCss(d)}</style>}
      {a.demo && <div className="bg-[#0c1017] px-4 py-1.5 text-center text-[0.7rem] font-medium tracking-wide text-white/80">Portal de demostración · el contenido es de ejemplo</div>}
      <Cabecera a={a} secciones={secciones} accion={accion} />
      <Cintillo a={a} />
      {children}
      <Pie a={a} />
      {d && a.cms && <Emergente config={d.emergente} portal={a.cms.urlBase} vista={vista} />}
      {vista && <SeleccionVista />}
      {vista && a.cms?.portalId && <AvisoBorrador portalId={a.cms.portalId} />}
    </div>
  );
}
