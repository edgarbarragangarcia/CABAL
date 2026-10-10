import { leerCedulaPdf417 } from "@/lib/comunidad/cedula-pdf417";
import type { DatosCedula } from "@/lib/comunidad/cedula-ocr";

/**
 * Busca el código de barras PDF417 del reverso de la cédula en la foto y, si lo encuentra, saca los datos EXACTOS
 * (sin OCR, sin errores de lectura). ZXing en WebAssembly, servido desde /ocr. Se prueba la foto a varios tamaños:
 * a escala completa el código es muy fino, y a veces lee mejor reducido.
 */
let modulo: Promise<typeof import("zxing-wasm/reader")> | null = null;
function lector() {
  modulo ??= import("zxing-wasm/reader").then((m) => {
    m.prepareZXingModule({ overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith(".wasm") ? "/ocr/zxing_reader.wasm" : prefijo + ruta) } });
    return m;
  });
  return modulo;
}

/** Los bytes tal cual (Latin‑1): el texto del código es de ancho fijo y cualquier recodificación movería las posiciones. */
const comoTexto = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join("");

export async function leerBarras(foto: ImageBitmap): Promise<DatosCedula | null> {
  const { readBarcodes } = await lector();
  const mayor = Math.max(foto.width, foto.height);
  const lados = [...new Set([Math.min(mayor, 3000), Math.min(mayor, 2000), Math.min(mayor, 1300)])];
  for (const lado of lados) {
    const k = lado / mayor;
    const c = document.createElement("canvas");
    c.width = Math.round(foto.width * k);
    c.height = Math.round(foto.height * k);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(foto, 0, 0, c.width, c.height);
    const r = await readBarcodes(ctx.getImageData(0, 0, c.width, c.height), { formats: ["PDF417"], tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 1 }).catch(() => []);
    if (r[0]) {
      const d = leerCedulaPdf417(comoTexto(r[0].bytes));
      if (d) return d;
    }
  }
  return null;
}
