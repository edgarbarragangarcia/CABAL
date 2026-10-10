import { interpretarLineas, type DatosCedula, type LineaOcr } from "@/lib/comunidad/cedula-ocr";

/**
 * Lee el FRENTE de la cédula en el propio teléfono (Tesseract en WebAssembly): la foto no sale del dispositivo y no hace
 * falta ninguna clave. Es el último recurso y el menos fiable (hologramas y fondos con dibujos confunden al OCR), por eso
 * el intérprete solo acepta lo que valida y deja vacío el resto. Los archivos se sirven desde /ocr (scripts/copiar-ocr.mjs).
 */

/** Gris y más contraste, y al menos 1800 px de ancho: el fondo de la cédula confunde al OCR. */
function preparar(foto: ImageBitmap): HTMLCanvasElement {
  const k = Math.max(1, 1800 / foto.width);
  const c = document.createElement("canvas");
  c.width = Math.round(foto.width * k);
  c.height = Math.round(foto.height * k);
  const ctx = c.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.6) brightness(1.05)";
  ctx.drawImage(foto, 0, 0, c.width, c.height);
  return c;
}

export async function leerCedulaLocal(foto: ImageBitmap, avance?: (texto: string) => void): Promise<DatosCedula | null> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr/lang",
    workerBlobURL: false, // la política de seguridad no permite workers desde blob:
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") avance?.(`Leyendo tu cédula… ${Math.round(m.progress * 100)} %`);
      else if (m.status.includes("loading")) avance?.("Preparando el lector (solo la primera vez)…");
    },
  });
  try {
    // Texto disperso (como una cédula): cada línea con su caja, para buscar los datos por posición.
    await worker.setParameters({ tessedit_pageseg_mode: "11" as never, preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(preparar(foto), {}, { blocks: true });
    const lineas: LineaOcr[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).map((l) => ({ texto: l.text, conf: l.confidence, ...l.bbox }));
    return interpretarLineas(lineas);
  } finally {
    await worker.terminate();
  }
}
