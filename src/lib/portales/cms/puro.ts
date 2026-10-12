import { ESPACIOS_IDS, type Anuncio } from "./tipos";
import type { EspacioId } from "./tematicas";

/** Funciones puras del CMS de portales (sin red ni React), para poder probarlas solas: enlaces, lectura, anuncios y markdown. */

/** Cookie con el portal por el que la persona llegó a la afiliación: al afiliarse, ese portal se anota como el que la trajo. */
export const COOKIE_ORIGEN = "el_origen";

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** «Cómo cuidar tu piel» → «como-cuidar-tu-piel» (hasta `max` caracteres, sin cortar una palabra a medias si se puede). */
export function slugDeTitulo(titulo: string, max = 90): string {
  const base = sinTildes(titulo).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (base.length <= max) return base;
  const corte = base.slice(0, max);
  const guion = corte.lastIndexOf("-");
  return (guion > max * 0.6 ? corte.slice(0, guion) : corte).replace(/-+$/, "");
}

/** Un enlace que no esté en `usados`: si ya existe, le agrega -2, -3... */
export function slugUnico(base: string, usados: ReadonlySet<string>, max = 90): string {
  const raiz = base.length >= 3 ? base : `articulo-${base}`.slice(0, max);
  if (!usados.has(raiz)) return raiz;
  for (let n = 2; ; n++) {
    const sufijo = `-${n}`;
    const candidato = `${raiz.slice(0, max - sufijo.length).replace(/-+$/, "")}${sufijo}`;
    if (!usados.has(candidato)) return candidato;
  }
}

