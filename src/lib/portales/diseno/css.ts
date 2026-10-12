import { color } from "./sanear";
import { FUENTES, REGIONES, type Colores, type DisenoPortal, type EstiloNota, type EstiloRegion, type ItemMenu, type RegionId } from "./tipos";

/**
 * Del diseño al CSS. Todo valor pasa otra vez por validación aquí (colores #rrggbb, números acotados, fuentes de una lista
 * cerrada): jamás se interpola texto libre del editor en una hoja de estilos. Las reglas van sin capa (`@layer`), así que ganan
 * sobre las utilidades de Tailwind sin necesidad de tocar los componentes.
 */

const RAIZ = "[data-portal-root]";
const num = (n: number | undefined | null, min: number, max: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null);

/** Blanco o casi negro, el que mejor se lee sobre ese color (misma regla que el resto del portal). */
export function textoSobreColor(hex: string): string {
  const h = color(hex);
  if (!h) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "#0b1220" : "#ffffff";
}

/** Las variables de acento (las mismas que usa todo el portal) derivadas de un color. */
function variablesAcento(c: string): string {
  return `--p:${c};--p2:color-mix(in oklab, ${c} 70%, white);--ps:color-mix(in oklab, ${c} 9%, white);--pm:color-mix(in oklab, ${c} 55%, white);--pd:color-mix(in oklab, ${c} 62%, black);--sobre:${textoSobreColor(c)};`;
}

function reglaRegion(id: RegionId, e: EstiloRegion, prefijo: string): string[] {
  const sel = `${prefijo}[data-region="${id}"]`;
  const fuera: string[] = [];
  const dentro: string[] = [];
  if (e.oculto) return [`${sel}{display:none !important}`];

  const fondo = color(e.fondo);
  const fondo2 = color(e.fondo2);
  if (fondo) dentro.push(`background:${fondo2 ? `linear-gradient(135deg, ${fondo}, ${fondo2})` : fondo} !important`);
  const texto = color(e.texto);
  if (texto) dentro.push(`color:${texto} !important`, `--texto:${texto}`);
  const acento = color(e.acento);
  if (acento) dentro.push(variablesAcento(acento).replace(/;$/, ""));
  const esc = num(e.escala, 70, 160);
  if (esc && esc !== 100) dentro.push(`zoom:${(esc / 100).toFixed(2)}`);
  const pa = num(e.padArriba, 0, 200);
  const pb = num(e.padAbajo, 0, 200);
  if (id !== "navbar") {
    if (pa !== null) dentro.push(`padding-top:${pa}px !important`);
    if (pb !== null) dentro.push(`padding-bottom:${pb}px !important`);
  }
  const ra = num(e.radio, 0, 48);
  if (ra !== null) fuera.push(id === "navbar" ? `${sel} > div{border-radius:${ra}px !important}` : `${sel}{border-radius:${ra}px !important}`);
  if (e.alinear) dentro.push(`text-align:${e.alinear === "izquierda" ? "left" : e.alinear === "derecha" ? "right" : "center"}`);
  const ancho = num(e.anchoMax, 640, 1920);
  if (ancho !== null) fuera.push(`${sel} .max-w-6xl, ${sel} .max-w-3xl{max-width:${ancho}px !important}`);

  const ft = e.fuenteTitulos ? FUENTES[e.fuenteTitulos]?.css : null;
  const fx = e.fuenteTexto ? FUENTES[e.fuenteTexto]?.css : null;
  if (fx) fuera.push(`${sel}, ${sel} :where(.font-sans, p, span, li, a, button){font-family:${fx}}`);
  if (ft) fuera.push(`${sel} :is(h1,h2,h3,h4), ${sel} .font-display{font-family:${ft}}`);
  // El texto de la región gana también sobre las clases de «texto atenuado» (text-black/60, text-white/70…).
  if (texto) fuera.push(`${sel} [class*="text-black/"], ${sel} [class*="text-white/"]{color:color-mix(in oklab, ${texto} 72%, transparent) !important}`);

  return [dentro.length ? `${sel}{${dentro.join(";")}}` : "", ...fuera].filter(Boolean);
}

