import { parsearMarkdown, type Bloque, type Trozo } from "../cms/puro";

/**
 * El boletín como correo: HTML sencillo con estilos en línea (los clientes de correo no leen hojas de estilo) y su versión en
 * texto plano. Todo lo que escribe la persona se escapa; los enlaces y las imágenes solo pasan si son https.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function trozosHtml(ts: Trozo[], color: string): string {
  return ts
    .map((t) => {
      if (t.tipo === "negrita") return `<strong>${esc(t.texto)}</strong>`;
      if (t.tipo === "cursiva") return `<em>${esc(t.texto)}</em>`;
      if (t.tipo === "enlace" && t.href && /^https?:\/\//i.test(t.href)) return `<a href="${esc(t.href)}" style="color:${color};font-weight:600">${esc(t.texto)}</a>`;
      return esc(t.texto);
    })
    .join("");
}

function bloqueHtml(b: Bloque, color: string): string {
  const p = "margin:0 0 16px;font-size:16px;line-height:1.65;color:#1f2933";
  switch (b.tipo) {
    case "h2": return `<h2 style="margin:28px 0 12px;font-size:22px;line-height:1.25;color:#111827">${trozosHtml(b.trozos, color)}</h2>`;
    case "h3": return `<h3 style="margin:22px 0 10px;font-size:18px;line-height:1.3;color:#111827">${trozosHtml(b.trozos, color)}</h3>`;
    case "p": return `<p style="${p}">${trozosHtml(b.trozos, color)}</p>`;
    case "cita": return `<blockquote style="margin:0 0 16px;padding:8px 16px;border-left:4px solid ${color};color:#374151;font-style:italic">${trozosHtml(b.trozos, color)}</blockquote>`;
    case "hr": return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">`;
    case "ul": return `<ul style="margin:0 0 16px;padding-left:22px;${p.replace("margin:0 0 16px;", "")}">${b.items.map((i) => `<li style="margin-bottom:6px">${trozosHtml(i, color)}</li>`).join("")}</ul>`;
    case "ol": return `<ol style="margin:0 0 16px;padding-left:22px;${p.replace("margin:0 0 16px;", "")}">${b.items.map((i) => `<li style="margin-bottom:6px">${trozosHtml(i, color)}</li>`).join("")}</ol>`;
    case "img": return `<p style="margin:0 0 16px"><img src="${esc(b.src)}" alt="${esc(b.alt)}" width="560" style="max-width:100%;height:auto;border-radius:12px;display:block"></p>`;
  }
}

function bloqueTexto(b: Bloque): string {
  const plano = (ts: Trozo[]) => ts.map((t) => (t.tipo === "enlace" ? `${t.texto} (${t.href})` : t.texto)).join("");
  switch (b.tipo) {
    case "h2":
    case "h3": return `\n${plano(b.trozos).toUpperCase()}\n`;
    case "p":
    case "cita": return `${plano(b.trozos)}\n`;
    case "hr": return "----------\n";
    case "ul": return `${b.items.map((i) => `- ${plano(i)}`).join("\n")}\n`;
    case "ol": return `${b.items.map((i, n) => `${n + 1}. ${plano(i)}`).join("\n")}\n`;
    case "img": return b.alt ? `[Imagen: ${b.alt}]\n` : "";
  }
}

export type OpcionesCorreo = {
  portal: string;
  color: string;
  asunto: string;
  markdown: string;
  urlPortal: string;
  /** Enlace personal para darse de baja; en la vista previa, un ejemplo. */
  urlBaja: string;
  editor: string;
};

export function boletinHtml(o: OpcionesCorreo): string {
  const color = /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : "#0f766e";
  const cuerpo = parsearMarkdown(o.markdown).map((b) => bloqueHtml(b, color)).join("\n");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.asunto)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${color};padding:22px 28px"><a href="${esc(o.urlPortal)}" style="color:#ffffff;text-decoration:none;font-size:20px;font-weight:700">${esc(o.portal)}</a></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;color:#111827">${esc(o.asunto)}</h1>
${cuerpo}
<p style="margin:28px 0 0"><a href="${esc(o.urlPortal)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Visitar ${esc(o.portal)}</a></p>
</td></tr>
<tr><td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6">
Recibes este correo porque te sumaste a la comunidad de ${esc(o.portal)}. ${esc(o.editor)}.<br>
<a href="${esc(o.urlBaja)}" style="color:#6b7280">Darme de baja</a> · Tus datos se tratan según la <a href="${esc(new URL("/privacidad", o.urlPortal).toString())}" style="color:#6b7280">política de privacidad</a>.
</td></tr></table></td></tr></table></body></html>`;
}

export function boletinTexto(o: OpcionesCorreo): string {
  return `${o.portal}\n${o.asunto}\n\n${parsearMarkdown(o.markdown).map(bloqueTexto).join("\n")}\nVisita ${o.portal}: ${o.urlPortal}\n\n--\nRecibes este correo porque te sumaste a la comunidad de ${o.portal}.\nPara darte de baja: ${o.urlBaja}\n`;
}
