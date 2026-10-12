/**
 * Salidas de texto del sitio de un portal: RSS, sitemap y calendario (.ics). Funciones puras (sin red) para poder probarlas:
 * todo lo que viene de personas se escapa según el formato.
 */

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
/** Quita los caracteres de control que XML no admite. */
const limpio = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

export type ItemFeed = { titulo: string; url: string; resumen: string; fecha: string | null; categoria?: string };

export function rss(o: { titulo: string; descripcion: string; url: string; urlFeed: string; items: ItemFeed[] }): string {
  const items = o.items
    .map(
      (i) => `    <item>
      <title>${xml(limpio(i.titulo))}</title>
      <link>${xml(i.url)}</link>
      <guid isPermaLink="true">${xml(i.url)}</guid>${i.fecha ? `\n      <pubDate>${new Date(i.fecha).toUTCString()}</pubDate>` : ""}${i.categoria ? `\n      <category>${xml(limpio(i.categoria))}</category>` : ""}
      <description>${xml(limpio(i.resumen))}</description>
    </item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(limpio(o.titulo))}</title>
    <link>${xml(o.url)}</link>
    <description>${xml(limpio(o.descripcion))}</description>
    <language>es-co</language>
    <atom:link href="${xml(o.urlFeed)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

export type EntradaSitemap = { url: string; fecha?: string | null; frecuencia?: "daily" | "weekly" | "monthly"; prioridad?: number };

export function sitemap(entradas: EntradaSitemap[]): string {
  const filas = entradas
    .map((e) => `  <url>\n    <loc>${xml(e.url)}</loc>${e.fecha ? `\n    <lastmod>${new Date(e.fecha).toISOString().slice(0, 10)}</lastmod>` : ""}${e.frecuencia ? `\n    <changefreq>${e.frecuencia}</changefreq>` : ""}${e.prioridad !== undefined ? `\n    <priority>${e.prioridad.toFixed(1)}</priority>` : ""}\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filas}\n</urlset>\n`;
}

const ics = (s: string) => limpio(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fechaIcs = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Pliega una línea a 75 octetos como pide RFC 5545 (continuación con un espacio). */
function plegar(linea: string): string {
  const partes: string[] = [];
  let actual = "";
  let bytes = 0;
  for (const ch of linea) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > (partes.length === 0 ? 75 : 74)) {
      partes.push(actual);
      actual = "";
      bytes = 0;
    }
    actual += ch;
    bytes += n;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

export function calendario(e: { id: string; titulo: string; descripcion: string; iniciaEn: string; terminaEn: string | null; lugar: string; url: string; portal: string }): string {
  const fin = e.terminaEn ?? new Date(Date.parse(e.iniciaEn) + 3_600_000).toISOString();
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${ics(e.portal)}//Agenda//ES`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@portal`,
    `DTSTAMP:${fechaIcs(new Date().toISOString())}`,
    `DTSTART:${fechaIcs(e.iniciaEn)}`,
    `DTEND:${fechaIcs(fin)}`,
    `SUMMARY:${ics(e.titulo)}`,
    ...(e.descripcion ? [`DESCRIPTION:${ics(e.descripcion.slice(0, 1000))}`] : []),
    ...(e.lugar ? [`LOCATION:${ics(e.lugar)}`] : []),
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lineas.map(plegar).join("\r\n")}\r\n`;
}
