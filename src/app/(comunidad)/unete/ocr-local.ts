import { interpretarTextoCedula, type DatosCedula } from "@/lib/comunidad/cedula-ocr";

/**
 * Lee la cédula en el propio teléfono (Tesseract en WebAssembly): la foto no sale del dispositivo y no hace falta
 * ninguna clave. Los archivos se sirven desde /ocr (los copia scripts/copiar-ocr.mjs).
 */

/** Gris y más contraste, y al menos 1800 px de ancho: el fondo con hologramas de la cédula confunde al OCR. */
async function preparar(dataUrl: string): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((ok, mal) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => mal(new Error("imagen"));
    i.src = dataUrl;
  });
  const k = Math.max(1, 1800 / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const ctx = c.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.5) brightness(1.05)";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export async function leerCedulaLocal(dataUrl: string, avance?: (texto: string) => void): Promise<DatosCedula | null> {
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
    const { data } = await worker.recognize(await preparar(dataUrl));
    return interpretarTextoCedula(data.text);
  } finally {
    await worker.terminate();
  }
}
