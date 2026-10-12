import {
  CONTROLES, FUENTES_IDS, REGIONES, SECCIONES_INICIO, disenoVacio,
  type Colores, type ColoresRegion, type DisenoPortal, type EstiloNota, type EstiloRegion, type FuenteId, type RegionId, type SeccionId,
} from "./tipos";

/**
 * Valida un diseño venido de cualquier parte (el editor, lo guardado, una API): cada campo se corrige o se descarta, nunca se
 * interpola sin validar en CSS. Lo que no sea válido vuelve a su valor por defecto; nunca lanza.
 */

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const bool = (v: unknown, defecto = false) => (typeof v === "boolean" ? v : defecto);
const entre = (v: unknown, min: number, max: number): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : undefined;
};

/** #rgb o #rrggbb → #rrggbb en minúsculas; cualquier otra cosa se descarta. */
export function color(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = v.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return undefined;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}

const fuente = (v: unknown): FuenteId | undefined => (typeof v === "string" && (FUENTES_IDS as string[]).includes(v) ? (v as FuenteId) : undefined);

function colores(v: unknown): Colores {
  if (!esObj(v)) return {};
  const o: Colores = {};
  for (const k of ["fondo", "texto", "alterno", "acento", "acento2"] as const) {
    const c = color(v[k]);
    if (c) o[k] = c;
  }
  return o;
}

function coloresRegion(v: unknown): ColoresRegion | undefined {
  if (!esObj(v)) return undefined;
  const o: ColoresRegion = {};
  for (const k of ["fondo", "texto", "acento"] as const) {
    const c = color(v[k]);
    if (c) o[k] = c;
  }
  return Object.keys(o).length ? o : undefined;
}

function region(v: unknown, id: RegionId): EstiloRegion | undefined {
  if (!esObj(v)) return undefined;
  const permitidos = new Set(CONTROLES[id]);
  const o: EstiloRegion = {};
  const poner = <K extends keyof EstiloRegion>(k: K, val: EstiloRegion[K] | undefined) => {
    if (val !== undefined) o[k] = val;
  };
  if (permitidos.has("fondo")) poner("fondo", color(v.fondo));
  if (permitidos.has("degradado")) poner("fondo2", color(v.fondo2));
  if (permitidos.has("texto")) poner("texto", color(v.texto));
  if (permitidos.has("acento")) poner("acento", color(v.acento));
  if (permitidos.has("fondo") || permitidos.has("texto") || permitidos.has("acento")) {
    poner("claro", coloresRegion(v.claro));
    poner("oscuro", coloresRegion(v.oscuro));
  }
  if (permitidos.has("fuentes")) {
    poner("fuenteTitulos", fuente(v.fuenteTitulos));
    poner("fuenteTexto", fuente(v.fuenteTexto));
  }
  if (permitidos.has("escala")) poner("escala", entre(v.escala, 70, 160));
  if (permitidos.has("padding")) {
    poner("padArriba", entre(v.padArriba, 0, 200));
    poner("padAbajo", entre(v.padAbajo, 0, 200));
  }
  if (permitidos.has("radio")) poner("radio", entre(v.radio, 0, 48));
  if (permitidos.has("ancho")) poner("anchoMax", entre(v.anchoMax, 640, 1920));
  if (permitidos.has("alinear") && (v.alinear === "izquierda" || v.alinear === "centro" || v.alinear === "derecha")) o.alinear = v.alinear;
  if (permitidos.has("ocultar") && v.oculto === true) o.oculto = true;
  return Object.keys(o).length ? o : undefined;
}

function nota(v: unknown): EstiloNota | undefined {
  if (!esObj(v)) return undefined;
  const o: EstiloNota = {};
  if (v.tamano === "S" || v.tamano === "M" || v.tamano === "L") o.tamano = v.tamano;
  const e = entre(v.escalaTitulo, 70, 200);
  if (e !== undefined && e !== 100) o.escalaTitulo = e;
  if (v.negrita === true) o.negrita = true;
  if (v.cursiva === true) o.cursiva = true;
  const c = color(v.colorTitulo);
  if (c) o.colorTitulo = c;
  const alto = entre(v.imagenAlto, 80, 800);
  if (alto) o.imagenAlto = alto;
  if (v.sinImagen === true) o.sinImagen = true;
  const f = entre(v.fijar, 1, 99);
  if (f !== undefined) o.fijar = f;
  if (v.oculta === true) o.oculta = true;
  return Object.keys(o).length ? o : undefined;
}