function reglaNota(id: string, n: EstiloNota): string[] {
  const sel = `${RAIZ} [data-nota="${id}"]`;
  if (n.oculta) return [`${sel}{display:none !important}`];
  const tit: string[] = [];
  const esc = n.escalaTitulo ?? (n.tamano === "L" ? 130 : n.tamano === "S" ? 90 : undefined);
  if (esc && esc !== 100) tit.push(`zoom:${(num(esc, 70, 200)! / 100).toFixed(2)}`);
  if (n.negrita) tit.push("font-weight:800");
  if (n.cursiva) tit.push("font-style:italic");
  const c = color(n.colorTitulo);
  if (c) tit.push(`color:${c} !important`);
  const r: string[] = [];
  if (tit.length) r.push(`${sel} .titulo-nota{${tit.join(";")}}`);
  const alto = num(n.imagenAlto, 80, 800);
  if (n.sinImagen) r.push(`${sel} .portada-nota{display:none !important}`);
  else if (alto) r.push(`${sel} .portada-nota{aspect-ratio:auto !important;height:${alto}px !important}`);
  if (n.tamano === "L") r.push(`@container (min-width: 56rem){${RAIZ} li:has(> [data-nota="${id}"]){grid-column:span 2}}`);
  return r;
}

export function disenoCss(d: DisenoPortal): string {
  const r: string[] = [];
  const ft = FUENTES[d.base.fuenteTitulos]?.css;
  const fx = FUENTES[d.base.fuenteTexto]?.css;
  if (fx) r.push(`${RAIZ}, ${RAIZ} :where(.font-sans, p, span, li, a, button, input, textarea, select){font-family:${fx}}`);
  if (ft) r.push(`${RAIZ} :is(h1,h2,h3,h4), ${RAIZ} .font-display{font-family:${ft}}`);
  const esc = num(d.base.escala, 80, 140);
  if (esc && esc !== 100) r.push(`${RAIZ}{zoom:${(esc / 100).toFixed(2)}}`);
  const ra = num(d.base.radio, 0, 48);
  if (ra !== null) r.push(`${RAIZ} [data-region="tarjetas"]{border-radius:${ra}px}`);
  const ancho = num(d.base.anchoMax, 640, 1920);
  if (ancho !== null) r.push(`${RAIZ} .max-w-6xl, ${RAIZ} .max-w-3xl{max-width:${ancho}px}`);

  for (const { id } of REGIONES) {
    const e = d.regiones[id];
    if (!e) continue;
    r.push(...reglaRegion(id, e, `${RAIZ} `));
    // Colores propios de un modo: ganan sobre los generales de la región cuando el portal está en ese modo.
    for (const modo of ["claro", "oscuro"] as const) {
      const m = e[modo];
      if (m) r.push(...reglaRegion(id, { fondo: m.fondo, texto: m.texto, acento: m.acento }, `${RAIZ}[data-modo="${modo}"] `).filter((x) => !x.includes("display:none")));
    }
  }
  for (const [id, n] of Object.entries(d.notas)) r.push(...reglaNota(id, n));
  return r.join("\n");
}

/** Los colores que cambian el tema base del portal en el modo efectivo (las variables que usa todo el portal). */
export function coloresDeModo(d: DisenoPortal, modo: "claro" | "oscuro"): Colores {
  return d.base[modo];
}

/** Menú: aplica el orden, los nombres y lo oculto del diseño a los enlaces que el portal ya tiene. */
export function aplicarMenu<T extends { id: string; texto: string }>(items: T[], menu: ItemMenu[]): T[] {
  if (menu.length === 0) return items;
  const porId = new Map(menu.map((m, i) => [m.id, { ...m, i }]));
  const conAjuste = items
    .map((it, orig) => ({ it, orig, aj: porId.get(it.id) }))
    .filter((x) => !x.aj?.oculto)
    .map((x) => ({ ...x, it: x.aj?.texto ? { ...x.it, texto: x.aj.texto } : x.it }));
  // Los que el editor ordenó van primero, en su orden; los demás, detrás y en su orden natural.
  return conAjuste
    .sort((a, b) => (a.aj && b.aj ? a.aj.i - b.aj.i : a.aj ? -1 : b.aj ? 1 : a.orig - b.orig))
    .map((x) => x.it);
}

/** Notas: quita las ocultas y pone primero las fijadas, de menor a mayor; el resto conserva su orden. */
export function aplicarNotas<T extends { id: string }>(arts: T[], notas: Record<string, EstiloNota>): T[] {
  const visibles = arts.filter((a) => !notas[a.id]?.oculta);
  return visibles
    .map((a, i) => ({ a, i, f: notas[a.id]?.fijar }))
    .sort((x, y) => (x.f !== undefined && y.f !== undefined ? x.f - y.f : x.f !== undefined ? -1 : y.f !== undefined ? 1 : x.i - y.i))
    .map((x) => x.a);
}
