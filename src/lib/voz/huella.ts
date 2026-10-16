/**
 * La huella de escritura de una persona, medida con código sobre sus textos reales (no con IA): largo de las frases, signos que usa,
 * palabras y frases que repite, cómo abre. Sirve para dos cosas: darle a la IA ejemplos y números exactos que imitar, y comprobar
 * después si un texto nuevo suena a ella o a una máquina.
 */

const STOP = new Set("a al algo ante aquí así aun aunque bien cada como con contra cual cuando de del desde donde dos e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba estado están este esto estos fue fueron ha había han hasta hay la las le les lo los más me mi mis mucho muy ni no nos nosotros o otra otras otro otros para pero por porque que qué quien se ser si sí sin sobre su sus también tan te tiene tienen todo todos tu tus un una uno unos y ya yo".split(" "));

export type Huella = {
  textos: number;
  palabras: number;
  frases: number;
  palabrasPorFrase: number;
  frasePercentil90: number;
  palabrasPorParrafo: number;
  /** Por cada 1.000 palabras. */
  signos: { interrogacion: number; exclamacion: number; puntosSuspensivos: number; rayas: number; parentesis: number; comillas: number; dosPuntos: number; emojis: number; hashtags: number; mayusculas: number };
  tratamiento: { usted: number; ustedes: number; nosotros: number; yo: number; colombianos: number };
  frasesFrecuentes: { texto: string; veces: number }[];
  palabrasFrecuentes: { texto: string; veces: number }[];
  aperturas: { texto: string; veces: number }[];
  vocabulario: string[];
};

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const palabrasDe = (t: string) => (t.toLowerCase().match(/[a-záéíóúüñ]{2,}/g) ?? []);
const por1000 = (n: number, total: number) => (total ? Math.round((n / total) * 10000) / 10 : 0);

