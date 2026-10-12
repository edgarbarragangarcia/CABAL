"use client";

import * as React from "react";
import { Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Undo2 } from "lucide-react";

import { minutosDeLectura } from "@/lib/portales/cms/puro";
import { campo, numero } from "./comun";

/**
 * Editor de texto (markdown) del CMS: barra de formato, atajos de teclado, listas que continúan solas, imágenes que se sueltan
 * encima, y deshacer/rehacer del navegador intactos (los cambios se hacen con `insertText`, no reemplazando el valor).
 */

export type ApiEditor = { insertar: (texto: string) => void; enfocar: () => void };

type Props = {
  valor: string;
  alCambiar: (v: string) => void;
  apiRef?: React.MutableRefObject<ApiEditor | null>;
  /** Abre la biblioteca de medios para elegir una imagen. */
  alPedirImagen?: () => void;
  /** Imágenes soltadas o pegadas sobre el texto. */
  alSoltarImagenes?: (archivos: File[]) => void;
  placeholder?: string;
  maxLength?: number;
  /** Alto mínimo del área de texto (clase de Tailwind). */
  alto?: string;
  etiqueta?: string;
};

type Boton = { id: string; titulo: string; icono: React.ComponentType<{ className?: string }>; atajo?: string };

const BOTONES: (Boton | "sep")[] = [
  { id: "h2", titulo: "Subtítulo", icono: Heading2 },
  { id: "h3", titulo: "Subtítulo menor", icono: Heading3 },
  "sep",
  { id: "b", titulo: "Negrita", atajo: "Ctrl+B", icono: Bold },
  { id: "i", titulo: "Cursiva", atajo: "Ctrl+I", icono: Italic },
  { id: "a", titulo: "Enlace", atajo: "Ctrl+K", icono: Link2 },
  "sep",
  { id: "ul", titulo: "Lista", icono: List },
  { id: "ol", titulo: "Lista numerada", icono: ListOrdered },
  { id: "q", titulo: "Cita", icono: Quote },
  { id: "hr", titulo: "Separador", icono: Minus },
  { id: "img", titulo: "Imagen", icono: ImagePlus },
  "sep",
  { id: "undo", titulo: "Deshacer", atajo: "Ctrl+Z", icono: Undo2 },
  { id: "redo", titulo: "Rehacer", atajo: "Ctrl+Shift+Z", icono: Redo2 },
];