export function minutosDeLectura(markdown: string): number {
  const palabras = markdown.replace(/[#>*_`\-[\]()]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 200));
}

/** Hoy en Colombia (UTC-5) como AAAA-MM-DD, para comparar con las fechas de los anuncios. */
export const hoyColombia = (ahora = Date.now()) => new Date(ahora - 5 * 3_600_000).toISOString().slice(0, 10);

export function anuncioVigente(a: Pick<Anuncio, "estado" | "desde" | "hasta">, hoy = hoyColombia()): boolean {
  return a.estado === "activo" && (!a.desde || a.desde <= hoy) && (!a.hasta || a.hasta >= hoy);
}

/**
 * El anuncio que se muestra en un espacio: entre los vigentes, uno al azar con más probabilidad cuanto mayor su prioridad.
 * `azar` es un número de 0 a 1 (se recibe para poder probar la elección).
 */
export function elegirAnuncio(anuncios: Anuncio[], espacio: string, azar: number, hoy = hoyColombia()): Anuncio | null {
  const candidatos = anuncios.filter((a) => a.espacio === espacio && anuncioVigente(a, hoy));
  if (candidatos.length === 0) return null;
  const total = candidatos.reduce((s, a) => s + a.prioridad, 0);
  let meta = Math.min(Math.max(azar, 0), 0.999999) * total;
  for (const a of candidatos) {
    meta -= a.prioridad;
    if (meta < 0) return a;
  }
  return candidatos[candidatos.length - 1];
}

// ------------------------------------------------------------- markdown ---

export type Trozo = { tipo: "texto" | "negrita" | "cursiva" | "enlace"; texto: string; href?: string };
export type Bloque =
  | { tipo: "h2" | "h3" | "p" | "cita"; trozos: Trozo[] }
  | { tipo: "ul" | "ol"; items: Trozo[][] }
  | { tipo: "hr" }
  /** Imagen en su propia línea: `![texto alternativo](https://…)`; el pie, si lo hay, va entre comillas tras el enlace. */
  | { tipo: "img"; src: string; alt: string; pie: string };

/** Solo imágenes por https: nunca `javascript:`, `data:` ni rutas relativas. */
const IMAGEN = /^!\[([^\]\n]{0,160})\]\((https:\/\/[^\s)"]+)(?:\s+"([^"\n]{0,200})")?\)$/;

const INLINE = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|(?<![*\w])\*[^*\s][^*\n]*\*(?![*\w])|(?<![_\w])_[^_\s][^_\n]*_(?![_\w]))/g;

/** Negritas, cursivas y enlaces (solo http y https). Todo lo demás es texto plano: nunca se interpreta HTML. */
export function parsearInline(texto: string): Trozo[] {
  const salida: Trozo[] = [];
  let desde = 0;
  for (const m of texto.matchAll(INLINE)) {
    const i = m.index ?? 0;
    if (i > desde) salida.push({ tipo: "texto", texto: texto.slice(desde, i) });
    const t = m[0];
    if (t.startsWith("**")) salida.push({ tipo: "negrita", texto: t.slice(2, -2) });
    else if (t.startsWith("[")) {
      const cierre = t.indexOf("](");
      salida.push({ tipo: "enlace", texto: t.slice(1, cierre), href: t.slice(cierre + 2, -1) });
    } else salida.push({ tipo: "cursiva", texto: t.slice(1, -1) });
    desde = i + t.length;
  }
  if (desde < texto.length) salida.push({ tipo: "texto", texto: texto.slice(desde) });
  return salida;
}

/** Markdown básico: títulos (#, ##, ###), párrafos, listas, citas, separadores e imágenes (solo https). */
export function parsearMarkdown(md: string): Bloque[] {
  const bloques: Bloque[] = [];
  const lineas = md.replace(/\r\n?/g, "\n").split("\n");
  let parrafo: string[] = [];
  let lista: { tipo: "ul" | "ol"; items: string[] } | null = null;
  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: "p", trozos: parsearInline(parrafo.join(" ")) });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) bloques.push({ tipo: lista.tipo, items: lista.items.map(parsearInline) });
    lista = null;
  };
  for (const cruda of lineas) {
    const l = cruda.trim();
    if (!l) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }
    const img = l.match(IMAGEN);
    if (img) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: "img", src: img[2], alt: img[1], pie: img[3] ?? "" });
      continue;
    }
    const titulo = l.match(/^(#{1,4})\s+(.+)$/);
    const ul = l.match(/^[-*•]\s+(.+)$/);
    const ol = l.match(/^\d{1,2}[.)]\s+(.+)$/);
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(l)) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: "hr" });
    } else if (titulo) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: titulo[1].length >= 3 ? "h3" : "h2", trozos: parsearInline(titulo[2]) });
    } else if (ul || ol) {
      cerrarParrafo();
      const tipo = ul ? "ul" : "ol";
      if (lista && lista.tipo !== tipo) cerrarLista();
      lista ??= { tipo, items: [] };
      lista.items.push((ul ?? ol)![1]);
    } else if (l.startsWith(">")) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: "cita", trozos: parsearInline(l.replace(/^>\s?/, "")) });
    } else {
      cerrarLista();
      parrafo.push(l);
    }
  }
  cerrarParrafo();
  cerrarLista();
  return bloques;
}

/** Cuántos bloques de párrafo hay antes de un punto: dónde insertar el anuncio «dentro del artículo». */
export function posicionAnuncioEnArticulo(bloques: Bloque[]): number {
  let parrafos = 0;
  for (let i = 0; i < bloques.length; i++) {
    if (bloques[i].tipo === "p" && ++parrafos === 3) return i + 1;
  }
  return -1;
}

/** El anuncio que le toca a cada espacio en esta visita (los espacios sin anuncio vigente no aparecen). */
export function elegirPorEspacio(anuncios: Anuncio[], azar: () => number, hoy = hoyColombia()): Partial<Record<EspacioId, Anuncio>> {
  const salida: Partial<Record<EspacioId, Anuncio>> = {};
  for (const e of ESPACIOS_IDS) {
    const a = elegirAnuncio(anuncios, e, azar(), hoy);
    if (a) salida[e] = a;
  }
  return salida;
}