export function dividirFrases(t: string): string[] {
  return t.replace(/\s+/g, " ").split(/(?<=[.!?…])\s+(?=[¿¡"«A-ZÁÉÍÓÚÑ0-9])/).map((x) => x.trim()).filter((x) => palabrasDe(x).length >= 2);
}

function top(mapa: Map<string, number>, n: number, minimo: number) {
  return [...mapa].filter(([, v]) => v >= minimo).sort((a, b) => b[1] - a[1]).slice(0, n).map(([texto, veces]) => ({ texto, veces }));
}

export function construirHuella(textos: string[]): Huella {
  const todo = textos.join("\n\n");
  const palabras = palabrasDe(todo);
  const totalPal = palabras.length;
  const frases = textos.flatMap(dividirFrases);
  const largos = frases.map((f) => palabrasDe(f).length).sort((a, b) => a - b);
  const parrafos = todo.split(/\n\s*\n/).map((p) => palabrasDe(p).length).filter((n) => n >= 3);
  const cuenta = (re: RegExp) => (todo.match(re) ?? []).length;

  const unigramas = new Map<string, number>();
  const trigramas = new Map<string, number>();
  const vocabulario = new Set<string>();
  for (const p of palabras) {
    vocabulario.add(norm(p));
    if (!STOP.has(p) && p.length > 3) unigramas.set(p, (unigramas.get(p) ?? 0) + 1);
  }
  for (const f of frases) {
    const w = palabrasDe(f);
    for (let i = 0; i + 3 <= w.length; i++) {
      const g = w.slice(i, i + 3);
      if (g.every((x) => STOP.has(x))) continue;
      const k = g.join(" ");
      trigramas.set(k, (trigramas.get(k) ?? 0) + 1);
    }
  }
  const aperturas = new Map<string, number>();
  for (const f of frases) {
    const w = palabrasDe(f).slice(0, 3).join(" ");
    if (w) aperturas.set(w, (aperturas.get(w) ?? 0) + 1);
  }
  const lower = todo.toLowerCase();
  const palabra = (re: RegExp) => (lower.match(re) ?? []).length;

  return {
    textos: textos.length,
    palabras: totalPal,
    frases: frases.length,
    palabrasPorFrase: largos.length ? Math.round((largos.reduce((s, n) => s + n, 0) / largos.length) * 10) / 10 : 0,
    frasePercentil90: largos.length ? largos[Math.floor(largos.length * 0.9)] ?? largos[largos.length - 1] : 0,
    palabrasPorParrafo: parrafos.length ? Math.round(parrafos.reduce((s, n) => s + n, 0) / parrafos.length) : 0,
    signos: {
      interrogacion: por1000(cuenta(/¿/g), totalPal), exclamacion: por1000(cuenta(/¡/g), totalPal), puntosSuspensivos: por1000(cuenta(/…|\.\.\./g), totalPal),
      rayas: por1000(cuenta(/[—–]/g), totalPal), parentesis: por1000(cuenta(/\(/g), totalPal), comillas: por1000(cuenta(/[«"“]/g), totalPal), dosPuntos: por1000(cuenta(/:/g), totalPal),
      emojis: por1000(cuenta(/\p{Extended_Pictographic}/gu), totalPal), hashtags: por1000(cuenta(/#\p{L}/gu), totalPal), mayusculas: por1000(cuenta(/\b[A-ZÁÉÍÓÚÑ]{4,}\b/g), totalPal),
    },
    tratamiento: {
      usted: por1000(palabra(/\busted\b/g), totalPal), ustedes: por1000(palabra(/\bustedes\b/g), totalPal), nosotros: por1000(palabra(/\b(nosotros|nuestro|nuestra|nuestros|nuestras)\b/g), totalPal),
      yo: por1000(palabra(/\b(yo|mi|mis|me)\b/g), totalPal), colombianos: por1000(palabra(/\bcolombian[oa]s?\b/g), totalPal),
    },
    frasesFrecuentes: top(trigramas, 25, 3),
    palabrasFrecuentes: top(unigramas, 40, 4),
    aperturas: top(aperturas, 12, 3),
    vocabulario: [...vocabulario],
  };
}

// ----------------------------------------------------------------------------------------------------- ejemplos para la IA

export type ItemVoz = { id: string; titulo: string; formato: string; contenido: string };

/** Trozos de un texto (párrafos o líneas sueltas, según su forma) para usarlos de ejemplo. */
export function trozos(t: string): string[] {
  const limpio = t.replace(/\r\n?/g, "\n").trim();
  const partes = limpio.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length >= 40);
  if (partes.length >= 3) return partes.map((p) => p.slice(0, 900));
  return limpio.split("\n").map((p) => p.trim()).filter((p) => p.length >= 40).map((p) => p.slice(0, 900));
}

/** Elige los trozos más parecidos al tema (y al formato) hasta llenar el presupuesto de caracteres, sin repetir el mismo texto de más. */
export function elegirEjemplos(items: ItemVoz[], formato: string, tema: string, presupuesto = 12_000): { fuente: string; texto: string }[] {
  const claves = new Set(palabrasDe(tema).filter((p) => !STOP.has(p) && p.length > 3).map(norm));
  const puntuados: { fuente: string; texto: string; p: number; id: string }[] = [];
  for (const it of items) {
    const base = it.formato === formato ? 3 : it.formato === "general" ? 1.2 : 0.6;
    for (const t of trozos(it.contenido)) {
      const w = palabrasDe(t).map(norm);
      const solapa = w.filter((x) => claves.has(x)).length;
      puntuados.push({ fuente: it.titulo, texto: t, id: it.id, p: base + Math.min(4, solapa * 0.8) + Math.min(1, w.length / 80) });
    }
  }
  puntuados.sort((a, b) => b.p - a.p);
  const porTexto = new Map<string, number>();
  const salida: { fuente: string; texto: string }[] = [];
  let usados = 0;
  for (const c of puntuados) {
    if ((porTexto.get(c.id) ?? 0) >= 4) continue; // variedad: no más de cuatro trozos de un mismo texto
    if (usados + c.texto.length > presupuesto) continue;
    porTexto.set(c.id, (porTexto.get(c.id) ?? 0) + 1);
    salida.push({ fuente: c.fuente, texto: c.texto });
    usados += c.texto.length;
    if (usados >= presupuesto - 150) break;
  }
  return salida;
}

// ------------------------------------------------------------------------------------------------------------ muletillas

/** Giros que delatan a una máquina; si la senadora no los usa en sus textos, no deben salir en lo que se escriba por ella. */
export const MULETILLAS_IA: { re: RegExp; nombre: string }[] = [
  { re: /\ben conclusi[oó]n\b/i, nombre: "en conclusión" }, { re: /\bcabe (destacar|resaltar|mencionar|señalar)\b/i, nombre: "cabe destacar" },
  { re: /\bes (importante|fundamental|crucial|esencial) (destacar|resaltar|recordar|señalar|mencionar)\b/i, nombre: "es importante destacar" },
  { re: /\ben un mundo (cada vez más|donde|que)\b/i, nombre: "en un mundo cada vez más" }, { re: /\bno (solo|sólo) [^.]{3,60}, sino (también|que)\b/i, nombre: "no solo… sino también" },
  { re: /\b(sin duda alguna|sin lugar a dudas)\b/i, nombre: "sin duda alguna" }, { re: /\b(panorama|tapiz|crisol|paradigma|sinergia)\b/i, nombre: "palabra de relleno (panorama, paradigma…)" },
  { re: /\bdesempe(ñ|n)a un papel (clave|crucial|fundamental|vital)\b/i, nombre: "desempeña un papel clave" }, { re: /\ben el (marco|contexto) de\b/i, nombre: "en el marco de" },
  { re: /\b(adentr(a|ar)nos|sumerg(ir|irnos)|navegar por)\b/i, nombre: "adentrarnos / sumergirnos" }, { re: /\bahora bien\b/i, nombre: "ahora bien" },
  { re: /\bpor otro lado\b/i, nombre: "por otro lado" }, { re: /\b(en definitiva|en resumen|en suma)\b/i, nombre: "en definitiva / en resumen" },
  { re: /\b(imperativo|imprescindible|menester)\b/i, nombre: "imperativo / menester" }, { re: /\bgarantizar\b[^.]{0,40}\bfuturo\b/i, nombre: "garantizar el futuro" },
  { re: /[—]/, nombre: "raya larga (—)" }, { re: /^[-•*]\s+\S+:\s/m, nombre: "viñetas con título en negrita" }, { re: /[✅🚀✨💡🔥🎯]/u, nombre: "emojis de IA (✅🚀✨💡)" },
];

export type VerificacionVoz = {
  suena: "parecido" | "revisar" | "no_parecido" | "sin_referencia";
  palabrasPorFrase: { texto: number; ella: number };
  vocabularioAjeno: { porcentaje: number; palabras: string[] };
  muletillas: { nombre: string; veces: number }[];
  frasesSuyas: string[];
  avisos: string[];
};

export function verificarVoz(texto: string, h: Huella): VerificacionVoz {
  if (h.palabras < 1500) return { suena: "sin_referencia", palabrasPorFrase: { texto: 0, ella: h.palabrasPorFrase }, vocabularioAjeno: { porcentaje: 0, palabras: [] }, muletillas: [], frasesSuyas: [], avisos: ["Aún no hay suficientes textos suyos (mínimo 1.500 palabras) para comprobar la voz."] };
  const m = huellaDeTexto(texto);
  const v = new Set(h.vocabulario);
  const contenido = palabrasDe(texto).filter((p) => !STOP.has(p) && p.length > 3);
  const ajenas = contenido.filter((p) => !v.has(norm(p)));
  const unicas = [...new Set(ajenas)];
  const pct = contenido.length ? Math.round((ajenas.length / contenido.length) * 100) : 0;
  const muletillas = MULETILLAS_IA.map((x) => ({ nombre: x.nombre, veces: (texto.match(new RegExp(x.re.source, x.re.flags.includes("g") ? x.re.flags : `${x.re.flags}g`)) ?? []).length })).filter((x) => x.veces > 0);
  // Una raya o un emoji no es muletilla si ella también los usa.
  const utiles = muletillas.filter((x) => !(x.nombre.startsWith("raya") && h.signos.rayas >= 2) && !(x.nombre.startsWith("emojis") && h.signos.emojis >= 2));
  const lower = texto.toLowerCase();
  const suyas = h.frasesFrecuentes.filter((f) => lower.includes(f.texto)).map((f) => f.texto).slice(0, 6);
  const avisos: string[] = [];
  const dif = h.palabrasPorFrase ? Math.abs(m.palabrasPorFrase - h.palabrasPorFrase) / h.palabrasPorFrase : 0;
  if (dif > 0.3) avisos.push(`Las frases promedian ${m.palabrasPorFrase} palabras; las suyas, ${h.palabrasPorFrase}.`);
  if (pct > 25) avisos.push(`${pct}% del vocabulario no aparece en sus textos.`);
  if (utiles.length) avisos.push(`Giros de máquina: ${utiles.map((x) => x.nombre).join(", ")}.`);
  const puntos = (dif > 0.3 ? 1 : 0) + (pct > 25 ? 1 : 0) + (utiles.length ? 2 : 0) + (suyas.length === 0 && h.frasesFrecuentes.length > 5 ? 1 : 0);
  return { suena: puntos === 0 ? "parecido" : puntos <= 2 ? "revisar" : "no_parecido", palabrasPorFrase: { texto: m.palabrasPorFrase, ella: h.palabrasPorFrase }, vocabularioAjeno: { porcentaje: pct, palabras: unicas.slice(0, 12) }, muletillas: utiles, frasesSuyas: suyas, avisos };
}

function huellaDeTexto(t: string) {
  const fr = dividirFrases(t);
  const l = fr.map((f) => palabrasDe(f).length);
  return { palabrasPorFrase: l.length ? Math.round((l.reduce((s, n) => s + n, 0) / l.length) * 10) / 10 : 0 };
}

/** El bloque que se agrega a las instrucciones de la IA: ejemplos reales y números exactos de su forma de escribir. */
export function bloqueVoz(h: Huella, ejemplos: { fuente: string; texto: string }[]): string {
  if (h.palabras < 300 || ejemplos.length === 0) return "";
  const pct = (n: number) => (n > 0 ? `${n} por cada 1.000 palabras` : "no los usa");
  return (
    `\n\nVOZ DE LA SENADORA — IMITACIÓN EXACTA. Debes escribir como ella escribe o habla, no como una IA. Aquí hay ${ejemplos.length} fragmentos REALES suyos: son solo para el estilo ` +
    `(nunca tomes sus hechos ni cifras de ahí; los hechos salen únicamente del MATERIAL). Copia su vocabulario, el largo de sus frases, el ritmo, cómo abre y cómo cierra, sus giros y su trato al lector. ` +
    `No suavices, no «mejores» ni generalices su manera de decir las cosas.\n` +
    `Medidas de su escritura: las frases promedian ${h.palabrasPorFrase} palabras (el 90 % no pasa de ${h.frasePercentil90}); párrafos de unas ${h.palabrasPorParrafo} palabras; ` +
    `signos de interrogación: ${pct(h.signos.interrogacion)}; de exclamación: ${pct(h.signos.exclamacion)}; puntos suspensivos: ${pct(h.signos.puntosSuspensivos)}; rayas largas: ${pct(h.signos.rayas)}; emojis: ${pct(h.signos.emojis)}; hashtags: ${pct(h.signos.hashtags)}.` +
    (h.frasesFrecuentes.length ? `\nExpresiones que ella repite (úsalas donde calcen): ${h.frasesFrecuentes.slice(0, 12).map((f) => `«${f.texto}»`).join(", ")}.` : "") +
    (h.aperturas.length ? `\nSuele abrir frases con: ${h.aperturas.slice(0, 8).map((f) => `«${f.texto}…»`).join(", ")}.` : "") +
    `\nPROHIBIDO sonar a IA: ${MULETILLAS_IA.slice(0, 12).map((m) => `«${m.nombre}»`).join(", ")}; nada de listas con viñetas ni títulos en negrita si ella no escribe así; no uses la raya larga (—).\n` +
    `FRAGMENTOS REALES DE ELLA:\n` + ejemplos.map((e, i) => `[${i + 1}] (${e.fuente}) ${e.texto}`).join("\n\n")
  );
}