export function EditorMarkdown({ valor, alCambiar, apiRef, alPedirImagen, alSoltarImagenes, placeholder, maxLength = 60_000, alto = "min-h-[28rem]", etiqueta = "Texto" }: Props) {
  const area = React.useRef<HTMLTextAreaElement>(null);
  const [soltando, setSoltando] = React.useState(false);

  /** Reemplaza [i, j) por `nuevo` conservando el historial de deshacer; deja la selección entre `selA` y `selB` (relativos a i). */
  const reemplazar = React.useCallback(
    (i: number, j: number, nuevo: string, selA: number, selB: number) => {
      const t = area.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(i, j);
      const ok = typeof document.execCommand === "function" && document.execCommand("insertText", false, nuevo);
      if (!ok) {
        alCambiar(t.value.slice(0, i) + nuevo + t.value.slice(j));
        requestAnimationFrame(() => t.setSelectionRange(i + selA, i + selB));
      } else t.setSelectionRange(i + selA, i + selB);
    },
    [alCambiar]
  );

  const envolver = React.useCallback(
    (antes: string, despues: string, ejemplo: string) => {
      const t = area.current;
      if (!t) return;
      const { selectionStart: i, selectionEnd: j, value } = t;
      const sel = value.slice(i, j);
      // Si ya está envuelto, se quita (alternar).
      if (sel && value.slice(i - antes.length, i) === antes && value.slice(j, j + despues.length) === despues) {
        reemplazar(i - antes.length, j + despues.length, sel, 0, sel.length);
        return;
      }
      const texto = sel || ejemplo;
      reemplazar(i, j, antes + texto + despues, antes.length, antes.length + texto.length);
    },
    [reemplazar]
  );

  /** Aplica un prefijo a cada línea de la selección (o quita el que ya tengan). */
  const prefijar = React.useCallback(
    (prefijo: (n: number) => string, patron: RegExp, ejemplo: string) => {
      const t = area.current;
      if (!t) return;
      const { value } = t;
      const ini = value.lastIndexOf("\n", t.selectionStart - 1) + 1;
      let fin = value.indexOf("\n", t.selectionEnd);
      if (fin === -1) fin = value.length;
      const bloque = value.slice(ini, fin) || ejemplo;
      const lineas = bloque.split("\n");
      const todas = lineas.every((l) => patron.test(l));
      const nuevo = lineas.map((l, n) => (todas ? l.replace(patron, "") : prefijo(n) + l.replace(patron, ""))).join("\n");
      reemplazar(ini, fin, nuevo, 0, nuevo.length);
    },
    [reemplazar]
  );

  const insertar = React.useCallback(
    (texto: string) => {
      const t = area.current;
      if (!t) return;
      const { selectionStart: i, selectionEnd: j, value } = t;
      // Bloques (imágenes, separadores) en su propia línea, con una línea en blanco alrededor.
      const antes = i > 0 && !value.slice(0, i).endsWith("\n\n") ? (value.slice(0, i).endsWith("\n") ? "\n" : "\n\n") : "";
      const despues = value.slice(j).startsWith("\n\n") || j === value.length ? "" : value.slice(j).startsWith("\n") ? "\n" : "\n\n";
      const s = antes + texto + despues;
      reemplazar(i, j, s, s.length, s.length);
    },
    [reemplazar]
  );

  React.useEffect(() => {
    if (apiRef) apiRef.current = { insertar, enfocar: () => area.current?.focus() };
  }, [apiRef, insertar]);

  const enlace = React.useCallback(() => {
    const t = area.current;
    if (!t) return;
    const url = window.prompt("Dirección del enlace (empieza por https://)", "https://");
    if (!url || !/^https?:\/\/\S+$/i.test(url)) return;
    const { selectionStart: i, selectionEnd: j, value } = t;
    const texto = value.slice(i, j) || "texto del enlace";
    reemplazar(i, j, `[${texto}](${url})`, 1, 1 + texto.length);
  }, [reemplazar]);

  const ejecutar = (id: string) => {
    switch (id) {
      case "h2": return prefijar(() => "## ", /^#{1,4}\s+/, "Subtítulo");
      case "h3": return prefijar(() => "### ", /^#{1,4}\s+/, "Subtítulo");
      case "b": return envolver("**", "**", "texto");
      case "i": return envolver("*", "*", "texto");
      case "a": return enlace();
      case "ul": return prefijar(() => "- ", /^[-*•]\s+/, "elemento");
      case "ol": return prefijar((n) => `${n + 1}. `, /^\d{1,2}[.)]\s+/, "elemento");
      case "q": return prefijar(() => "> ", /^>\s?/, "cita");
      case "hr": return insertar("---");
      case "img": return alPedirImagen?.();
      case "undo":
        area.current?.focus();
        return void document.execCommand("undo");
      case "redo":
        area.current?.focus();
        return void document.execCommand("redo");
    }
  };

  const botones = BOTONES.filter((b) => b === "sep" || b.id !== "img" || !!alPedirImagen);

  function alTeclear(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b") return e.preventDefault(), envolver("**", "**", "texto");
      if (k === "i") return e.preventDefault(), envolver("*", "*", "texto");
      if (k === "k") return e.preventDefault(), enlace();
    }
    // Enter dentro de una lista: continúa la lista; en un elemento vacío, la termina.
    if (e.key === "Enter" && !e.shiftKey && !meta && !e.altKey) {
      const t = e.currentTarget;
      if (t.selectionStart !== t.selectionEnd) return;
      const i = t.selectionStart;
      const ini = t.value.lastIndexOf("\n", i - 1) + 1;
      const linea = t.value.slice(ini, i);
      const m = linea.match(/^(\s*)([-*•]|\d{1,2}[.)])\s+(.*)$/);
      if (!m) return;
      e.preventDefault();
      if (!m[3].trim()) return reemplazar(ini, i, "", 0, 0);
      const marca = /\d/.test(m[2]) ? `${parseInt(m[2], 10) + 1}${m[2].slice(-1)}` : m[2];
      reemplazar(i, i, `\n${m[1]}${marca} `, 1 + m[1].length + marca.length + 1, 1 + m[1].length + marca.length + 1);
    }
  }

  function alSoltar(e: React.DragEvent) {
    const imgs = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
    setSoltando(false);
    if (imgs.length === 0 || !alSoltarImagenes) return;
    e.preventDefault();
    alSoltarImagenes(imgs);
  }

  function alPegar(e: React.ClipboardEvent) {
    const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0 || !alSoltarImagenes) return;
    e.preventDefault();
    alSoltarImagenes(imgs);
  }

  const palabras = valor.trim() ? valor.trim().split(/\s+/).length : 0;
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formato del texto">
        <span className="mr-auto text-xs font-semibold text-muted-foreground">{etiqueta}</span>
        {botones.map((b, i) =>
          b === "sep" ? (
            <span key={`s${i}`} aria-hidden className="mx-1 h-5 w-px bg-border" />
          ) : (
            <button key={b.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar(b.id)} title={b.atajo ? `${b.titulo} (${b.atajo})` : b.titulo} aria-label={b.titulo} className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-surface-muted hover:text-foreground">
              <b.icono className="size-4" />
            </button>
          )
        )}
      </div>
      <div className="relative" onDragOver={(e) => { if (alSoltarImagenes && [...e.dataTransfer.items].some((x) => x.type.startsWith("image/"))) { e.preventDefault(); setSoltando(true); } }} onDragLeave={() => setSoltando(false)} onDrop={alSoltar}>
        <textarea
          ref={area}
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          onKeyDown={alTeclear}
          onPaste={alPegar}
          maxLength={maxLength}
          spellCheck
          lang="es"
          placeholder={placeholder ?? "Escribe aquí. Usa ## para subtítulos, ** para negrita y - para listas. Suelta una imagen para agregarla."}
          className={`${campo} ${alto} resize-y font-mono text-[13.5px] leading-[1.7]`}
        />
        {soltando && <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl border-2 border-dashed border-brand bg-brand-soft/70 text-sm font-semibold text-brand">Suelta la imagen para subirla</div>}
      </div>
      <p className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{numero(palabras)} palabras · {minutosDeLectura(valor)} min de lectura</span>
        <span className="tabular-nums">{numero(valor.length)} / {numero(maxLength)}</span>
      </p>
    </div>
  );
}
