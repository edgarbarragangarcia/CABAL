/**
 * Auditoría y puntaje SEO de una nota. Es código puro (sin IA): las cifras y las citas las verifica el programa contra el material
 * del periodista, no el modelo. Se usa en el navegador (panel «SEO en vivo») y en el servidor (al generar).
 */

export const palabras = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export type Hallazgo = { tipo: "cifra" | "cita"; texto: string };

/** Cifras (números con al menos dos dígitos, o con separadores/porcentaje) y citas entre comillas que NO constan en el material. */
export function auditar(cuerpo: string, material: string): { sinRespaldo: Hallazgo[]; cifras: number; citas: number } {
  const base = norm(material);
  const soloDigitos = (s: string) => s.replace(/[^\d]/g, "");
  const baseDigitos = base.replace(/[^\d\s]/g, "");
  const sinRespaldo: Hallazgo[] = [];
  const cifras = [...new Set(cuerpo.match(/\d[\d.,]*\d|\d{2,}/g) ?? [])].filter((c) => soloDigitos(c).length >= 2);
  for (const c of cifras) {
    const d = soloDigitos(c);
    const enMaterial = norm(material).includes(norm(c)) || baseDigitos.replace(/[.,]/g, "").includes(d) || material.replace(/[^\d]/g, " ").split(/\s+/).includes(d) || soloDigitos(material).includes(d);
    if (!enMaterial) sinRespaldo.push({ tipo: "cifra", texto: c });
  }
  const citas = [...cuerpo.matchAll(/[«"“]([^»"”]{12,300})[»"”]/g)].map((m) => m[1].trim());
  for (const c of citas) if (!base.includes(norm(c))) sinRespaldo.push({ tipo: "cita", texto: c });
  return { sinRespaldo, cifras: cifras.length, citas: citas.length };
}

export type Nota = {
  titulo: string; resumen: string; cuerpo: string; claves: string[]; palabraClave: string; portadaUrl: string; portadaAlt: string;
  seoTitulo: string; seoDescripcion: string;
};

export type Criterio = { ok: boolean; texto: string; paso: string; grupo: "contenido" | "ficha" | "imagen" | "lectura"; puntos: number };

export function criteriosSeo(n: Nota): Criterio[] {
  const titulo = n.seoTitulo || n.titulo;
  const desc = n.seoDescripcion || n.resumen;
  const clave = norm(n.palabraClave);
  const primer = n.cuerpo.split(/\n\s*\n/)[0] ?? "";
  const nPal = palabras(n.cuerpo);
  const c = (ok: boolean, texto: string, paso: string, grupo: Criterio["grupo"], puntos: number): Criterio => ({ ok, texto, paso, grupo, puntos });
  return [
    c(nPal >= 300, `Cuerpo de al menos 300 palabras (hoy ${nPal})`, "cuerpo", "contenido", 15),
    c(/https?:\/\//.test(n.cuerpo), "Cita o enlaza una fuente externa", "cuerpo", "contenido", 10),
    c(/^##\s+/m.test(n.cuerpo), "Al menos un subtítulo (##)", "cuerpo", "lectura", 10),
    c(n.cuerpo.split(/\n\s*\n/).filter(Boolean).length >= 4, "Cuatro párrafos o más", "cuerpo", "lectura", 5),
    c(titulo.length >= 30 && titulo.length <= 65, `Título de 30 a 65 caracteres (hoy ${titulo.length})`, "seo", "ficha", 15),
    c(desc.length >= 70 && desc.length <= 160, `Descripción de 70 a 160 caracteres (hoy ${desc.length})`, "seo", "ficha", 15),
    c(!!clave && norm(titulo).includes(clave), "La palabra clave está en el título", "claves", "ficha", 10),
    c(!!clave && norm(primer).includes(clave), "La palabra clave está en el primer párrafo", "claves", "contenido", 5),
    c(n.claves.length >= 3, "Al menos tres palabras clave", "claves", "ficha", 5),
    c(!!n.portadaUrl, "Imagen de portada", "portada", "imagen", 5),
    c(!!n.portadaUrl && n.portadaAlt.trim().length >= 10, "Texto alternativo de la imagen", "portada", "imagen", 5),
  ];
}

export function puntajeSeo(n: Nota) {
  const cs = criteriosSeo(n);
  const total = cs.reduce((s, x) => s + x.puntos, 0);
  const logrado = cs.filter((x) => x.ok).reduce((s, x) => s + x.puntos, 0);
  const grupos = (["contenido", "ficha", "imagen", "lectura"] as const).map((g) => {
    const l = cs.filter((x) => x.grupo === g);
    const t = l.reduce((s, x) => s + x.puntos, 0);
    return { grupo: g, pct: t ? Math.round((l.filter((x) => x.ok).reduce((s, x) => s + x.puntos, 0) / t) * 100) : 0 };
  });
  const puntos = Math.round((logrado / total) * 100);
  return { puntos, nivel: puntos >= 80 ? "Bueno" : puntos >= 50 ? "Regular" : "Por mejorar", grupos, criterios: cs };
}

/** Markdown mínimo (subtítulos, listas, negrita, enlaces) a HTML seguro para la vista previa. */
export function aHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  return md
    .split(/\n\s*\n/)
    .map((b) => {
      const t = b.trim();
      if (!t) return "";
      if (/^##\s+/.test(t)) return `<h3>${inline(t.replace(/^##\s+/, ""))}</h3>`;
      if (/^>\s?/.test(t)) return `<blockquote>${inline(t.replace(/^>\s?/gm, ""))}</blockquote>`;
      if (/^[-*]\s+/.test(t)) return `<ul>${t.split("\n").map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      return `<p>${inline(t).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}
