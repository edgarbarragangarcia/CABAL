// Copia a public/ocr los archivos del lector de texto (Tesseract) para servirlos desde el propio sitio:
// la política de seguridad no permite cargarlos de un CDN. No se guardan en git (son ~14 MB): se regeneran
// en cada `npm run dev` y `npm run build` desde node_modules.
import { cpSync, existsSync, mkdirSync } from "node:fs";

const destino = "public/ocr";
mkdirSync(`${destino}/lang`, { recursive: true });

const archivos = [
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"].map((f) => [`node_modules/tesseract.js-core/${f}`, `${destino}/${f}`]),
  ["node_modules/tesseract.js/dist/worker.min.js", `${destino}/worker.min.js`],
  ["node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz", `${destino}/lang/spa.traineddata.gz`],
  // Lector del código de barras PDF417 de la cédula (ZXing en WebAssembly).
  ["node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", `${destino}/zxing_reader.wasm`],
];
for (const [origen, copia] of archivos) {
  if (!existsSync(origen)) {
    console.warn(`[ocr] falta ${origen}: la lectura de cédula en el teléfono no funcionará`);
    continue;
  }
  cpSync(origen, copia);
}
