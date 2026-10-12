import "server-only";

import type { Pagina } from "./fragmentos";

/**
 * Saca el texto de un archivo subido: PDF (página por página, con unpdf), Word .docx (con mammoth) y texto plano, Markdown, CSV,
 * JSON, XML o HTML. No hay OCR: un PDF escaneado (solo imágenes) no tiene texto que extraer y se dice con claridad.
 */

export const EXTENSIONES = ["pdf", "docx", "txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm", "log"] as const;
export const MAX_BYTES = 40 * 1024 * 1024;

export type Extraido = { paginas: Pagina[]; totalPaginas: number | null; caracteres: number };

export const extensionDe = (nombre: string) => nombre.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

const entidades: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Quita las etiquetas de un HTML y deja el texto (sin scripts ni estilos), con los párrafos separados. */
export function textoDeHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|br)\s*>|<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
      }
      return entidades[e.toLowerCase()] ?? m;
    });
}

export async function extraerTexto(buffer: Buffer, nombre: string): Promise<Extraido> {
  const ext = extensionDe(nombre);
  let paginas: Pagina[];
  let totalPaginas: number | null = null;

  if (ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
    try {
      pdf = await getDocumentProxy(new Uint8Array(buffer));
    } catch {
      throw new Error("No se pudo abrir el PDF: está dañado o protegido con contraseña.");
    }
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    totalPaginas = totalPages;
    paginas = (text as string[]).map((texto, i) => ({ numero: i + 1, texto }));
  } else if (ext === "docx") {
    const mammoth = await import("mammoth");
    let texto: string;
    try {
      texto = (await mammoth.extractRawText({ buffer })).value;
    } catch {
      throw new Error("No se pudo abrir el documento de Word (.docx): está dañado o no es un .docx.");
    }
    paginas = [{ numero: null, texto }];
  } else if (["txt", "md", "markdown", "csv", "tsv", "json", "xml", "log"].includes(ext)) {
    paginas = [{ numero: null, texto: new TextDecoder("utf-8").decode(buffer) }];
  } else if (ext === "html" || ext === "htm") {
    paginas = [{ numero: null, texto: textoDeHtml(new TextDecoder("utf-8").decode(buffer)) }];
  } else {
    throw new Error(`No se pueden leer archivos .${ext || "sin extensión"}. Sube un PDF, un Word (.docx) o un archivo de texto, Markdown, CSV o HTML.`);
  }

  const caracteres = paginas.reduce((s, p) => s + p.texto.replace(/\s+/g, " ").trim().length, 0);
  if (caracteres < 40) {
    throw new Error(
      ext === "pdf"
        ? "El PDF no tiene texto que extraer: parece escaneado (solo imágenes). Hace falta un PDF con texto seleccionable."
        : "El archivo no tiene texto que extraer."
    );
  }
  return { paginas, totalPaginas, caracteres };
}