const fechaIso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);

/** Enlace de la ventana emergente: https o una ruta del propio sitio (nunca javascript: ni datos). */
export function enlaceSeguro(v: unknown): string {
  const s = texto(v, 400);
  if (/^https:\/\/[^\s]+$/i.test(s)) return s;
  if (/^\/(?!\/)[^\s]*$/.test(s)) return s;
  return "";
}

export function sanearDiseno(entrada: unknown): DisenoPortal {
  const d = disenoVacio();
  if (!esObj(entrada)) return d;

  const b = esObj(entrada.base) ? entrada.base : {};
  d.base.modo = b.modo === "claro" || b.modo === "oscuro" ? b.modo : "plantilla";
  d.base.claro = colores(b.claro);
  d.base.oscuro = colores(b.oscuro);
  d.base.fuenteTitulos = fuente(b.fuenteTitulos) ?? "plantilla";
  d.base.fuenteTexto = fuente(b.fuenteTexto) ?? "plantilla";
  d.base.escala = entre(b.escala, 80, 140) ?? 100;
  d.base.radio = entre(b.radio, 0, 48) ?? null;
  d.base.anchoMax = entre(b.anchoMax, 640, 1920) ?? null;

  if (esObj(entrada.regiones)) {
    for (const r of REGIONES) {
      const e = region(entrada.regiones[r.id], r.id);
      if (e) d.regiones[r.id] = e;
    }
  }

  if (Array.isArray(entrada.menu)) {
    const vistos = new Set<string>();
    for (const it of entrada.menu.slice(0, 30)) {
      if (!esObj(it)) continue;
      const id = texto(it.id, 80);
      if (!id || vistos.has(id)) continue;
      vistos.add(id);
      const t = texto(it.texto, 40);
      d.menu.push({ id, ...(t ? { texto: t } : {}), ...(it.oculto === true ? { oculto: true } : {}) });
    }
  }

  if (esObj(entrada.secciones)) {
    const ids = SECCIONES_INICIO.map((s) => s.id) as SeccionId[];
    const orden = (Array.isArray(entrada.secciones.orden) ? entrada.secciones.orden : []).filter((x): x is SeccionId => ids.includes(x as SeccionId));
    const unico = [...new Set(orden)];
    d.secciones.orden = [...unico, ...ids.filter((i) => !unico.includes(i))];
    d.secciones.ocultas = [...new Set((Array.isArray(entrada.secciones.ocultas) ? entrada.secciones.ocultas : []).filter((x): x is SeccionId => ids.includes(x as SeccionId)))];
  }

  if (esObj(entrada.cintillo)) {
    const c = entrada.cintillo;
    d.cintillo = {
      activo: bool(c.activo),
      origen: c.origen === "mensajes" ? "mensajes" : "articulos",
      cantidad: entre(c.cantidad, 3, 12) ?? 6,
      velocidad: entre(c.velocidad, 1, 10) ?? 4,
      etiqueta: texto(c.etiqueta, 24) || "Lo último",
      mensajes: (Array.isArray(c.mensajes) ? c.mensajes : []).map((m) => texto(m, 140)).filter(Boolean).slice(0, 12),
    };
  }

  if (esObj(entrada.emergente)) {
    const e = entrada.emergente;
    d.emergente = {
      activo: bool(e.activo),
      titulo: texto(e.titulo, 90),
      texto: texto(e.texto, 280),
      boton: texto(e.boton, 30) || "Conocer más",
      enlace: enlaceSeguro(e.enlace),
      retardoSeg: entre(e.retardoSeg, 0, 120) ?? 6,
      frecuencia: e.frecuencia === "dia" || e.frecuencia === "siempre" ? e.frecuencia : "sesion",
      desde: fechaIso(e.desde),
      hasta: fechaIso(e.hasta),
    };
  }

  if (esObj(entrada.notas)) {
    for (const [id, v] of Object.entries(entrada.notas).slice(0, 300)) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
      const n = nota(v);
      if (n) d.notas[id] = n;
    }
  }
  return d;
}
